import { Types } from 'mongoose';
import {
  accountCreatedAt,
  countLoginMethods,
  escapeRegex,
  loginMethodsOf,
  normalizeBgPhone,
  phoneSearchDigits,
  validateLogin,
  validatePassword,
} from './identity.util';

describe('normalizeBgPhone', () => {
  it.each([
    ['+359888123456', '+359888123456'],
    ['+359 888 123 456', '+359888123456'],
    ['0888123456', '+359888123456'],
    ['0888 12 34 56', '+359888123456'],
    ['00359888123456', '+359888123456'],
    ['359888123456', '+359888123456'],
    ['+3590888123456', '+359888123456'],
    ['+359987654321', '+359987654321'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBgPhone(input)).toBe(expected);
  });

  it.each([
    '+30691234567', // Греция
    '+905321234567', // Турция
    '+79161234567', // Россия
    '0888123', // короткий
    '+35921234567', // городской, по SMS не подтвердить
    'abc',
    '',
  ])('%s — не болгарский мобильный', input => {
    expect(normalizeBgPhone(input)).toBeNull();
  });
});

describe('phoneSearchDigits', () => {
  it('местный 08… ищется как 3598…', () => {
    expect(phoneSearchDigits('0888 12')).toBe('35988812');
  });

  it('+359 оставляет как есть', () => {
    expect(phoneSearchDigits('+359 888')).toBe('359888');
  });

  it('логины и номера карт телефоном не считаются', () => {
    expect(phoneSearchDigits('BonusBatko777')).toBeNull();
    expect(phoneSearchDigits('GOTSE-123456')).toBeNull();
  });

  it('меньше трёх цифр — не телефон', () => {
    expect(phoneSearchDigits('08')).toBeNull();
  });
});

describe('validateLogin', () => {
  it('пропускает ник, кириллицу и знаки _ . -', () => {
    expect(validateLogin('  BonusBatko77 ')).toBe('BonusBatko77');
    expect(validateLogin('Иван_88')).toBe('Иван_88');
    expect(validateLogin('ivan.p-88')).toBe('ivan.p-88');
  });

  it.each(['short', 'with space', '<script>', 'deleted_abc', 'a'.repeat(33)])(
    'отклоняет «%s»',
    login => {
      expect(() => validateLogin(login)).toThrow('INVALID_LOGIN');
    },
  );
});

describe('validatePassword', () => {
  it('от 6 символов и не только цифры', () => {
    expect(validatePassword('secret1')).toBe('secret1');
    expect(() => validatePassword('12345')).toThrow('INVALID_PASSWORD');
    expect(() => validatePassword('123456')).toThrow('INVALID_PASSWORD');
  });
});

describe('loginMethodsOf', () => {
  it('собирает способы входа и считает их', () => {
    const methods = loginMethodsOf({
      password: 'hash',
      google_id: 'g-1',
      google_email: 'ivan@gmail.com',
      apple_id: null,
      phone: '+359888123456',
    });

    expect(methods).toEqual({
      password: true,
      google: { email: 'ivan@gmail.com' },
      apple: null,
      phone: '+359888123456',
    });
    expect(countLoginMethods(methods)).toBe(3);
  });
});

describe('accountCreatedAt', () => {
  it('у старого аккаунта без created_at берёт время из _id', () => {
    const id = new Types.ObjectId(Math.floor(Date.UTC(2025, 0, 15) / 1000).toString(16) + '0000000000000000');
    expect(accountCreatedAt({ _id: id }).toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });

  it('если created_at есть — берёт его', () => {
    const created = new Date('2026-10-01T10:00:00Z');
    expect(accountCreatedAt({ _id: new Types.ObjectId(), created_at: created })).toBe(created);
  });
});

describe('escapeRegex', () => {
  it('делает «+359» безопасным для RegExp', () => {
    expect(() => new RegExp(escapeRegex('+359'))).not.toThrow();
    expect(new RegExp(escapeRegex('+359')).test('+359888')).toBe(true);
  });
});
