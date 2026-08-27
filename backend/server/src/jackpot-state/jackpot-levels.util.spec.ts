import { levelsFromFeed, hasAnyLevel } from './jackpot-levels.util';

// Форма ответа взята с боевых серверов залов: именно её крон рассылки
// раньше читал как { mini, middle, mega } и получал undefined
describe('levelsFromFeed', () => {
  it('разбирает фид MegaBet Кирково', () => {
    expect(
      levelsFromFeed([
        { name: 'MEGA', range: '2500 - 4000 EUR', value: 2956.6 },
        { name: 'SUPER', range: '500 - 1000 EUR', value: 638.06 },
        { name: 'MINI', range: '150 - 400 EUR', value: 196.64 },
      ]),
    ).toEqual({ mega: 2956.6, middle: 638.06, mini: 196.64 });
  });

  it('разбирает фид с другими названиями пулов', () => {
    expect(
      levelsFromFeed([
        { name: 'GOLD', range: '1000 - 2000 EUR', value: 929.02 },
        { name: 'SILVER', range: '200 - 400 EUR', value: 144.36 },
        { name: 'BRONZE', range: '10 - 50 EUR', value: 15.53 },
      ]),
    ).toEqual({ mega: 929.02, middle: 144.36, mini: 15.53 });
  });

  it('раскладывает по range, а не по порядку в массиве', () => {
    expect(
      levelsFromFeed([
        { name: 'MINI', range: '150 - 400 EUR', value: 196.64 },
        { name: 'MEGA', range: '2500 - 4000 EUR', value: 2956.6 },
        { name: 'SUPER', range: '500 - 1000 EUR', value: 638.06 },
      ]),
    ).toEqual({ mega: 2956.6, middle: 638.06, mini: 196.64 });
  });

  // Сортировка по value утащила бы только что сорванный старший джекпот
  // в младший уровень и сравнила бы его с чужим порогом
  it('держит уровень за пулом, даже когда старший джекпот только что выпал', () => {
    expect(
      levelsFromFeed([
        { name: 'MEGA', range: '2500 - 4000 EUR', value: 2501.1 },
        { name: 'SUPER', range: '500 - 1000 EUR', value: 990.5 },
        { name: 'MINI', range: '150 - 400 EUR', value: 196.64 },
      ]),
    ).toEqual({ mega: 2501.1, middle: 990.5, mini: 196.64 });
  });

  it('без range доверяет порядку, в котором зал прислал пулы', () => {
    expect(
      levelsFromFeed([
        { name: 'Major', value: 2956.6 },
        { name: 'Middle', value: 638.06 },
        { name: 'Mini', value: 196.64 },
      ]),
    ).toEqual({ mega: 2956.6, middle: 638.06, mini: 196.64 });
  });

  it('значение строкой приводит к числу', () => {
    expect(levelsFromFeed([{ range: '100 - 200', value: '150.25' }])).toEqual({
      mega: 150.25,
      middle: null,
      mini: null,
    });
  });

  it('неположительное значение замером не считает — как фильтр value > 0 на экране', () => {
    expect(
      levelsFromFeed([
        { name: 'MEGA', range: '2500 - 4000 EUR', value: 0 },
        { name: 'SUPER', range: '500 - 1000 EUR', value: 638.06 },
        { name: 'MINI', range: '150 - 400 EUR', value: 196.64 },
      ]),
    ).toEqual({ mega: null, middle: 638.06, mini: 196.64 });
  });

  it('два пула — это старший и младший, среднего нет', () => {
    expect(
      levelsFromFeed([
        { name: 'GOLD', range: '1000 - 2000 EUR', value: 1200 },
        { name: 'BRONZE', range: '10 - 50 EUR', value: 20 },
      ]),
    ).toEqual({ mega: 1200, middle: null, mini: 20 });
  });

  it('пустой или отсутствующий массив даёт пустые уровни', () => {
    expect(hasAnyLevel(levelsFromFeed([]))).toBe(false);
    expect(hasAnyLevel(levelsFromFeed(undefined))).toBe(false);
  });
});
