import { Types } from 'mongoose';
import { TasksService } from './tasks.service';
import { NotificationLogType } from '../notification-log/notification-log.schema';

// Проверяем именно решение «слать или нет»: пуш уходит в момент пересечения
// порога, а не всё время, пока джекпот выше него.
//
// findBestCrossing приватный, но это и есть вся суть блока — дёргаем его
// напрямую, чтобы не поднимать вокруг него монгу и firebase
describe('TasksService — пересечение порога джекпота', () => {
  const casinoA = new Types.ObjectId();
  const casinoB = new Types.ObjectId();
  const casinoC = new Types.ObjectId();

  // Зависимости не используются в findBestCrossing, поэтому конструктор
  // получает заглушки
  const service = new TasksService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const user = (opts: {
    thresholds?: { mini: number; middle: number; mega: number };
    cards?: { casino_id: Types.ObjectId; active: boolean }[];
    location?: { lat: number; lng: number; updated_at: Date } | null;
    preference?: { cities: string[]; brands: string[] } | null;
  } = {}) =>
    ({
      login: 'tester',
      cards: opts.cards ?? [],
      last_location: opts.location ?? null,
      notification_preference: opts.preference ?? null,
      notification_settings: {
        jackpot_thresholds: opts.thresholds ?? { mini: 100, middle: 500, mega: 2000 },
      },
    }) as any;

  // Пловдив и Кирково — между ними около 130 км
  const PLOVDIV = { lat: 42.14, lng: 24.75 };
  const KIRKOVO = { lat: 41.34, lng: 25.36 };

  const snapshot = (
    casinoId: Types.ObjectId,
    previous: { mini: number; middle: number; mega: number } | null,
    current: { mini: number; middle: number; mega: number },
    coords: { lat: number; lng: number } | null = null,
    brand: string = 'Magic City',
    cityName: string = 'Plovdiv',
  ) => ({
    casinoId,
    name: { en: brand },
    city: { en: cityName },
    address: { bg: 'Адрес' },
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    previous,
    current,
  });

  const grew = { previous: { mini: 90, middle: 200, mega: 900 }, current: { mini: 120, middle: 200, mega: 900 } };

  const find = (u: any, snapshots: any[]) =>
    (service as any).findBestCrossing(u, snapshots);

  it('шлёт, когда джекпот дорос до порога', () => {
    const result = find(user(), [
      snapshot(casinoA, { mini: 90, middle: 200, mega: 900 }, { mini: 120, middle: 200, mega: 900 }),
    ]);

    expect(result?.type).toBe(NotificationLogType.JACKPOT_MINI);
    expect(result?.value).toBe(120);
  });

  it('молчит, пока джекпот просто держится выше порога', () => {
    const result = find(user(), [
      snapshot(casinoA, { mini: 120, middle: 200, mega: 900 }, { mini: 150, middle: 200, mega: 900 }),
    ]);

    expect(result).toBeNull();
  });

  it('молчит на первом замере, когда сравнивать не с чем', () => {
    const result = find(user(), [
      snapshot(casinoA, null, { mini: 900, middle: 4000, mega: 9000 }),
    ]);

    expect(result).toBeNull();
  });

  it('снова шлёт после того, как джекпот выпал и дорос заново', () => {
    const dropped = find(user(), [
      snapshot(casinoA, { mini: 150, middle: 200, mega: 900 }, { mini: 10, middle: 200, mega: 900 }),
    ]);
    expect(dropped).toBeNull();

    const regrown = find(user(), [
      snapshot(casinoA, { mini: 10, middle: 200, mega: 900 }, { mini: 130, middle: 200, mega: 900 }),
    ]);
    expect(regrown?.type).toBe(NotificationLogType.JACKPOT_MINI);
  });

  it('порог 0 выключает уровень, а не шлёт по любой сумме', () => {
    const result = find(user({ thresholds: { mini: 0, middle: 0, mega: 2000 } }), [
      snapshot(casinoA, { mini: 0, middle: 0, mega: 900 }, { mini: 500, middle: 3000, mega: 1500 }),
    ]);

    expect(result).toBeNull();
  });

  it('из нескольких одновременных пересечений выбирает старший уровень', () => {
    const result = find(user(), [
      snapshot(casinoA, { mini: 90, middle: 400, mega: 1900 }, { mini: 120, middle: 600, mega: 2500 }),
    ]);

    expect(result?.type).toBe(NotificationLogType.JACKPOT_MEGA);
    expect(result?.value).toBe(2500);
  });

});
