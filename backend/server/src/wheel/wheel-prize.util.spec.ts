import { randomItem, sameWheel, sectorsOf } from './wheel-prize.util';

// Колесо с боевого сервера на 09.10.2026
const WHEEL = [25, 25, 50, 25, 100, 25, 50, 25, 100, 25, 25, 50, 25, 150, 25, 50, 25, 100];

describe('sameWheel', () => {
  it('принимает колесо из GET /wheel', () => {
    expect(sameWheel([...WHEEL], WHEEL)).toBe(true);
  });

  it('порядок секторов не важен', () => {
    expect(sameWheel([...WHEEL].reverse(), WHEEL)).toBe(true);
  });

  it('не пускает подставленное колесо', () => {
    expect(sameWheel([150], WHEEL)).toBe(false);
    expect(sameWheel(WHEEL.map(() => 150), WHEEL)).toBe(false);
  });

  it('не пускает устаревшее колесо', () => {
    expect(sameWheel([...WHEEL.slice(1), 20], WHEEL)).toBe(false);
    expect(sameWheel(WHEEL.slice(1), WHEEL)).toBe(false);
  });

  it('не пускает мусор', () => {
    expect(sameWheel(undefined, WHEEL)).toBe(false);
    expect(sameWheel('25', WHEEL)).toBe(false);
  });
});

describe('sectorsOf', () => {
  it('находит все секторы с призом', () => {
    expect(sectorsOf(WHEEL, 150)).toEqual([13]);
    expect(sectorsOf(WHEEL, 100)).toEqual([4, 8, 17]);
  });

  it('суммы не с колеса нет ни в одном секторе', () => {
    expect(sectorsOf(WHEEL, 20)).toEqual([]);
  });
});

describe('randomItem', () => {
  it('берёт элемент по случайному числу', () => {
    expect(randomItem([10, 20, 30], () => 0)).toBe(10);
    expect(randomItem([10, 20, 30], () => 0.5)).toBe(20);
    expect(randomItem([10, 20, 30], () => 0.999)).toBe(30);
  });
});
