// Миграция: карта лояльности привязывается к залу, а не к строке города.
//
// Раньше клиент присылал название города на своём языке, поэтому один зал
// попадал в базу пятью разными названиями (Пловдив / Plovdiv / Filibe / ...).
// Теперь в карте лежит casino_id, а city остаётся снимком для старых клиентов.
//
// Соответствие строится из самой коллекции casinos: собираем все локали
// поля city и ищем в них сохранённое в карте название.
//
// ВАЖНО: запускать ПОСЛЕ 2026-08-20-card-id-norm.mongosh.js и после деплоя
// бэкенда с casino_id в схеме карты.
//
// Запуск на сервере:
//   docker exec -i magicity-mongo mongosh dbname < 2026-08-20-card-casino-id.mongosh.js
//
// Скрипт идемпотентный — повторный запуск ничего не сломает.

// ---------- справочник: название города в любой локали -> зал ----------

function normalizeCity(value) {
  return String(value ?? '').trim().toLowerCase();
}

const cityToCasino = new Map();
const ambiguousCities = new Set();

db.casinos.find({}, { city: 1 }).forEach(casino => {
  const labels = Object.values(casino.city ?? {});

  labels.forEach(label => {
    const key = normalizeCity(label);
    if (!key) return;

    const known = cityToCasino.get(key);
    // Один и тот же город у двух залов — по названию их не различить,
    // такие карты оставляем без casino_id и разбираем руками
    if (known && String(known) !== String(casino._id)) {
      ambiguousCities.add(key);
      return;
    }
    cityToCasino.set(key, casino._id);
  });
});

print(`справочник: ${cityToCasino.size} названий городов, неоднозначных: ${ambiguousCities.size}`);
ambiguousCities.forEach(c => print(`  неоднозначно: ${c}`));

// ---------- проставить casino_id картам ----------

let scanned = 0;
let matched = 0;
let accountsUpdated = 0;
const unmatched = new Map();

db.accounts.find({ 'cards.0': { $exists: true } }).forEach(acc => {
  let changed = false;

  const cards = acc.cards.map(card => {
    scanned++;

    if (card.casino_id) return card;

    const key = normalizeCity(card.city);
    const casinoId = ambiguousCities.has(key) ? null : cityToCasino.get(key);

    if (!casinoId) {
      unmatched.set(card.city, (unmatched.get(card.city) ?? 0) + 1);
      return card;
    }

    changed = true;
    matched++;
    return { ...card, casino_id: casinoId };
  });

  if (!changed) return;

  db.accounts.updateOne({ _id: acc._id }, { $set: { cards } });
  accountsUpdated++;
});

print(`cards: просмотрено=${scanned}, привязано к залу=${matched}, аккаунтов обновлено=${accountsUpdated}`);

if (unmatched.size) {
  print(`ВНИМАНИЕ: карт без зала: ${[...unmatched.values()].reduce((a, b) => a + b, 0)}`);
  unmatched.forEach((count, city) => print(`  ${JSON.stringify(city)} -> ${count} шт.`));
  print('  Такие карты остались с casino_id: null — уведомления по ним не фильтруются.');
}

// ---------- дубли теперь считаются в пределах зала ----------
// Прошлая миграция печатала дубли по всей базе и не могла отличить настоящий
// дубль от одинаковых номеров в разных залах. Теперь может

const duplicates = db.accounts
  .aggregate([
    { $unwind: '$cards' },
    {
      $match: {
        'cards.active': true,
        'cards.card_id_norm': { $ne: null },
        'cards.casino_id': { $ne: null },
      },
    },
    {
      $group: {
        _id: { casino: '$cards.casino_id', card: '$cards.card_id_norm' },
        count: { $sum: 1 },
        logins: { $push: '$login' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ])
  .toArray();

if (duplicates.length) {
  print(`ВНИМАНИЕ: одинаковых активных карт внутри одного зала: ${duplicates.length}`);
  duplicates.forEach(d =>
    print(`  зал ${d._id.casino} / ${d._id.card} -> ${d.logins.join(', ')}`),
  );
} else {
  print('дублей внутри залов нет');
}

// ---------- индекс ----------

db.accounts.createIndex({ 'cards.casino_id': 1 });
print('accounts: индекс cards.casino_id создан');

print('Миграция завершена.');
