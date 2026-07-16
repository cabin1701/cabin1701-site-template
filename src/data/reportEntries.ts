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
