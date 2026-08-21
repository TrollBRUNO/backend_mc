import {
  AudienceCasino,
  enabledCasinoIds,
  resolveJackpotAudience,
} from './jackpot-audience.util';

// Кто из залов попадёт в рассылку конкретному человеку. Одним и тем же
// кодом пользуются крон и экран настроек, поэтому правила закреплены здесь
describe('подбор залов для уведомлений о джекпотах', () => {
  // Пловдив и Кирково — между ними около 130 км
  const PLOVDIV = { lat: 42.14, lng: 24.75 };
  const KIRKOVO = { lat: 41.34, lng: 25.36 };

  const PLOVDIV_MAGIC = 'a1';
  const PLOVDIV_VEGAS = 'a2';
  const KIRKOVO_MAGIC = 'a3';

  const casinos: AudienceCasino[] = [
    { casinoId: PLOVDIV_MAGIC, name: { en: 'Magic City' }, city: { en: 'Plovdiv' }, latitude: PLOVDIV.lat, longitude: PLOVDIV.lng },
    { casinoId: PLOVDIV_VEGAS, name: { en: 'Las Vegas' },  city: { en: 'Plovdiv' }, latitude: PLOVDIV.lat, longitude: PLOVDIV.lng },
    { casinoId: KIRKOVO_MAGIC, name: { en: 'Magic City' }, city: { en: 'Kirkovo' }, latitude: KIRKOVO.lat, longitude: KIRKOVO.lng },
  ];

  const enabled = (user: any) => enabledCasinoIds(user, casinos);
  const fresh = (p: { lat: number; lng: number }) => ({ ...p, updated_at: new Date() });

  describe('выбор города и сети при регистрации', () => {
    it('город и сеть вместе — только залы на пересечении', () => {
      expect(enabled({ notification_preference: { cities: ['Plovdiv'], brands: ['Magic City'] } }))
        .toEqual(new Set([PLOVDIV_MAGIC]));
    });

    it('город без сети — все залы этого города', () => {
      expect(enabled({ notification_preference: { cities: ['Plovdiv'], brands: [] } }))
        .toEqual(new Set([PLOVDIV_MAGIC, PLOVDIV_VEGAS]));
    });

    it('сеть без города — залы этой сети в любом городе', () => {
      expect(enabled({ notification_preference: { cities: [], brands: ['Magic City'] } }))
        .toEqual(new Set([PLOVDIV_MAGIC, KIRKOVO_MAGIC]));
    });

    it('несколько городов и несколько сетей', () => {
      expect(enabled({
        notification_preference: {
          cities: ['Plovdiv', 'Kirkovo'],
          brands: ['Magic City', 'Las Vegas'],
        },
      })).toEqual(new Set([PLOVDIV_MAGIC, PLOVDIV_VEGAS, KIRKOVO_MAGIC]));
    });

    it('пустой выбор равнозначен его отсутствию', () => {
      expect(enabled({
        notification_preference: { cities: [], brands: [] },
        last_location: fresh(PLOVDIV),
      })).toEqual(new Set([PLOVDIV_MAGIC, PLOVDIV_VEGAS]));
    });

    it('под выбор не подошёл ни один зал — падаем дальше по цепочке, а не в тишину', () => {
      expect(enabled({
        notification_preference: { cities: ['Sofia'], brands: [] },
        last_location: fresh(KIRKOVO),
      })).toEqual(new Set([KIRKOVO_MAGIC]));
    });
  });

  describe('карты', () => {
    it('карта включает свой зал', () => {
      expect(enabled({ cards: [{ casino_id: KIRKOVO_MAGIC, active: true }] }))
        .toEqual(new Set([KIRKOVO_MAGIC]));
    });

    it('деактивированная карта не считается', () => {
      expect(enabled({
        cards: [{ casino_id: KIRKOVO_MAGIC, active: false }],
        last_location: fresh(PLOVDIV),
      })).toEqual(new Set([PLOVDIV_MAGIC, PLOVDIV_VEGAS]));
    });

    it('карта перебивает геолокацию', () => {
      expect(enabled({
        cards: [{ casino_id: KIRKOVO_MAGIC, active: true }],
        last_location: fresh(PLOVDIV),
      })).toEqual(new Set([KIRKOVO_MAGIC]));
    });

    it('карта складывается с выбором из регистрации', () => {
      expect(enabled({
        cards: [{ casino_id: KIRKOVO_MAGIC, active: true }],
        notification_preference: { cities: [], brands: ['Las Vegas'] },
      })).toEqual(new Set([KIRKOVO_MAGIC, PLOVDIV_VEGAS]));
    });
  });

  describe('геолокация — только когда ничего не выбрано', () => {
    it('берёт залы рядом с последней позицией', () => {
      expect(enabled({ last_location: fresh(PLOVDIV) }))
        .toEqual(new Set([PLOVDIV_MAGIC, PLOVDIV_VEGAS]));
    });

    it('если в радиусе никого — берёт один ближайший, а не молчит', () => {
      const faraway: AudienceCasino[] = [casinos[2]];
      expect(enabledCasinoIds({ last_location: fresh(PLOVDIV) }, faraway))
        .toEqual(new Set([KIRKOVO_MAGIC]));
    });

    it('зал без координат пропускается, берётся следующий ближайший', () => {
      const noCoords: AudienceCasino[] = [
        { ...casinos[0], latitude: null, longitude: null },
        casinos[2],
      ];
      expect(enabledCasinoIds({ last_location: fresh(PLOVDIV) }, noCoords))
        .toEqual(new Set([KIRKOVO_MAGIC]));
    });

    it('позиция старше месяца не учитывается — слушаем все залы', () => {
      const stale = { ...PLOVDIV, updated_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) };
      expect(enabled({ last_location: stale }).size).toBe(3);
    });

    it('позиция за границей не учитывается — слушаем все залы', () => {
      expect(enabled({ last_location: fresh({ lat: 48.85, lng: 2.35 }) }).size).toBe(3);
    });
  });

  describe('ручные переключатели', () => {
    it('выключенный руками зал не включится обратно даже после привязки карты', () => {
      expect(enabled({
        cards: [{ casino_id: PLOVDIV_MAGIC, active: true }],
        casino_notification_overrides: { [PLOVDIV_MAGIC]: false },
      })).toEqual(new Set());
    });

    it('выключение не задевает остальные залы', () => {
      expect(enabled({
        notification_preference: { cities: ['Plovdiv'], brands: [] },
        casino_notification_overrides: { [PLOVDIV_VEGAS]: false },
      })).toEqual(new Set([PLOVDIV_MAGIC]));
    });

    it('включённый руками зал приходит, даже если не подошёл ни под одно правило', () => {
      expect(enabled({
        cards: [{ casino_id: PLOVDIV_MAGIC, active: true }],
        casino_notification_overrides: { [KIRKOVO_MAGIC]: true },
      })).toEqual(new Set([PLOVDIV_MAGIC, KIRKOVO_MAGIC]));
    });

    it('выключение всех залов оставляет человека без джекпот-пушей и не откатывается на геолокацию', () => {
      expect(enabled({
        last_location: fresh(PLOVDIV),
        casino_notification_overrides: {
          [PLOVDIV_MAGIC]: false,
          [PLOVDIV_VEGAS]: false,
          [KIRKOVO_MAGIC]: false,
        },
      })).toEqual(new Set());
    });

    it('Map из mongoose понимается так же, как обычный объект', () => {
      expect(enabled({
        cards: [{ casino_id: PLOVDIV_MAGIC, active: true }],
        casino_notification_overrides: new Map([[PLOVDIV_MAGIC, false]]),
      })).toEqual(new Set());
    });
  });

  describe('картина для экрана настроек', () => {
    it('отдаёт все залы с признаком включённости и источником', () => {
      const entries = resolveJackpotAudience(
        {
          cards: [{ casino_id: PLOVDIV_MAGIC, active: true }],
          casino_notification_overrides: { [KIRKOVO_MAGIC]: true },
        },
        casinos,
      );

      expect(entries).toEqual([
        { casinoId: PLOVDIV_MAGIC, enabled: true, source: 'card' },
        { casinoId: PLOVDIV_VEGAS, enabled: false, source: 'all' },
        { casinoId: KIRKOVO_MAGIC, enabled: true, source: 'manual' },
      ]);
    });
  });
});
