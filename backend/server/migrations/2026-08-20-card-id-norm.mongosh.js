// Миграция: каноническая форма номера карты лояльности.
//
// Номера печатаются в залах по-разному — GOTSE-123456, 123456-Gotse,
// gotse123456. Раньше карта искалась строгим сравнением строк, поэтому
// набранный иначе номер не находился и бонус не выдавался.
// Теперь у каждой карты есть card_id_norm: буквы, затем цифры, без
// разделителей и в верхнем регистре. Поиск идёт только по нему.
//
// ВАЖНО: запускать ТОЛЬКО ПОСЛЕ деплоя бэкенда с card-id.util.ts,
// иначе старый бэкенд продолжит писать карты без card_id_norm.
//
// Запуск на сервере:
//   docker exec -i magicity-mongo mongosh dbname < 2026-08-20-card-id-norm.mongosh.js
//
// Скрипт идемпотентный — повторный запуск ничего не сломает.

// Те же правила, что в src/account/card-id.util.ts. Держать синхронно
function splitParts(raw) {
  const upper = String(raw ?? '').toUpperCase();
  return {
    letters: (upper.match(/[A-Z]/g) ?? []).join(''),
    digits: (upper.match(/[0-9]/g) ?? []).join(''),
  };
}

function normalizeCardId(raw) {
  const { letters, digits } = splitParts(raw);
  return letters + digits;
}

function formatCardId(raw) {
  const { letters, digits } = splitParts(raw);
  if (!letters || !digits) return letters + digits;
  return `${letters}-${digits}`;
}

// ---------- проставить card_id_norm и привести card_id к виду GOTSE-123456 ----------

let scanned = 0;
let updated = 0;
const skipped = [];

db.accounts.find({ 'cards.0': { $exists: true } }).forEach(acc => {
  let changed = false;

  const cards = acc.cards.map(card => {
    scanned++;

    const norm = normalizeCardId(card.card_id);

    // Номер, из которого не осталось ни букв, ни цифр (кириллица, пустая
    // строка, мусор) — не трогаем и показываем в конце списком: такие
    // карты надо разобрать руками, молча схлопывать их нельзя
    if (!norm) {
      skipped.push(`${acc.login}: ${JSON.stringify(card.card_id)}`);
      return card;
    }

    const display = formatCardId(card.card_id);

    if (card.card_id_norm === norm && card.card_id === display) return card;

    changed = true;
    return { ...card, card_id: display, card_id_norm: norm };
  });

  if (!changed) return;

  db.accounts.updateOne({ _id: acc._id }, { $set: { cards } });
  updated++;
});

print(`cards: просмотрено=${scanned}, аккаунтов обновлено=${updated}`);

// ---------- карты, ставшие дублями после нормализации ----------
// Раньше "PB-123456" и "pb123456" считались разными и могли висеть на
// двух аккаунтах. Теперь это одна карта — такие пары чиним руками,
// автоматически отбирать карту у живого аккаунта нельзя

const duplicates = db.accounts
  .aggregate([
    { $unwind: '$cards' },
    { $match: { 'cards.active': true, 'cards.card_id_norm': { $ne: null } } },
    {
      $group: {
        _id: '$cards.card_id_norm',
        count: { $sum: 1 },
        logins: { $push: '$login' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ])
  .toArray();

if (duplicates.length) {
  print(`ВНИМАНИЕ: активных карт-дублей после нормализации: ${duplicates.length}`);
  duplicates.forEach(d => print(`  ${d._id} -> ${d.logins.join(', ')}`));
} else {
  print('дублей активных карт нет');
}

if (skipped.length) {
  print(`ВНИМАНИЕ: карт без букв и цифр: ${skipped.length}`);
  skipped.forEach(s => print(`  ${s}`));
}

// ---------- индекс ----------
// Mongoose создаёт его сам при старте приложения, здесь — на случай autoIndex: false

db.accounts.createIndex({ 'cards.card_id_norm': 1 });
print('accounts: индекс cards.card_id_norm создан');

print('Миграция завершена.');
