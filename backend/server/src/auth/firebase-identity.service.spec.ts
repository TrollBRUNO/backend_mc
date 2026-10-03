import { identityFromToken } from './firebase-identity.service';

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
