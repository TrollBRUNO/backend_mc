// Миграция: добавляет греческие (el) и турецкие (tr) переводы в casinos/news/galleries
// и конвертирует name/description событий казино из строки в карту переводов (5 языков).
//
// ВАЖНО: запускать ТОЛЬКО ПОСЛЕ деплоя бэкенда с локализованными events
// (casino.schema.ts: events.name/description -> Map), иначе старый бэкенд
// будет кастовать карту в строку.
//
// Запуск на сервере:
//   docker exec -i magicity-mongo mongosh dbname < 2026-07-26-el-tr-locales.mongosh.js
//
// Скрипт идемпотентный — повторный запуск ничего не сломает.

// ---------- casinos: el/tr для city/address/name ----------

const casinoUpdates = [
  {
    id: ObjectId('6966dcc5431242f3e710a955'), // Magic City, Пловдив
    set: {
      'city.el': 'Φιλιππούπολη', // историческое греческое название Пловдива
      'city.tr': 'Filibe', // турецкое название Пловдива
      'address.el': 'Λεωφ. Ιζτότσεν 48',
      'address.tr': 'İztoçen Bulvarı No:48',
      'name.el': 'Magic City',
      'name.tr': 'Magic City',
    },
  },
  {
    id: ObjectId('6a2d7c3c243b2885f2f395c8'), // MegaBet, Кирково
    set: {
      'city.el': 'Κίρκοβο',
      'city.tr': 'Kirkovo',
      'address.el': 'Ξενοδοχείο Κίρκοβο',
      'address.tr': 'Kirkovo Oteli',
      'name.el': 'MegaBet',
      'name.tr': 'MegaBet',
    },
  },
];

for (const u of casinoUpdates) {
  const r = db.casinos.updateOne({ _id: u.id }, { $set: u.set });
  print(`casinos ${u.id}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
}

// ---------- casinos.events: строка -> карта переводов ----------

const eventNames = {
  '🎰 Бонус x2': {
    bg: '🎰 Бонус x2',
    el: '🎰 Μπόνους x2',
    en: '🎰 Bonus x2',
    ru: '🎰 Бонус x2',
    tr: '🎰 Bonus x2',
  },
};

const eventDescriptions = {
  'Даешь 100 евро -> 200 евро!': {
    bg: 'Даваш 100 евро -> получаваш 200 евро!',
    el: 'Δίνεις 100 ευρώ -> παίρνεις 200 ευρώ!',
    en: 'Give €100 -> get €200!',
    ru: 'Даешь 100 евро -> 200 евро!',
    tr: '100 euro ver -> 200 euro al!',
  },
};

// Неизвестный текст дублируем во все локали, чтобы приложение всегда нашло свой язык
function toLocalized(value, dict) {
  if (typeof value !== 'string') return value; // уже карта — не трогаем
  if (dict[value]) return dict[value];
  return { bg: value, el: value, en: value, ru: value, tr: value };
}

db.casinos.find({ 'events.0': { $exists: true } }).forEach((casino) => {
  let changed = false;
  const events = casino.events.map((e) => {
    if (typeof e.name === 'string' || typeof e.description === 'string') changed = true;
    return {
      ...e,
      name: toLocalized(e.name, eventNames),
      description: toLocalized(e.description, eventDescriptions),
    };
  });
  if (!changed) {
    print(`casinos.events ${casino._id}: уже локализованы, пропуск`);
    return;
  }
  const r = db.casinos.updateOne({ _id: casino._id }, { $set: { events } });
  print(`casinos.events ${casino._id}: modified=${r.modifiedCount}`);
});

// ---------- news: el/tr для title/description ----------

const newsUpdates = [
  {
    id: ObjectId('698a3e3ea655f1c8816a89bc'), // лотерея 23.10
    set: {
      'title.el': 'Νέα κλήρωση!',
      'title.tr': 'Yeni çekiliş!',
      'description.el':
        'Στις 23.10 στο καζίνο Magic City θα πραγματοποιηθεί κλήρωση! Σας περιμένουμε όλους!',
      'description.tr':
        '23.10 tarihinde Magic City Casino’da çekiliş yapılacak! Herkesi bekliyoruz!',
    },
  },
  {
    id: ObjectId('6a2d96d6243b2885f2f3ff61'), // онлайн-слоты
    set: {
      'title.el': 'Online φρουτάκια!',
      'title.tr': 'Online slot oyunları!',
      'description.el': 'Έχουμε ετοιμάσει μια νέα έκπληξη για εσάς....',
      'description.tr': 'Sizin için yeni bir sürprizimiz var....',
    },
  },
];

for (const u of newsUpdates) {
  const r = db.news.updateOne({ _id: u.id }, { $set: u.set });
  print(`news ${u.id}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
}

// ---------- galleries: el/tr для description ----------

const galleryUpdates = [
  {
    id: ObjectId('698a4888a655f1c8816a90fd'), // BIG WIN 4500€
    set: {
      'description.el': 'ΜΕΓΑΛΟ ΚΕΡΔΟΣ 4500€ ΣΤΗ ΦΙΛΙΠΠΟΥΠΟΛΗ',
      'description.tr': 'FİLİBE’DE BÜYÜK KAZANÇ 4500€',
    },
  },
];

for (const u of galleryUpdates) {
  const r = db.galleries.updateOne({ _id: u.id }, { $set: u.set });
  print(`galleries ${u.id}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
}

print('Миграция завершена.');
