// Ники для тех, кто зарегистрировался через Google, Apple или телефон.
// Человек потом может сменить свой в настройках
export const NICKNAME_BASES = [
  'BonusBatko',
  'JackpotBatka',
  'VurtachBatko',
  'SlotovTigar',
  'BonusDjado',
  'JackpotDjado',
  'DjadoJackpot',
  'BatkaNaSlotovete',
  'BatkaNaBonusite',
  'BatkaNaJackpota',
  'SpinGospodin',
  'ChichoSpin',
  'Bonusdjiq',
  'HighRoller',
  'LuckyBastard',
  'BonusMafia',
  'BonusDon',
  'JackpotDon',
  'CasinoBandit',
  'BonusTerminatori',
  'BonusBaron',
  'SpinBaron',
  'JackpotKral',
  'BonusKral',
  'KoiSpecheli',
  'PechalbaBoss',
  'JackpotKing',
  'HighRollerBG',
] as const;

// Сначала пробуем «говорящие» числа, потом случайные — чем больше ников
// занято, тем длиннее хвост
const FUN_NUMBERS = ['7', '77', '777', '007', '69', '88', '888', '13', '21', '99'];

const MIN_NICKNAME_LENGTH = 6;
const ATTEMPTS = 30;

export async function generateNickname(
  isTaken: (login: string) => Promise<boolean>,
  random: () => number = Math.random,
): Promise<string> {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const suffix =
      attempt < 10
        ? pick(FUN_NUMBERS)
        : String(Math.floor(random() * (attempt < 20 ? 1000 : 100000)));

    const nickname = pick(NICKNAME_BASES) + suffix;

    if (nickname.length >= MIN_NICKNAME_LENGTH && !(await isTaken(nickname))) {
      return nickname;
    }
  }

  // Сюда не дойти, пока свободны хотя бы сотни тысяч вариантов — но
  // регистрация не должна падать из-за неудачного жребия
  return pick(NICKNAME_BASES) + Date.now().toString(36);
}
