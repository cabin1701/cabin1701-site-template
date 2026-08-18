// ai-context（Story/Timeline）とサイト各ページをembeddingしてVectorize用のndjsonを作る。
//
// ページの投入対象は ai-context/{ja,en,es}/pages.md に要約が書いてあるページだけ。
// 要約の見出し（## パス｜ページ名）を消せば、そのページは投入対象から外れる——一箇所で決まる。
// 本文は dist/ のビルド済みHTMLから取る（.astro を直接読まずに済む）。事前に npm run build が必要。
//
// report/five-chapters と report/eleos-where-is-the-mind は本文が英語のみで、
// ja/es のページも中身は同じ英語。英語版だけ本文をembeddingし、ja/es は要約だけ入れる
// （要約側に「本文は英語」と英語ページのURLが書いてある）。
// 実行: node scripts/ingest-embeddings.mjs
// 生成物: scripts/vectors.ndjson → `npx wrangler vectorize upsert site-2026 --file=scripts/vectors.ndjson` で投入する
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ACCOUNT_ID = '009d2f3b104a624e78aafe0516533530';
const AI_CONTEXT_DIR = fileURLToPath(new URL('../src/content/ai-context', import.meta.url));
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));
const SITE_ORIGIN = 'https://cabin1701.com';
const PAGE_CHUNK_SIZE = 1500;
// 本文が英語のみのページ。ja/es 版は本文をembeddingせず、要約だけ入れる。
const EN_ONLY_BODIES = ['/report/five-chapters/', '/report/eleos-where-is-the-mind/'];
const OUT_FILE = fileURLToPath(new URL('./vectors.ndjson', import.meta.url));
const EMBED_BATCH = 5;
const CORE_CHUNK_SIZE = 1500;

function getToken() {
  const configPath = join(process.env.HOME, 'Library/Preferences/.wrangler/config/default.toml');
  return readFile(configPath, 'utf-8').then((text) => {
    const m = text.match(/^oauth_token\s*=\s*"([^"]+)"/m);
    if (!m) throw new Error('oauth_token not found in wrangler config');
    return m[1];
  });
}

function stripFrontmatter(raw) {
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return (m ? m[1] : raw).trim();
}

function stripMarkdown(text) {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    .replace(/[*_#>`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// stripMarkdown()が\n{2,}を単一\nに潰した後のテキストを受け取る前提なので、単一\nを段落境界として扱う
function chunkText(text, size) {
  const paragraphs = text.split(/\n/);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if (current && (current.length + p.length) > size) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + p;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const CORE_DOC_TITLES = {
  'story.md': { ja: 'Seinaのストーリー', en: "Seina's Story", es: 'La historia de Seina' },
  'timeline.md': { ja: 'Seina年表', en: 'Seina Timeline', es: 'Cronología de Seina' },
};

async function collectCoreRecords() {
  const records = [];
  for (const lang of ['ja', 'en', 'es']) {
    const dir = join(AI_CONTEXT_DIR, lang);
    const files = await readdir(dir).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      if (file === 'pages.md') continue; // ページ要約は collectPageRecords が扱う
      const raw = await readFile(join(dir, file), 'utf-8');
      const body = stripMarkdown(stripFrontmatter(raw));
      const title = CORE_DOC_TITLES[file]?.[lang] ?? file;
      const chunks = chunkText(body, CORE_CHUNK_SIZE);
      chunks.forEach((chunk, i) => {
        const id = createHash('sha1').update(`core:${lang}:${file}:${i}`).digest('hex').slice(0, 32);
        records.push({
          id,
          embedText: `${title}\n\n${chunk}`,
          metadata: { lang, title: `${title} (${i + 1}/${chunks.length})`, url: '', excerpt: chunk.slice(0, 500), type: 'core' },
        });
      });
      console.log(`core ${lang}/${file}: ${chunks.length} chunks`);
    }
  }
  return records;
}

// 本文は改行を潰した1行の文字列なので、chunkText（改行が境界）は使えない。
// 文末（。！？. ! ?）で切り、それも無ければ文字数で強制的に刻む。
function chunkFlatText(text, size) {
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]*\s*/g) ?? [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    for (let i = 0; i < sentence.length; i += size) {
      const piece = sentence.slice(i, i + size); // 1文が size より長い場合の保険
      if (current && current.length + piece.length > size) {
        chunks.push(current.trim());
        current = '';
      }
      current += piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ページ本文をビルド済みHTMLから取り出す。nav と footer は全ページ共通の定型文なので落とす
// （残すと、どのページも同じ文字列で似てしまい検索がぼやける）。
function pageTextFromHtml(html) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let body = main ? main[1] : (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) ?? [])[1] ?? html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body).replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/&amp;/g, '&');
}

// pages.md を `## パス｜ページ名` 単位でパースする。ここに載っているページだけが投入対象。
function parsePageSummaries(md) {
  const entries = [];
  const re = /^## (\S+?)｜(.+)$/gm;
  const heads = [...md.matchAll(re)];
  heads.forEach((h, i) => {
    const start = h.index + h[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
    const summary = md.slice(start, end).replace(/^\s*---[\s\S]*$/m, '').trim();
    if (summary) entries.push({ path: h[1], title: h[2].trim(), summary });
  });
  return entries;
}

async function collectPageRecords() {
  const records = [];
  for (const lang of ['ja', 'en', 'es']) {
    const mdPath = join(AI_CONTEXT_DIR, lang, 'pages.md');
    const md = await readFile(mdPath, 'utf-8').catch(() => null);
    if (!md) {
      console.log(`pages ${lang}: pages.md が無いのでスキップ`);
      continue;
    }
    const entries = parsePageSummaries(md);
    let bodyChunks = 0;
    for (const entry of entries) {
      const url = SITE_ORIGIN + entry.path;
      const idBase = `page:${lang}:${entry.path}`;

      // 要約そのものを1件入れる。本文が当たらなくても、ページの存在と概要には必ず届く。
      records.push({
        id: createHash('sha1').update(`${idBase}:summary`).digest('hex').slice(0, 32),
        embedText: `${entry.title}\n\n${entry.summary}`,
        metadata: { lang, title: entry.title, url, excerpt: entry.summary, type: 'page' },
      });

      // 本文。英語のみの2本は ja/es 版の本文を入れない（同じ英語が3回入るのを避ける）。
      const enOnly = EN_ONLY_BODIES.some((p) => entry.path.replace(/^\/(ja|es)/, '') === p);
      if (enOnly && lang !== 'en') continue;

      const htmlPath = join(DIST_DIR, entry.path.replace(/^\//, ''), 'index.html');
      const html = await readFile(htmlPath, 'utf-8').catch(() => null);
      if (!html) {
        console.log(`  ! ${entry.path} のHTMLが無い（npm run build 済み？）`);
        continue;
      }
      const text = pageTextFromHtml(html);
      if (!text) continue;
      const chunks = chunkFlatText(text, PAGE_CHUNK_SIZE);
      chunks.forEach((chunk, i) => {
        records.push({
          id: createHash('sha1').update(`${idBase}:body:${i}`).digest('hex').slice(0, 32),
          embedText: `${entry.title}\n\n${chunk}`,
          metadata: { lang, title: entry.title, url, excerpt: entry.summary, type: 'page' },
        });
      });
      bodyChunks += chunks.length;
    }
    console.log(`pages ${lang}: 要約 ${entries.length} 件 + 本文 ${bodyChunks} チャンク`);
  }
  return records;
}

async function embedBatch(texts, token) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts }),
    },
  );
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors));
  return json.result.data;
}

async function main() {
  const token = await getToken();
  const records = [...(await collectCoreRecords()), ...(await collectPageRecords())];

  const vectors = [];
  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH);
    const embeddings = await embedBatch(batch.map((r) => r.embedText), token);
    batch.forEach((r, j) => {
      vectors.push({ id: r.id, values: embeddings[j], metadata: r.metadata });
    });
    console.log(`embedded ${Math.min(i + EMBED_BATCH, records.length)}/${records.length}`);
  }

  await writeFile(OUT_FILE, vectors.map((v) => JSON.stringify(v)).join('\n') + '\n');
  console.log(`wrote ${vectors.length} vectors to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
