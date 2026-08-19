// Миграция: роль крупье.
// Проставляет новые поля существующим документам, чтобы админка могла
// фильтровать по автору и залу, не спотыкаясь об отсутствующие поля:
//   accounts  -> casino_ids: [], last_activity_at: null
//   news      -> created_by, created_by_login, casino_id
//   galleries -> created_by, created_by_login, casino_id
//   casinos.events[] -> created_by, created_by_login
//
// Записи, созданные до появления роли, остаются с автором null —
// в админке это «создано администратором / до внедрения ролей».
//
// ВАЖНО: запускать ПОСЛЕ деплоя бэкенда с ролью крупье.
//
// Запуск на сервере:
//   docker exec -i magicity-mongo mongosh dbname < 2026-08-19-croupier-role.mongosh.js
//
// Скрипт идемпотентный — повторный запуск ничего не сломает.

// ---------- accounts: залы крупье и дата последней активности ----------

const accountsCasinoIds = db.accounts.updateMany(
  { casino_ids: { $exists: false } },
  { $set: { casino_ids: [] } },
);
print(
  `accounts.casino_ids: matched=${accountsCasinoIds.matchedCount} modified=${accountsCasinoIds.modifiedCount}`,
);

const accountsActivity = db.accounts.updateMany(
  { last_activity_at: { $exists: false } },
  { $set: { last_activity_at: null } },
);
print(
  `accounts.last_activity_at: matched=${accountsActivity.matchedCount} modified=${accountsActivity.modifiedCount}`,
);

// ---------- news: автор и зал ----------

const newsAuthor = db.news.updateMany(
  { created_by: { $exists: false } },
  { $set: { created_by: null, created_by_login: null, casino_id: null } },
);
print(`news: matched=${newsAuthor.matchedCount} modified=${newsAuthor.modifiedCount}`);

// ---------- galleries (выигрыши): автор и зал ----------

const galleryAuthor = db.galleries.updateMany(
  { created_by: { $exists: false } },
  { $set: { created_by: null, created_by_login: null, casino_id: null } },
);
print(`galleries: matched=${galleryAuthor.matchedCount} modified=${galleryAuthor.modifiedCount}`);

// ---------- casinos.events: автор мероприятия ----------

const eventsAuthor = db.casinos.updateMany(
  { 'events.created_by': { $exists: false } },
  {
    $set: {
      'events.$[e].created_by': null,
      'events.$[e].created_by_login': null,
    },
  },
  { arrayFilters: [{ 'e.created_by': { $exists: false } }] },
);
print(`casinos.events: matched=${eventsAuthor.matchedCount} modified=${eventsAuthor.modifiedCount}`);

// ---------- индексы журнала действий ----------
// Mongoose создаёт их сам при старте приложения, здесь — на случай autoIndex: false

db.activitylogs.createIndex({ account_id: 1, created_at: -1 });
db.activitylogs.createIndex({ entity: 1, created_at: -1 });
db.activitylogs.createIndex({ casino_id: 1 });
print('activitylogs: индексы созданы');

// ---------- назначить крупье вручную (при необходимости) ----------
// Обычно крупье заводят через админку (POST /croupiers), но существующий
// аккаунт можно повысить и здесь. Раскомментируйте и подставьте свои значения:
//
// const r = db.accounts.updateOne(
//   { login: 'dealer_plovdiv' },
//   {
//     $set: {
//       role: 'croupier',
//       casino_ids: [ObjectId('6966dcc5431242f3e710a955')], // Magic City, Пловдив
//     },
//   },
// );
// print(`promote: matched=${r.matchedCount} modified=${r.modifiedCount}`);

print('Миграция завершена.');
