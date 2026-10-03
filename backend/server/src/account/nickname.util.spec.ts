import { NICKNAME_BASES, generateNickname } from './nickname.util';

describe('generateNickname', () => {
  it('ник — основа из списка и число, не короче 6 символов', async () => {
    // Основа целиком из списка: HighRollerBG77 — это HighRollerBG + 77,
    // а не HighRoller + BG77
    const pattern = new RegExp(`^(${NICKNAME_BASES.join('|')})\\d+$`);

    for (let i = 0; i < 200; i++) {
      const nickname = await generateNickname(async () => false);
      expect(nickname).toMatch(pattern);
      expect(nickname.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('занятые ники пропускает', async () => {
    const taken = new Set<string>();
    const isTaken = async (login: string) => taken.has(login);

    for (let i = 0; i < 50; i++) {
      const nickname = await generateNickname(isTaken);
      expect(taken.has(nickname)).toBe(false);
      taken.add(nickname);
    }
  });

  it('когда «говорящие» числа заняты, переходит на случайные', async () => {
    // random() = 0 — всегда первая основа и первое «говорящее» число
    const first = `${NICKNAME_BASES[0]}7`;
    const nickname = await generateNickname(async login => login === first, () => 0);

    expect(nickname).not.toBe(first);
    expect(nickname.startsWith(NICKNAME_BASES[0])).toBe(true);
  });

  it('даже если всё занято, ник всё равно выдаётся', async () => {
    const nickname = await generateNickname(async () => true);
    expect(nickname.length).toBeGreaterThanOrEqual(6);
  });
});
