import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Одно подключение к Firebase на весь сервер: через него уходят пуши
// и проверяются токены входа через Google, Apple и телефон.
// Ключ сервисного аккаунта лежит рядом с сервером и в git не хранится
export function getFirebaseApp(): admin.app.App {
  if (admin.apps.length) return admin.app();

  const serviceAccount = JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', 'firebase', 'magiccity-6e868-firebase-adminsdk-mt1r6-c2f5a7593f.json'),
      'utf8',
    ),
  );

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
