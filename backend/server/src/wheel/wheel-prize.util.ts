// Приз колеса решает только сервер по секторам из БД. Колесо, которое
// присылает клиент, нужно лишь для индекса сектора под анимацию: раньше
// приз брался прямо из него, и клиент мог прислать [150]

export function randomItem<T>(items: T[], random = Math.random): T {
  return items[Math.floor(random() * items.length)];
}

// Тот же набор секторов, порядок не важен
export function sameWheel(client: unknown, values: number[]): boolean {
  if (!Array.isArray(client) || client.length !== values.length) return false;
  const a = client.map(Number).sort((x, y) => x - y);
  const b = [...values].sort((x, y) => x - y);
  return a.every((v, i) => v === b[i]);
}

export function sectorsOf(wheel: unknown[], prize: number): number[] {
  return wheel.flatMap((v, i) => (Number(v) === prize ? [i] : []));
}
