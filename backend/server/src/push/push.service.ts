import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin'; 
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PushService {
  constructor() {
    const serviceAccount = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', 'firebase', 'magiccity-6e868-firebase-adminsdk-mt1r6-c2f5a7593f.json'),
        'utf8',
      ),
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }

  async send(token: string, payload: { title: string; body: string }) {
    if (!token) return;

    try {
      await admin.messaging().send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
      });
    } catch (e) {
      console.warn('Push send failed:', e.message);
    }
  }
}

