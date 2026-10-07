import { BadRequestException, Injectable } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { getFirebaseApp } from '../firebase/firebase-app';
import { VerifiedIdentity } from '../account/identity.util';

// Приложение входит в Google, Apple или по SMS через Firebase и присылает
// сюда его ID-токен. Сам Firebase для нас только проверяющий: сессии
// и аккаунты остаются нашими
@Injectable()
export class FirebaseIdentityService {
  async verify(idToken: unknown): Promise<VerifiedIdentity> {
    if (typeof idToken !== 'string' || !idToken) {
      throw new BadRequestException('ID_TOKEN_REQUIRED');
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getFirebaseApp().auth().verifyIdToken(idToken);
    } catch (error) {
      // Просроченный, поддельный или выданный не нашему проекту токен.
      // 400, а не 401: на 401 приложение решило бы, что кончилась сессия.
      // Сбой сети при загрузке ключей Google — не вина клиента, уходит как 500
      if (String((error as { code?: string })?.code ?? '').startsWith('auth/')) {
        throw new BadRequestException('INVALID_ID_TOKEN');
      }
      throw error;
    }

    const identity = identityFromToken(decoded);

    if (identity.provider !== 'phone' && !identity.email) {
      identity.email = await this.providerEmail(decoded.uid, identity.provider);
    }

    return identity;
  }

  // В режиме «несколько аккаунтов на одну почту» (так настроен проект)
  // Firebase не кладёт почту ни в пользователя, ни в токен — она есть
  // только в данных провайдера. Почта нужна лишь админке, поэтому сбой
  // здесь вход не ломает
  private async providerEmail(
    uid: string,
    provider: 'google' | 'apple',
  ): Promise<string | null> {
    try {
      const user = await getFirebaseApp().auth().getUser(uid);
      const providerId = provider === 'google' ? 'google.com' : 'apple.com';
      return user.providerData.find(p => p.providerId === providerId)?.email ?? null;
    } catch {
      return null;
    }
  }
}

export function identityFromToken(
  decoded: Pick<DecodedIdToken, 'firebase' | 'email' | 'phone_number'>,
): VerifiedIdentity {
  const identities = decoded.firebase?.identities ?? {};
  const first = (key: string): string | null => {
    const value = identities[key]?.[0];
    return value ? String(value) : null;
  };

  switch (decoded.firebase?.sign_in_provider) {
    case 'google.com': {
      const subject = first('google.com');
      if (!subject) break;
      return { provider: 'google', subject, email: decoded.email ?? null };
    }

    case 'apple.com': {
      const subject = first('apple.com');
      if (!subject) break;
      return { provider: 'apple', subject, email: decoded.email ?? null };
    }

    case 'phone': {
      // Только болгарские номера. В Firebase это же ограничение стоит
      // политикой регионов SMS — здесь страховка, если её снимут
      const phone = decoded.phone_number;
      if (!phone?.startsWith('+359')) {
        throw new BadRequestException('PHONE_COUNTRY_NOT_ALLOWED');
      }
      return { provider: 'phone', subject: phone };
    }
  }

  throw new BadRequestException('UNSUPPORTED_PROVIDER');
}
