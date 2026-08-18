// ai-context（Story/Timeline）をembeddingしてVectorize用のndjsonを作る。
// site（cabin1701.com）は記事の蓄積が無いので、今はStory/Timelineのみが対象。
// 実行: node scripts/ingest-embeddings.mjs
// 生成物: scripts/vectors.ndjson → `npx wrangler vectorize upsert site-2026 --file=scripts/vectors.ndjson` で投入する
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ACCOUNT_ID = '009d2f3b104a624e78aafe0516533530';
const AI_CONTEXT_DIR = fileURLToPath(new URL('../src/content/ai-context', import.meta.url));
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
  const records = await collectCoreRecords();

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
