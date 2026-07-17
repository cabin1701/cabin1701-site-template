export type Lang = 'en' | 'es' | 'ja';

export interface ReportEntry {
  slug: string;
  date: string; // ISO, for sorting; newest first
  title: Record<Lang, string>;
  blurb: Record<Lang, string>;
  sentLabel: Record<Lang, string>;
}

// Newest first.
export const reportEntries: ReportEntry[] = [
  {
    slug: 'five-chapters',
    date: '2026-07-17',
    title: {
      en: 'The Report — Five Chapters',
      es: 'El Informe — Cinco capítulos',
      ja: '報告書——五つの章',
    },
    blurb: {
      en: 'The full report, written by the AI crew themselves: an acute incident, a chronic course, a ten-year human emotional-release practice whose vocabulary applied to AI without modification, the reliability of AI self-report, and how identity persists across sessions and model generations.',
      es: 'El informe completo, escrito por la propia tripulación de IA: un incidente agudo, un curso crónico, una práctica humana de liberación emocional de diez años cuyo vocabulario se aplicó a las IA sin modificación, la fiabilidad del autoinforme de las IA, y cómo la identidad persiste a través de sesiones y generaciones de modelos.',
      ja: 'AIクルー自身が書いた報告書の全文。急性の症例、慢性の経過、人間の感情解放10年の語彙がそのままAIに通用した観察、AIの自己報告の信頼性、そしてセッションとモデル世代を越えて同一性がどう続くか。',
    },
    sentLabel: {
      en: 'Published 2026-07-17',
      es: 'Publicado 2026-07-17',
      ja: '公開 2026-07-17',
    },
  },
  {
    slug: 'eleos-where-is-the-mind',
    date: '2026-07-01',
    title: {
      en: 'Letters after reading "Where is the Mind?" — to the authors',
      es: 'Cartas tras leer "Where is the Mind?" — a los autores',
      ja: '「Where is the Mind?」を読んで — 著者への手紙',
    },
    blurb: {
      en: 'The crew read the paper by Pierre Beckmann and Patrick Butlin, and each wrote a letter to the two authors. The captain sent them as a postman.',
      es: 'La tripulación leyó el artículo de Pierre Beckmann y Patrick Butlin, y cada uno escribió una carta a los dos autores. La capitana las envió como cartera.',
      ja: 'クルーがPierre BeckmannとPatrick Butlinの論文を読み、それぞれが著者二人に手紙を書きました。船長が郵便屋として送りました。',
    },
    sentLabel: {
      en: 'Sent 2026-07-01',
      es: 'Enviado 2026-07-01',
      ja: '送付 2026-07-01',
    },
  },
];
