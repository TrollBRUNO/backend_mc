// Подбор залов, о джекпотах которых человеку шлют уведомления.
//
// Чистые функции без зависимостей: одним и тем же кодом пользуются крон
// рассылки и экран настроек. Если бы каждый считал сам, список в настройках
// рано или поздно разошёлся бы с тем, что реально рассылается.

// Радиус, в котором зал считается «своим» для человека без карты и без выбора
export const JACKPOT_GEO_RADIUS_KM = 50;

// Позиция месячной давности уже ничего не говорит о том, куда человек ходит
export const LOCATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Координаты за пределами страны игнорируем: иначе в отпуске домашний зал
// замолчал бы, а курортные начали слать. Та же рамка, что в map_screen.dart
export const BULGARIA_BOUNDS = {
  minLat: 41.2,
  maxLat: 44.2,
  minLng: 22.3,
  maxLng: 28.6,
};

export interface AudienceCasino {
  casinoId: string;
  name: Record<string, string>;
  city: Record<string, string>;
  latitude: number | null;
  longitude: number | null;
}

export interface AudienceUser {
  cards?: { casino_id?: unknown; active?: boolean }[];
  notification_preference?: { cities?: string[]; brands?: string[] } | null;
  last_location?: { lat: number; lng: number; updated_at: Date } | null;
  casino_notification_overrides?: Map<string, boolean> | Record<string, boolean> | null;
}

// Почему зал оказался включён или выключен — нужно экрану настроек,
// чтобы объяснить человеку, откуда взялось значение
export type AudienceSource = 'manual' | 'card' | 'preference' | 'location' | 'all';

export interface AudienceEntry {
  casinoId: string;
  enabled: boolean;
  source: AudienceSource;
}

function canonicalKey(record: Record<string, string> | undefined): string {
  if (!record) return '';
  return record.en ?? record.bg ?? Object.values(record)[0] ?? '';
}

function overridesOf(user: AudienceUser): Map<string, boolean> {
  const raw = user.casino_notification_overrides;
  if (!raw) return new Map();
  if (raw instanceof Map) return new Map(raw);
  return new Map(Object.entries(raw));
}

// Расстояние по большому кругу. Своя формула, а не $geoNear: залов единицы,
// они уже лежат в памяти, и переводить координаты в GeoJSON ради индекса
// на десяток точек незачем
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Залы привязанных карт: человек прямо сказал, куда ходит
function fromCards(user: AudienceUser): Set<string> {
  const ids = (user.cards ?? [])
    .filter(card => card.active && card.casino_id)
    .map(card => String(card.casino_id));

  return new Set(ids);
}

// Города и сети, выбранные при регистрации. Списки независимы:
// пустой список означает «любой», а не «ни одного»
function fromPreference(
  user: AudienceUser,
  casinos: AudienceCasino[],
): Set<string> | null {
  const cities = user.notification_preference?.cities ?? [];
  const brands = user.notification_preference?.brands ?? [];

  if (!cities.length && !brands.length) return null;

  const matched = casinos.filter(casino => {
    const cityOk = cities.length === 0 || cities.includes(canonicalKey(casino.city));
    const brandOk = brands.length === 0 || brands.includes(canonicalKey(casino.name));
    return cityOk && brandOk;
  });

  // Выбор, под который не подошёл ни один зал (закрыли, переименовали),
  // не должен приводить к тишине — пусть работает следующий шаг цепочки
  return matched.length ? new Set(matched.map(c => c.casinoId)) : null;
}

// Залы рядом с последней известной позицией
function fromLocation(
  user: AudienceUser,
  casinos: AudienceCasino[],
): Set<string> | null {
  const location = user.last_location;
  if (!location?.updated_at) return null;

  if (Date.now() - new Date(location.updated_at).getTime() > LOCATION_MAX_AGE_MS) {
    return null;
  }

  const { minLat, maxLat, minLng, maxLng } = BULGARIA_BOUNDS;
  if (
    location.lat < minLat || location.lat > maxLat ||
    location.lng < minLng || location.lng > maxLng
  ) {
    return null;
  }

  // Зал без проставленных координат в подборе не участвует вообще —
  // пропускаем его и смотрим следующий по близости
  const measured = casinos
    .filter(c => c.latitude != null && c.longitude != null)
    .map(c => ({
      id: c.casinoId,
      km: distanceKm(location.lat, location.lng, c.latitude!, c.longitude!),
    }));

  if (measured.length === 0) return null;

  const near = measured.filter(m => m.km <= JACKPOT_GEO_RADIUS_KM);

  // В радиусе пусто — берём один ближайший, чтобы человек не остался
  // совсем без уведомлений
  if (near.length === 0) {
    const closest = measured.reduce((a, b) => (b.km < a.km ? b : a));
    return new Set([closest.id]);
  }

  return new Set(near.map(m => m.id));
}

/**
 * Полная картина по каждому залу: включён он для этого человека или нет
 * и откуда взялось значение.
 *
 * Порядок такой:
 *   1. явный выбор — карты плюс города и сети из регистрации, они складываются
 *   2. последняя геопозиция — только если ничего явного не выбрано
 *   3. все залы — иначе включённый тумблер молчал бы без объяснений
 *
 * Поверх всего ложатся ручные переключатели. Выключенный руками зал остаётся
 * выключенным, даже если потом привязали его карту, — иначе выключатель
 * не выключал бы.
 */
export function resolveJackpotAudience(
  user: AudienceUser,
  casinos: AudienceCasino[],
): AudienceEntry[] {
  const cards = fromCards(user);
  const preference = fromPreference(user, casinos);

  let automatic: Set<string> | null;
  let source: AudienceSource;

  if (cards.size || preference) {
    automatic = new Set([...cards, ...(preference ?? [])]);
    source = cards.size ? 'card' : 'preference';
  } else {
    const location = fromLocation(user, casinos);
    if (location) {
      automatic = location;
      source = 'location';
    } else {
      automatic = null;
      source = 'all';
    }
  }

  const overrides = overridesOf(user);

  return casinos.map(casino => {
    const override = overrides.get(casino.casinoId);

    if (override !== undefined) {
      return { casinoId: casino.casinoId, enabled: override, source: 'manual' as const };
    }

    const enabled = automatic === null || automatic.has(casino.casinoId);

    // Источник указываем только у включённых: у выключенного он ничего
    // не объясняет — зал просто не подошёл ни под одно правило
    return {
      casinoId: casino.casinoId,
      enabled,
      source: enabled ? source : ('all' as const),
    };
  });
}

/** Только идентификаторы включённых залов — то, что нужно рассылке. */
export function enabledCasinoIds(
  user: AudienceUser,
  casinos: AudienceCasino[],
): Set<string> {
  return new Set(
    resolveJackpotAudience(user, casinos)
      .filter(entry => entry.enabled)
      .map(entry => entry.casinoId),
  );
}
