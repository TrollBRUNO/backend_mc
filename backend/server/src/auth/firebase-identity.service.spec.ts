import {
  FirebaseIdentityService,
  identityFromToken,
} from './firebase-identity.service';
import { getFirebaseApp } from '../firebase/firebase-app';

jest.mock('../firebase/firebase-app', () => ({ getFirebaseApp: jest.fn() }));

describe('FirebaseIdentityService.verify', () => {
  const googleToken = {
    uid: 'firebase-uid',
    firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['g-1'] } },
  };

  const mockFirebase = (getUser: () => Promise<any>) =>
    (getFirebaseApp as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: async () => googleToken, getUser }),
    });

  it('почту берёт у провайдера, когда в токене её нет (режим нескольких аккаунтов)', async () => {
    mockFirebase(async () => ({
      providerData: [
        { providerId: 'apple.com', email: 'other@icloud.com' },
        { providerId: 'google.com', email: 'ivan@gmail.com' },
      ],
    }));

    await expect(new FirebaseIdentityService().verify('id-token')).resolves.toEqual({
      provider: 'google',
      subject: 'g-1',
      email: 'ivan@gmail.com',
    });
  });

  it('сбой при чтении пользователя вход не ломает — просто без почты', async () => {
    mockFirebase(async () => {
      throw new Error('network');
    });

    await expect(new FirebaseIdentityService().verify('id-token')).resolves.toMatchObject({
      provider: 'google',
      subject: 'g-1',
      email: null,
    });
  });
});

const token = (provider: string, extra: Record<string, any> = {}) =>
  ({
    firebase: { sign_in_provider: provider, identities: extra.identities ?? {} },
    email: extra.email,
    phone_number: extra.phone_number,
  }) as any;

describe('identityFromToken', () => {
  it('Google — id аккаунта Google и почта', () => {
    expect(
      identityFromToken(
        token('google.com', {
          identities: { 'google.com': ['1234567890'] },
          email: 'ivan@gmail.com',
        }),
      ),
    ).toEqual({ provider: 'google', subject: '1234567890', email: 'ivan@gmail.com' });
  });

  it('Apple — id Apple и почта, в том числе скрытая', () => {
    expect(
      identityFromToken(
        token('apple.com', {
          identities: { 'apple.com': ['001234.abcd'] },
          email: 'x1y2@privaterelay.appleid.com',
        }),
      ),
    ).toEqual({
      provider: 'apple',
      subject: '001234.abcd',
      email: 'x1y2@privaterelay.appleid.com',
    });
  });

  it('телефон — номер +359', () => {
    expect(identityFromToken(token('phone', { phone_number: '+359888123456' }))).toEqual({
      provider: 'phone',
      subject: '+359888123456',
    });
  });

  it('номер другой страны — отказ', () => {
    expect(() => identityFromToken(token('phone', { phone_number: '+30691234567' }))).toThrow(
      'PHONE_COUNTRY_NOT_ALLOWED',
    );
  });

  it('прочие способы Firebase (почта, custom-токен) — отказ', () => {
    expect(() => identityFromToken(token('password'))).toThrow('UNSUPPORTED_PROVIDER');
    expect(() => identityFromToken(token('custom'))).toThrow('UNSUPPORTED_PROVIDER');
  });

  it('Google без id — отказ', () => {
    expect(() => identityFromToken(token('google.com'))).toThrow('UNSUPPORTED_PROVIDER');
  });
});
