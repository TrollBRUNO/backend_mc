import { BadRequestException } from '@nestjs/common';

// Залы в Болгарии, и «сегодня» в статистике — это сегодня по Софии,
// а не по UTC, в котором живёт сервер
const TZ = 'Europe/Sofia';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Насколько София впереди UTC в момент [at], в минутах: 180 летом, 120 зимой
export function sofiaOffsetMinutes(at: Date): number {
  const parts = formatter.formatToParts(at);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

// Начало суток 'YYYY-MM-DD' по Софии — как момент времени.
// Смещение уточняем вторым шагом: в дни перехода на летнее и зимнее время
// оно в полночь не такое, как в полдень
export function sofiaDayStart(date: string): Date {
  if (!DATE_PATTERN.test(date)) {
    throw new BadRequestException('INVALID_DATE');
  }

  const [y, m, d] = date.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);

  const first = sofiaOffsetMinutes(new Date(utcMidnight));
  let start = utcMidnight - first * 60000;
  const second = sofiaOffsetMinutes(new Date(start));
  if (second !== first) start = utcMidnight - second * 60000;

  return new Date(start);
}

// Конец суток 'YYYY-MM-DD' по Софии (не включительно) — начало следующих
export function sofiaDayEnd(date: string): Date {
  if (!DATE_PATTERN.test(date)) {
    throw new BadRequestException('INVALID_DATE');
  }

  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return sofiaDayStart(next.toISOString().slice(0, 10));
}
