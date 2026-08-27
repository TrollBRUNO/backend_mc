// Приведение ответа джекпот-сервера зала к трём уровням, которыми оперируют
// пороги пользователя.
//
// Залы отдают массив без единой номенклатуры: MEGA/SUPER/MINI у одного,
// GOLD/SILVER/BRONZE у другого, Super/Middle/Mini у третьего. Привязываться
// к названиям нельзя — следующий зал придумает свои. Фронт (jackpot_row_new_widget)
// по той же причине берёт элементы по порядку, а не по имени.
//
// Порядок мы определяем по range («2500 - 4000 EUR» → 2500): это статическое
// свойство пула, оно не зависит от того, сколько в нём накопилось прямо сейчас.
// Сортировать по value нельзя — только что сорванный старший джекпот
// провалился бы в младший уровень и утащил бы туда чужой порог.

export interface JackpotFeedEntry {
  name?: string;
  range?: string;
  value?: number | string;
}

// Уровень без корректного замера — null: источник мог отдать 0 у пула,
// который ещё не инициализирован, и это не повод считать, что джекпот упал
export interface JackpotLevels {
  mini: number | null;
  middle: number | null;
  mega: number | null;
}

export const EMPTY_LEVELS: JackpotLevels = { mini: null, middle: null, mega: null };

// Нижняя граница диапазона. Ровно первое число строки: «2500 - 4000 EUR» → 2500
function lowerBound(range: string | undefined): number | null {
  if (typeof range !== 'string') return null;
  const match = range.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

// Значение приходит числом, но встречалось и строкой. Ноль и минус — то же,
// что фильтр `e.value > 0` на фронте: показывать/сравнивать нечего
function amount(value: number | string | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Три уровня из массива пулов зала.
 *
 * Старший пул → mega, младший → mini, следующий за старшим → middle.
 * Меньше трёх пулов — недостающие уровни остаются null: лучше молчать,
 * чем сравнить порог mini со значением чужого пула.
 */
export function levelsFromFeed(entries: JackpotFeedEntry[] | undefined): JackpotLevels {
  if (!Array.isArray(entries) || entries.length === 0) return { ...EMPTY_LEVELS };

  const bounds = entries.map(entry => lowerBound(entry.range));

  // range читается не у всех — тогда доверяем порядку, в котором зал
  // прислал пулы: он же используется и на экране приложения
  const ranked = bounds.every(bound => bound !== null)
    ? entries
        .map((entry, index) => ({ entry, bound: bounds[index]! }))
        .sort((a, b) => b.bound - a.bound)
        .map(item => item.entry)
    : entries;

  const mega = amount(ranked[0].value);

  if (ranked.length === 1) return { mini: null, middle: null, mega };

  const mini = amount(ranked[ranked.length - 1].value);

  if (ranked.length === 2) return { mini, middle: null, mega };

  return { mini, middle: amount(ranked[1].value), mega };
}

/** Есть ли хоть один пригодный замер: источник без них состояния не образует. */
export function hasAnyLevel(levels: JackpotLevels): boolean {
  return levels.mini !== null || levels.middle !== null || levels.mega !== null;
}
