import { BadRequestException } from '@nestjs/common';
import { JackpotSettingsService } from './jackpot-settings.service';
import { JackpotSettingsController } from './jackpot-settings.controller';
import { DEFAULT_JACKPOT_SETTINGS } from './jackpot-settings.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

// Рамки шкал видит любой (экран уведомлений открывается и без входа),
// а меняет только админ. Проверяем прямо на метаданных обработчиков:
// снятый по недосмотру декоратор молча открыл бы запись всем подряд
describe('JackpotSettingsController — доступ', () => {
  const guardsOf = (method: string) =>
    Reflect.getMetadata('__guards__', JackpotSettingsController.prototype[method]) ?? [];

  it('PUT закрыт JwtAuthGuard и AdminGuard', () => {
    expect(guardsOf('update')).toEqual([JwtAuthGuard, AdminGuard]);
  });

  it('GET открыт всем', () => {
    expect(guardsOf('get')).toEqual([]);
  });
});

// Рамки шкал приходят из админки, поэтому проверяем именно то, что может
// прислать человек руками: перепутанные min/max, шаг больше диапазона, строки
describe('JackpotSettingsService', () => {
  const modelWith = (doc: any) =>
    ({
      findOne: () => ({ lean: async () => doc }),
      updateOne: jest.fn().mockResolvedValue({}),
    }) as any;

  // Аккаунты трогает только подрезка порогов: считаем, сколько записей
  // она заявила изменёнными, и с какими фильтрами ходила
  const accountsWith = (modified: number) =>
    ({
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: modified }),
    }) as any;

  const serviceWith = (doc: any, accounts: any = accountsWith(0)) =>
    new JackpotSettingsService(modelWith(doc), accounts);

  const ok = {
    mini: { min: 0, max: 500, step: 5 },
    middle: { min: 0, max: 1000, step: 10 },
    mega: { min: 0, max: 5000, step: 25 },
  };

  it('без документа отдаёт умолчания и ничего не пишет', async () => {
    const model = modelWith(null);
    const service = new JackpotSettingsService(model, accountsWith(0));

    expect(await service.get()).toEqual(DEFAULT_JACKPOT_SETTINGS);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('уровень, которого нет в документе, берёт из умолчаний', async () => {
    const service = serviceWith({ mini: { min: 0, max: 500, step: 5 } });

    const result = await service.get();

    expect(result.mini).toEqual({ min: 0, max: 500, step: 5 });
    expect(result.mega).toEqual(DEFAULT_JACKPOT_SETTINGS.mega);
  });

  it('сохраняет корректные рамки', async () => {
    const model = modelWith(null);
    const service = new JackpotSettingsService(model, accountsWith(0));

    expect(await service.update(ok as any)).toEqual({ ...ok, adjusted: 0 });
    expect(model.updateOne).toHaveBeenCalledWith(
      {},
      { $set: expect.objectContaining(ok) },
      { upsert: true },
    );
  });

  it('приводит числа из строк и округляет', async () => {
    const service = serviceWith(null);

    const result = await service.update({
      ...ok,
      mini: { min: '0', max: '500.4', step: '5' },
    } as any);

    expect(result.mini).toEqual({ min: 0, max: 500, step: 5 });
  });

  it('отбивает max меньше min', async () => {
    const service = serviceWith(null);

    await expect(
      service.update({ ...ok, mega: { min: 5000, max: 100, step: 25 } } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('отбивает шаг больше самого диапазона', async () => {
    const service = serviceWith(null);

    await expect(
      service.update({ ...ok, mini: { min: 0, max: 100, step: 500 } } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('отбивает недостающий уровень', async () => {
    const service = serviceWith(null);

    await expect(
      service.update({ mini: ok.mini, middle: ok.middle } as any),
    ).rejects.toThrow(BadRequestException);
  });

  // Админ сузил mega до 5000 — сохранённое 7475 должно стать 5000,
  // но тронуть надо только тех, кто вышел за рамки
  describe('подрезка сохранённых порогов', () => {
    it('ищет только тех, кто выше нового максимума или ниже минимума', async () => {
      const accounts = accountsWith(0);
      await serviceWith(null, accounts).update(ok as any);

      const field = 'notification_settings.jackpot_thresholds.mega';
      const filters = accounts.updateMany.mock.calls
        .map((call: any[]) => call[0])
        .filter((filter: any) => filter[field]);

      expect(filters).toEqual([
        { [field]: { $gt: 5000 } },
        { [field]: { $gt: 0, $lt: 0 } },
      ]);
    });

    it('прижимает вышедших за верхнюю границу к максимуму', async () => {
      const accounts = accountsWith(0);
      await serviceWith(null, accounts).update(ok as any);

      const field = 'notification_settings.jackpot_thresholds.mega';
      const update = accounts.updateMany.mock.calls.find(
        (call: any[]) => call[0][field]?.$gt === 5000,
      );

      expect(update[1]).toEqual({ $set: { [field]: 5000 } });
    });

    it('возвращает, сколько порогов пришлось подрезать', async () => {
      // updateMany отвечает по одной записи на каждый из шести запросов
      const result = await serviceWith(null, accountsWith(1)).update(ok as any);

      expect(result.adjusted).toBe(6);
    });
  });
});
