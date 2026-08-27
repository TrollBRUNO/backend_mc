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

  type Levels = {
    mini: number | null;
    middle: number | null;
    mega: number | null;
  };

  const snapshot = (
    casinoId: Types.ObjectId,
    previous: Levels | null,
    current: Levels,
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

  // Подбор залов крон считает по полному списку казино, а не по снапшотам.
  // В тестах списки совпадают, поэтому собираем аудиторию из тех же данных
  const audienceOf = (snapshots: any[]) =>
    snapshots.map(s => ({
      casinoId: String(s.casinoId),
      name: s.name,
      city: s.city,
      latitude: s.latitude,
      longitude: s.longitude,
    }));

  const find = (u: any, snapshots: any[], audience = audienceOf(snapshots)) =>
    (service as any).findBestCrossing(u, snapshots, audience);

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

  // Источник может отдать меньше трёх пулов или ноль у неинициализированного:
  // такой уровень приходит null и в сравнении не участвует
  it('пропускает уровень без замера, но видит пересечение на соседнем', () => {
    const result = find(user(), [
      snapshot(
        casinoA,
        { mini: 90, middle: null, mega: null },
        { mini: 120, middle: null, mega: null },
      ),
    ]);

    expect(result?.type).toBe(NotificationLogType.JACKPOT_MINI);
  });

  it('не шлёт по уровню, которого у источника нет', () => {
    const result = find(user(), [
      snapshot(
        casinoA,
        { mini: null, middle: null, mega: 1900 },
        { mini: null, middle: null, mega: 1950 },
      ),
    ]);

    expect(result).toBeNull();
  });

  // Города и сети из регистрации пересекаются: MegaBet в Кирково подходит,
  // Magic City в Пловдиве — нет, хотя город тоже выбран
  it('молчит про зал, не прошедший по выбору городов и сетей', () => {
    const plovdiv = snapshot(
      casinoA,
      { mini: 90, middle: 200, mega: 900 },
      { mini: 120, middle: 200, mega: 900 },
      PLOVDIV,
      'Magic City',
      'Plovdiv',
    );
    const kirkovo = snapshot(
      casinoB,
      { mini: 90, middle: 200, mega: 900 },
      { mini: 95, middle: 600, mega: 900 },
      KIRKOVO,
      'MegaBet',
      'Kirkovo',
    );

    const result = find(
      user({ preference: { cities: ['Plovdiv', 'Kirkovo'], brands: ['MegaBet'] } }),
      [plovdiv, kirkovo],
    );

    expect(result?.type).toBe(NotificationLogType.JACKPOT_MIDDLE);
    expect(String(result?.casinoId)).toBe(String(casinoB));
  });

  // Зал, чей джекпот-сервер не ответил, выпадает из снапшотов, но не из
  // подбора: иначе выбор пользователя схлопнулся бы и его подменила геопозиция
  it('не расширяет подбор залов, когда источник зала не ответил', () => {
    const plovdiv = snapshot(
      casinoA,
      { mini: 90, middle: 200, mega: 900 },
      { mini: 120, middle: 200, mega: 900 },
      PLOVDIV,
      'Magic City',
      'Plovdiv',
    );
    const kirkovoOffline = {
      casinoId: String(casinoC),
      name: { en: 'MegaBet' },
      city: { en: 'Kirkovo' },
      latitude: KIRKOVO.lat,
      longitude: KIRKOVO.lng,
    };

    const result = find(
      user({
        preference: { cities: ['Kirkovo'], brands: ['MegaBet'] },
        location: { ...PLOVDIV, updated_at: new Date() },
      }),
      [plovdiv],
      [...audienceOf([plovdiv]), kirkovoOffline],
    );

    expect(result).toBeNull();
  });
});
