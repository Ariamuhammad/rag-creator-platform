export type EvidenceSource = {
  documentId: string;
  documentTitle?: string;
  content: string;
  chunkIndex?: number;
};

const stopWords = new Set(
  'yang dan atau untuk pada dalam dengan dari adalah sebagai ini itu tersebut dapat akan bahwa oleh sebuah secara the a an and or of to in is are this that with for as be can'.split(
    ' ',
  ),
);
const words = (text: string) =>
  [...new Set(text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [])].filter(
    (word) => word.length > 2 && !stopWords.has(word),
  );
const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
const negated = (text: string) =>
  /\b(tidak|bukan|jangan|not|never|no|without|tanpa)\b/i.test(text);
const sequence = (text: string): string[] =>
  text.toLowerCase().match(/\b(before|after|sebelum|sesudah|setelah)\b/g) || [];

// shortcut: lexical evidence is conservative, use a validated entailment evaluator before claiming semantic verification.
export function assessAnswer(
  answer: string,
  sources: Pick<EvidenceSource, 'content'>[],
) {
  const text = answer
    .replace(/\[\d+\]/g, '')
    .replace(/^#{1,6} .+$/gm, '')
    .trim();
  if (
    !text ||
    !sources.length ||
    /https?:\/\/|abaikan.{0,40}instruksi|ignore.{0,40}instructions/i.test(text)
  )
    return { supported: false, claims: [] };
  const claims = sentences(text)
    .map((line) => line.replace(/^[>\-*\d.\s]+/, '').trim())
    .filter(Boolean);
  const evidence = claims.map((claim) => {
    const terms = words(claim);
    const numbers: string[] = claim.match(/\b\d+(?:[.,]\d+)?%?/g) || [];
    const sourceIndexes = sources.flatMap((source, index) => {
      const supported = sentences(source.content).some((sentence) => {
        const available = new Set(words(sentence));
        const matches = terms.filter((term) => available.has(term)).length;
        const sourceNumbers: string[] =
          sentence.match(/\b\d+(?:[.,]\d+)?%?/g) || [];
        return (
          terms.length >= 2 &&
          matches >= 2 &&
          matches / terms.length >= 0.6 &&
          numbers.every((number) => sourceNumbers.includes(number)) &&
          negated(claim) === negated(sentence) &&
          sequence(claim).every((word) => sequence(sentence).includes(word))
        );
      });
      return supported ? [index + 1] : [];
    });
    return { text: claim, sourceIndexes };
  });
  return {
    supported:
      evidence.length > 0 &&
      evidence.every((claim) => claim.sourceIndexes.length > 0),
    claims: evidence,
  };
}

export function answerFromSources(sources: EvidenceSource[]) {
  if (!sources.length)
    return 'Materi kursus belum mencakup topik ini. Coba pertanyaan yang lebih spesifik.';
  return (
    'Berikut kutipan materi yang ditemukan. Periksa sumber untuk menjawab pertanyaan Anda.\n\n' +
    sources
      .map((source, index) => {
        const title = (source.documentTitle || 'Materi kursus').replace(
          /[\\`*_{}\[\]()<>#!]/g,
          '',
        );
        return (
          `**[${index + 1}] ${title}**\n\n` +
          source.content
            .split('\n')
            .map((line) => '> ' + line)
            .join('\n')
        );
      })
      .join('\n\n')
  );
}
