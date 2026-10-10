import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { getFirebaseApp } from '../firebase/firebase-app';
import { getPushPayload, PushParams, PushPayload, PushType } from './push-locales';

@Injectable()
export class PushService {
  constructor() {
    getFirebaseApp();
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

