export enum Locale {
  BG = 'bg',
  EL = 'el',
  EN = 'en',
  RU = 'ru',
  TR = 'tr',
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
    [Locale.EL]: {
      title: 'Ο τροχός είναι έτοιμος!',
      body: 'Μπορείτε να γυρίσετε ξανά τον τροχό της τύχης.',
    },
    [Locale.EN]: {
      title: 'Wheel is ready!',
      body: 'You can spin the lucky wheel again.',
    },
    [Locale.RU]: {
      title: 'Колесо готово!',
      body: 'Вы можете снова крутить колесо удачи.',
    },
    [Locale.TR]: {
      title: 'Çark hazır!',
      body: 'Şans çarkını tekrar çevirebilirsiniz.',
    },
  },
  bonus_12h: {
    [Locale.BG]: {
      title: 'Можете да вземете бонуса!',
      body: 'Не забравяйте да вземете своя бонус.',
    },
    [Locale.EL]: {
      title: 'Μπορείτε να παραλάβετε το μπόνους σας!',
      body: 'Μην ξεχάσετε να παραλάβετε το μπόνους σας.',
    },
    [Locale.EN]: {
      title: 'You can claim your bonus!',
      body: 'Don’t forget to claim your bonus.',
    },
    [Locale.RU]: {
      title: 'Вы можете забрать бонус!',
      body: 'Не забудьте забрать свой бонус.',
    },
    [Locale.TR]: {
      title: 'Bonusunuzu alabilirsiniz!',
      body: 'Bonusunuzu almayı unutmayın.',
    },
  },
  bonus_1h: {
    [Locale.BG]: {
      title: 'Бонусът скоро ще изтече!',
      body: 'Имате още 1 час да вземете бонуса си.',
    },
    [Locale.EL]: {
      title: 'Το μπόνους λήγει σύντομα!',
      body: 'Σας απομένει 1 ώρα για να παραλάβετε το μπόνους σας.',
    },
    [Locale.EN]: {
      title: 'Bonus is about to expire!',
      body: 'You have 1 hour left to claim your bonus.',
    },
    [Locale.RU]: {
      title: 'Бонус скоро сгорит!',
      body: 'У вас остался 1 час, чтобы забрать бонус.',
    },
    [Locale.TR]: {
      title: 'Bonusun süresi dolmak üzere!',
      body: 'Bonusunuzu almak için 1 saatiniz kaldı.',
    },
  },
  jackpot_mini: {
    [Locale.BG]: {
      title: 'Mini Jackpot расте!',
      body: 'Проверьте текущия jackpot в зала.',
    },
    [Locale.EL]: {
      title: 'Το Mini Jackpot μεγαλώνει!',
      body: 'Δείτε το τρέχον τζάκποτ στην αίθουσα.',
    },
    [Locale.EN]: {
      title: 'Mini Jackpot is growing!',
      body: 'Check the current jackpot in the hall.',
    },
    [Locale.RU]: {
      title: 'Mini Jackpot растёт!',
      body: 'Проверьте текущий джекпот в зале.',
    },
    [Locale.TR]: {
      title: 'Mini Jackpot büyüyor!',
      body: 'Salondaki güncel jackpotu kontrol edin.',
    },
  },
  jackpot_middle: {
    [Locale.BG]: {
      title: 'Middle Jackpot расте!',
      body: 'Проверьте текущия jackpot в зала.',
    },
    [Locale.EL]: {
      title: 'Το Middle Jackpot μεγαλώνει!',
      body: 'Δείτε το τρέχον τζάκποτ στην αίθουσα.',
    },
    [Locale.EN]: {
      title: 'Middle Jackpot is growing!',
      body: 'Check the current jackpot in the hall.',
    },
    [Locale.RU]: {
      title: 'Middle Jackpot растёт!',
      body: 'Проверьте текущий джекпот в зале.',
    },
    [Locale.TR]: {
      title: 'Middle Jackpot büyüyor!',
      body: 'Salondaki güncel jackpotu kontrol edin.',
    },
  },
  jackpot_mega: {
    [Locale.BG]: {
      title: 'Mega Jackpot расте!',
      body: 'Проверьте текущия jackpot в зала.',
    },
    [Locale.EL]: {
      title: 'Το Mega Jackpot μεγαλώνει!',
      body: 'Δείτε το τρέχον τζάκποτ στην αίθουσα.',
    },
    [Locale.EN]: {
      title: 'Mega Jackpot is growing!',
      body: 'Check the current jackpot in the hall.',
    },
    [Locale.RU]: {
      title: 'Mega Jackpot растёт!',
      body: 'Проверьте текущий джекпот в зале.',
    },
    [Locale.TR]: {
      title: 'Mega Jackpot büyüyor!',
      body: 'Salondaki güncel jackpotu kontrol edin.',
    },
  },
  nightly_reminder: {
    [Locale.BG]: {
      title: 'Не забравяйте!',
      body: 'Посетете казиното – късметът ви очаква!',
    },
    [Locale.EL]: {
      title: 'Μην το ξεχνάτε!',
      body: 'Επισκεφθείτε το καζίνο — η τύχη σας περιμένει!',
    },
    [Locale.EN]: {
      title: "Don't forget!",
      body: 'Visit the casino — luck is waiting for you!',
    },
    [Locale.RU]: {
      title: 'Не забывайте!',
      body: 'Загляните в казино — вас ждёт удача!',
    },
    [Locale.TR]: {
      title: 'Unutmayın!',
      body: 'Casinoya uğrayın — şans sizi bekliyor!',
    },
  },
  news: {
    [Locale.BG]: {
      title: 'Нова новина!',
      body: 'В галерията има нов пост.',
    },
    [Locale.EL]: {
      title: 'Νέα είδηση!',
      body: 'Υπάρχει νέα ανάρτηση στη γκαλερί.',
    },
    [Locale.EN]: {
      title: 'New news!',
      body: 'A new post is available in the gallery.',
    },
    [Locale.RU]: {
      title: 'Новая новость!',
      body: 'В галерее появился новый пост.',
    },
    [Locale.TR]: {
      title: 'Yeni haber!',
      body: 'Galeride yeni bir gönderi var.',
    },
  },
  gallery: {
    [Locale.BG]: {
      title: 'Нов win!',
      body: 'В галерията има нов победен пост.',
    },
    [Locale.EL]: {
      title: 'Νέα νίκη!',
      body: 'Υπάρχει νέα νικητήρια ανάρτηση στη γκαλερί.',
    },
    [Locale.EN]: {
      title: 'New win!',
      body: 'There is a new win post in the gallery.',
    },
    [Locale.RU]: {
      title: 'Новый выигрыш!',
      body: 'В галерее появился новый выигрыш.',
    },
    [Locale.TR]: {
      title: 'Yeni kazanç!',
      body: 'Galeride yeni bir kazanç gönderisi var.',
    },
  },
  test: {
    [Locale.BG]: {
      title: 'Тестово уведомление',
      body: 'Пуш работи!',
    },
    [Locale.EL]: {
      title: 'Δοκιμαστική ειδοποίηση',
      body: 'Το push λειτουργεί!',
    },
    [Locale.EN]: {
      title: 'Test notification',
      body: 'Push works!',
    },
    [Locale.RU]: {
      title: 'Тестовое уведомление',
      body: 'Пуш работает!',
    },
    [Locale.TR]: {
      title: 'Test bildirimi',
      body: 'Push çalışıyor!',
    },
  },
};

export function normalizeLocale(locale?: string | null): Locale {
  const normalized = locale?.toLowerCase();

  if (normalized && (Object.values(Locale) as string[]).includes(normalized)) {
    return normalized as Locale;
  }

  return Locale.BG;
}

export function getPushPayload(type: PushType, locale?: string | null): PushPayload {
  const normalizedLocale = normalizeLocale(locale);
  return PUSHES[type][normalizedLocale] ?? PUSHES[type][Locale.BG];
}
