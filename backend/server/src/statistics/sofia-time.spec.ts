import { sofiaDayEnd, sofiaDayStart, sofiaOffsetMinutes } from './sofia-time';

describe('время по Софии', () => {
  it('смещение: +3 летом, +2 зимой', () => {
    expect(sofiaOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(180);
    expect(sofiaOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(120);
  });

  it('начало суток летом и зимой', () => {
    expect(sofiaDayStart('2026-07-15').toISOString()).toBe('2026-07-14T21:00:00.000Z');
    expect(sofiaDayStart('2026-01-15').toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('в день перехода на летнее время полночь ещё зимняя', () => {
    // 29 марта 2026 часы переводят в 03:00 по Софии
    expect(sofiaDayStart('2026-03-29').toISOString()).toBe('2026-03-28T22:00:00.000Z');
    expect(sofiaDayEnd('2026-03-29').toISOString()).toBe('2026-03-29T21:00:00.000Z');
  });

  it('в день перехода на зимнее время полночь ещё летняя', () => {
    // 25 октября 2026 часы переводят в 04:00 по Софии
    expect(sofiaDayStart('2026-10-25').toISOString()).toBe('2026-10-24T21:00:00.000Z');
    expect(sofiaDayEnd('2026-10-25').toISOString()).toBe('2026-10-25T22:00:00.000Z');
  });

  it('конец суток переходит через конец месяца и года', () => {
    expect(sofiaDayEnd('2026-12-31').toISOString()).toBe('2026-12-31T22:00:00.000Z');
  });

  it('мусор вместо даты — INVALID_DATE', () => {
    expect(() => sofiaDayStart('15.07.2026')).toThrow('INVALID_DATE');
    expect(() => sofiaDayEnd('')).toThrow('INVALID_DATE');
  });
});
