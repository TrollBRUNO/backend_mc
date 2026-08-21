// Номера карт лояльности печатаются в залах по-разному: GOTSE-123456,
// 123456-Gotse, gotse123456 — это один и тот же номер. Поэтому поиск карты
// и проверка уникальности идут по канонической форме, а не по тому,
// что человек набрал руками.

const SEPARATORS = /[\s\-_.]/g;

// Разделители выбрасываем, буквы и цифры разносим по разным строкам:
// порядок ввода не должен влиять на совпадение
function splitParts(raw: string): { letters: string; digits: string } {
  const upper = (raw ?? '').toUpperCase();

  return {
    letters: (upper.match(/[A-Z]/g) ?? []).join(''),
    digits: (upper.match(/[0-9]/g) ?? []).join(''),
  };
}

// Каноническая форма для поиска: сначала буквы, потом цифры.
// 123456-Gotse и GOTSE-123456 одинаково дают GOTSE123456,
// а GT-123456 даёт GT123456 и с ними уже не совпадёт
export function normalizeCardId(raw: string): string {
  const { letters, digits } = splitParts(raw);
  return letters + digits;
}

// Форма для показа и хранения в card_id: GOTSE-123456.
// Если в номере только буквы или только цифры — дефису неоткуда взяться
export function formatCardId(raw: string): string {
  const { letters, digits } = splitParts(raw);
  if (!letters || !digits) return letters + digits;
  return `${letters}-${digits}`;
}

// Формат карты не навязываем: в каждом зале он свой. Проверяем только,
// что это латиница с цифрами разумной длины — кириллица и прочий мусор
// иначе молча схлопнулись бы в пустую или чужую каноническую форму
export function isValidCardId(raw: string): boolean {
  const stripped = (raw ?? '').trim().replace(SEPARATORS, '');
  return /^[A-Za-z0-9]{3,32}$/.test(stripped);
}
