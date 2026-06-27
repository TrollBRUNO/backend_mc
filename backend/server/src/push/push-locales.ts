export enum Locale {
  BG = 'bg',
  EN = 'en',
  RU = 'ru',
}

export type PushType =
  | 'wheel_ready'
  | 'bonus_12h'
  | 'bonus_1h'
  | 'jackpot_mini'
  | 'jackpot_middle'
  | 'jackpot_mega'
  | 'nightly_reminder'
  | 'news'
  | 'gallery'
  | 'test';

export interface PushPayload {
  title: string;
  body: string;
}

const PUSHES: Record<PushType, Record<Locale, PushPayload>> = {
  wheel_ready: {
    [Locale.BG]: {
      title: 'Колелото е готово!',
      body: 'Можете отново да завъртите колелото на късмета.',
    },
    [Locale.EN]: {
      title: 'Wheel is ready!',
      body: 'You can spin the lucky wheel again.',
    },
    [Locale.RU]: {
      title: 'Колесо готово!',
      body: 'Вы можете снова крутить колесо удачи.',
    },
  },
  bonus_12h: {
    [Locale.BG]: {
      title: 'Можете да вземете бонуса!',
      body: 'Не забравяйте да вземете своя бонус.',
    },
    [Locale.EN]: {
      title: 'You can claim your bonus!',
      body: 'Don’t forget to claim your bonus.',
    },
    [Locale.RU]: {
      title: 'Вы можете забрать бонус!',
      body: 'Не забудьте забрать свой бонус.',
    },
  },
  bonus_1h: {
    [Locale.BG]: {
      title: 'Бонусът скоро ще изтече!',
      body: 'Имате още 1 час да вземете бонуса си.',
    },
    [Locale.EN]: {
      title: 'Bonus is about to expire!',
      body: 'You have 1 hour left to claim your bonus.',
    },
    [Locale.RU]: {
      title: 'Бонус скоро сгорит!',
      body: 'У вас остался 1 час, чтобы забрать бонус.',
    },
  },
  jackpot_mini: {
    [Locale.BG]: {
      title: 'Mini Jackpot расте!',
      body: 'Проверьте текущия jackpot в зала.',
    },
    [Locale.EN]: {
      title: 'Mini Jackpot is growing!',
      body: 'Check the current jackpot in the hall.',
    },
    [Locale.RU]: {
      title: 'Mini Jackpot растёт!',
      body: 'Проверьте текущий джекпот в зале.',
    },
  },
  jackpot_middle: {
    [Locale.BG]: {
      title: 'Middle Jackpot расте!',
      body: 'Проверьте текущия jackpot в зала.',
    },
    [Locale.EN]: {
      title: 'Middle Jackpot is growing!',
      body: 'Check the current jackpot in the hall.',
    },
    [Locale.RU]: {
      title: 'Middle Jackpot растёт!',
      body: 'Проверьте текущий джекпот в зале.',
    },
  },
  jackpot_mega: {
    [Locale.BG]: {
      title: 'Mega Jackpot расте!',
      body: 'Проверьте текущия jackpot в зала.',
    },
    [Locale.EN]: {
      title: 'Mega Jackpot is growing!',
      body: 'Check the current jackpot in the hall.',
    },
    [Locale.RU]: {
      title: 'Mega Jackpot растёт!',
      body: 'Проверьте текущий джекпот в зале.',
    },
  },
  nightly_reminder: {
    [Locale.BG]: {
      title: 'Не забравяйте!',
      body: 'Посетете казиното – късметът ви очаква!',
    },
    [Locale.EN]: {
      title: "Don't forget!",
      body: 'Visit the casino — luck is waiting for you!',
    },
    [Locale.RU]: {
      title: 'Не забывайте!',
      body: 'Загляните в казино — вас ждёт удача!',
    },
  },
  news: {
    [Locale.BG]: {
      title: 'Нова новина!',
      body: 'В галерията има нов пост.',
    },
    [Locale.EN]: {
      title: 'New news!',
      body: 'A new post is available in the gallery.',
    },
    [Locale.RU]: {
      title: 'Новая новость!',
      body: 'В галерее появился новый пост.',
    },
  },
  gallery: {
    [Locale.BG]: {
      title: 'Нов win!',
      body: 'В галерията има нов победен пост.',
    },
    [Locale.EN]: {
      title: 'New win!',
      body: 'There is a new win post in the gallery.',
    },
    [Locale.RU]: {
      title: 'Новый выигрыш!',
      body: 'В галерее появился новый выигрыш.',
    },
  },
  test: {
    [Locale.BG]: {
      title: 'Тестово уведомление',
      body: 'Пуш работи!',
    },
    [Locale.EN]: {
      title: 'Test notification',
      body: 'Push works!',
    },
    [Locale.RU]: {
      title: 'Тестовое уведомление',
      body: 'Пуш работает!',
    },
  },
};

export function normalizeLocale(locale?: string | null): Locale {
  const normalized = locale?.toLowerCase();

  if (normalized === Locale.EN || normalized === Locale.RU) {
    return normalized as Locale;
  }

  return Locale.BG;
}

export function getPushPayload(type: PushType, locale?: string | null): PushPayload {
  const normalizedLocale = normalizeLocale(locale);
  return PUSHES[type][normalizedLocale] ?? PUSHES[type][Locale.BG];
}
