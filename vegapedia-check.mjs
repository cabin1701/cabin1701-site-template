// Vegapedia の md を Astro と同じパーサに通し、太字の崩れとアンカーのズレを検出する。
// 日本語は「」や、で終わることが多く、閉じる ** の直前が句読点・直後が文字だと
// Markdown が太字を閉じない。書いている時には気づけないので機械で止める。
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import fs from 'fs';

const LANGS = ['ja', 'en', 'es'];
let bad = 0;

const anchors = {};
for (const l of LANGS) {
  const src = fs.readFileSync(`src/content/vegapedia-${l}.md`, 'utf8');
  anchors[l] = [...src.matchAll(/^## .*?\{#([^\}]+)\}/gm)].map((m) => m[1]);

  // 段落ごとに変換し、出力に生の ** が残っていたら崩れている
  let block = [], start = 1;
  const lines = src.split('\n');
  const flush = () => {
    if (block.length) {
      const txt = block.join('\n');
      if (txt.includes('**')) {
        const html = micromark(txt, { allowDangerousHtml: true, extensions: [gfm()], htmlExtensions: [gfmHtml()] });
        if (html.replace(/<(code|pre)\b[\s\S]*?<\/\1>/g, '').includes('**')) {
          console.log(`  太字が崩れています  vegapedia-${l}.md:${start}`);
          console.log(`    ${txt.replace(/\n/g, ' ').slice(0, 100)}`);
          bad++;
        }
      }
    }
    block = [];
  };
  lines.forEach((line, i) => {
    if (line.trim() === '') flush();
    else { if (!block.length) start = i + 1; block.push(line); }
  });
  flush();
}

// アンカーは3言語で完全一致していないと、言語をまたぐ紐付けが切れる
const base = anchors.ja.join(',');
for (const l of LANGS) {
  if (anchors[l].join(',') !== base) {
    console.log(`  アンカーがズレています  ${l}`);
    console.log(`    ja: ${anchors.ja.join(' ')}`);
    console.log(`    ${l}: ${anchors[l].join(' ')}`);
    bad++;
  }
}

console.log(bad === 0
  ? `OK — 3言語とも崩れなし、項目 ${anchors.ja.length} 件、アンカー一致`
  : `NG — ${bad} 件。直してから build に進むこと`);
process.exit(bad === 0 ? 0 : 1);
