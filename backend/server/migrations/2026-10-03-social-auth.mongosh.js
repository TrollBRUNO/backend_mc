// Миграция: вход через Google, Apple и телефон.
//
// Старые sparse-индексы google_id_1 и apple_id_1 заменяются уникальными
// частичными google_id_unique и apple_id_unique, добавляется phone_unique.
// Sparse для уникальности не годится: явный null он индексирует, и все
// аккаунты без Google оказались бы дублями друг друга. Частичный индекс
// смотрит только на заполненные значения.
//
// Запускать ПОСЛЕ деплоя бэкенда со входом через Google, Apple и телефон.
// Бэкенд при старте сам пробует создать новые индексы; пока стоят старые,
// у него может не выйти — это не страшно, скрипт доделает. До запуска
// скрипта уникальность держится проверками в коде.
//
// Запуск на сервере:
//   docker exec -i magicity-mongo mongosh dbname < 2026-10-03-social-auth.mongosh.js
//
// Скрипт идемпотентный — повторный запуск ничего не сломает.

const FIELDS = ['google_id', 'apple_id', 'phone'];

// ---------- пустые строки → null ----------
// Админка могла сохранить пустую строку вместо «нет». Частичный индекс
// счёл бы такие аккаунты дублями: '' — тоже строка

for (const field of FIELDS) {
  const res = db.accounts.updateMany({ [field]: '' }, { $set: { [field]: null } });
  if (res.modifiedCount) print(`${field}: пустых строк → null: ${res.modifiedCount}`);
}

// ---------- дубли ----------
// Уникальный индекс поверх дублей не создастся. Разбирать их руками,
// молча выбирать «правильный» аккаунт скрипт не будет

let duplicates = 0;

for (const field of FIELDS) {
  db.accounts.aggregate([
    { $match: { [field]: { $type: 'string' } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, logins: { $push: '$login' } } },
    { $match: { count: { $gt: 1 } } },
  ]).forEach(dup => {
    duplicates++;
    print(`ДУБЛЬ ${field} = ${dup._id}: ${dup.logins.join(', ')}`);
  });
}

if (duplicates) {
  print('Найдены дубли — разберите их руками и запустите скрипт снова. Индексы не тронуты.');
  quit(1);
}

// ---------- индексы ----------

const existing = db.accounts.getIndexes().map(index => index.name);

for (const name of ['google_id_1', 'apple_id_1']) {
  if (existing.includes(name)) {
    db.accounts.dropIndex(name);
    print(`удалён старый индекс ${name}`);
  }
}

for (const field of FIELDS) {
  db.accounts.createIndex(
    { [field]: 1 },
    {
      name: `${field}_unique`,
      unique: true,
      partialFilterExpression: { [field]: { $type: 'string' } },
    },
  );
  print(`индекс ${field}_unique на месте`);
}

print('Готово.');
