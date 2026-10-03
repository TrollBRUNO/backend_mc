import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

// Способы входа помимо логина и пароля
export type IdentityProvider = 'google' | 'apple' | 'phone';
export const IDENTITY_PROVIDERS: readonly IdentityProvider[] = ['google', 'apple', 'phone'];

export function isIdentityProvider(value: unknown): value is IdentityProvider {
  return IDENTITY_PROVIDERS.includes(value as IdentityProvider);
}

// Кто человек по мнению Google, Apple или оператора связи. Берётся только
// из проверенного токена Firebase — присланному клиентом id не верим
export interface VerifiedIdentity {
  provider: IdentityProvider;
  // Google и Apple — постоянный id аккаунта у них, телефон — номер +359…
  subject: string;
  email?: string | null;
}

// Поле аккаунта, где лежит идентификатор способа входа
export const IDENTITY_FIELD = {
  google: 'google_id',
  apple: 'apple_id',
  phone: 'phone',
} as const satisfies Record<IdentityProvider, string>;

// Почта, которую отдали Google или Apple, — для админки
export const EMAIL_FIELD = {
  google: 'google_email',
  apple: 'apple_email',
} as const;

export function emailFieldOf(provider: IdentityProvider): string | null {
  return provider === 'phone' ? null : EMAIL_FIELD[provider];
}

export interface LoginMethods {
  password: boolean;
  google: { email: string | null } | null;
  apple: { email: string | null } | null;
  phone: string | null;
}

export function loginMethodsOf(account: {
  password?: string | null;
  google_id?: string | null;
  google_email?: string | null;
  apple_id?: string | null;
  apple_email?: string | null;
  phone?: string | null;
}): LoginMethods {
  return {
    password: !!account.password,
    google: account.google_id ? { email: account.google_email ?? null } : null,
    apple: account.apple_id ? { email: account.apple_email ?? null } : null,
    phone: account.phone ?? null,
  };
}

export function countLoginMethods(methods: LoginMethods): number {
  return [methods.password, methods.google, methods.apple, methods.phone]
    .filter(Boolean).length;
}

// Дата регистрации. У аккаунтов, заведённых до появления created_at,
// берём время создания записи — оно зашито в _id
export function accountCreatedAt(account: { _id: any; created_at?: Date | null }): Date {
  return account.created_at ?? new Types.ObjectId(String(account._id)).getTimestamp();
}

// Болгарский мобильный в виде +3598XXXXXXXX. Принимает +359…, 00359…,
// 359… и местный 08…. Всё остальное, включая номера других стран, — null
export function normalizeBgPhone(raw: string): string | null {
  const compact = String(raw ?? '').replace(/[\s()-]/g, '');

  let national: string;
  if (compact.startsWith('+359')) national = compact.slice(4);
  else if (compact.startsWith('00359')) national = compact.slice(5);
  else if (compact.startsWith('359')) national = compact.slice(3);
  else if (compact.startsWith('0')) national = compact.slice(1);
  else return null;

  // +359 0888… — ноль после кода страны тоже встречается
  if (national.startsWith('0')) national = national.slice(1);

  return /^[89]\d{8}$/.test(national) ? `+359${national}` : null;
}

// Цифры из поискового запроса админа в виде, в каком они стоят в +359…:
// «0888 12» ищется как «35988812». Запрос с буквами (логин, номер карты)
// и меньше трёх цифр — не телефон
export function phoneSearchDigits(query: string): string | null {
  const text = String(query ?? '').trim();
  if (!/^[+\d\s()-]+$/.test(text)) return null;

  const digits = text.replace(/\D/g, '');
  if (digits.length < 3) return null;
  return digits.startsWith('0') ? `359${digits.replace(/^0+/, '')}` : digits;
}

const LOGIN_PATTERN = /^[\p{L}\p{N}_.-]{6,32}$/u;

// Логин, который человек выбирает сам в настройках. Префикс deleted_
// занят: им помечаются логины удалённых аккаунтов
export function validateLogin(raw: unknown): string {
  const login = String(raw ?? '').trim();
  if (!LOGIN_PATTERN.test(login) || login.toLowerCase().startsWith('deleted_')) {
    throw new BadRequestException('INVALID_LOGIN');
  }
  return login;
}

// Те же правила, что у формы регистрации в приложении
export function validatePassword(raw: unknown): string {
  const password = String(raw ?? '');
  if (password.length < 6 || /^\d+$/.test(password)) {
    throw new BadRequestException('INVALID_PASSWORD');
  }
  return password;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000;
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
