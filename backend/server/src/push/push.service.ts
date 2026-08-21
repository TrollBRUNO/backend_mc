import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin'; 
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPushPayload, PushParams, PushPayload, PushType } from './push-locales';

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

  async send(
    token: string,
    payload: { title: string; body: string } | PushPayload,
    locale?: string | null,
    params?: PushParams,
  ) {
    if (!token) return;

    const resolvedPayload = this.resolvePayload(payload, locale, params);

    try {
      await admin.messaging().send({
        token,
        notification: {
          title: resolvedPayload.title,
          body: resolvedPayload.body,
        },
      });
    } catch (e) {
      console.warn('Push send failed:', e instanceof Error ? e.message : String(e));
    }
  }

  // params подставляются в плейсхолдеры текста: {casino}, {amount}
  async sendLocalized(
    token: string,
    type: PushType,
    locale?: string | null,
    params?: PushParams,
  ) {
    const payload = getPushPayload(type, locale, params);
    await this.send(token, payload, locale);
  }

  private resolvePayload(
    payload: { title: string; body: string } | PushPayload,
    locale?: string | null,
    params?: PushParams,
  ) {
    if ('title' in payload && 'body' in payload) {
      return payload;
    }

    return getPushPayload(payload as PushType, locale, params);
  }
}

