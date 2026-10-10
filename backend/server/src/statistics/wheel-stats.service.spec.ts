import { Types } from 'mongoose';
import { SPIN_PRIZE_TTL_MS, WheelStatsService } from './wheel-stats.service';

describe('WheelStatsService — учёт выигрышей колеса', () => {
  let statModel: { create: jest.Mock; updateMany: jest.Mock };
  let service: WheelStatsService;

  beforeEach(() => {
    statModel = {
      create: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ modifiedCount: 3 })),
    };
    service = new WheelStatsService(statModel as any, {} as any, {} as any);
  });

  it('прокрутка записывается как ожидающая кассы', async () => {
    const at = new Date('2026-10-10T10:00:00Z');
    await service.recordSpin('acc-1', 50, 'spin', at);

    expect(statModel.create).toHaveBeenCalledWith({
      user_id: 'acc-1',
      prize_count: 50,
      spin_date: at,
      source: 'spin',
      status: 'pending',
    });
  });

  it('погашение отмечает все ожидающие выигрыши игрока забранными — с картой и залом', async () => {
    const casinoId = new Types.ObjectId();
    const at = new Date('2026-10-10T12:00:00Z');

    await service.markClaimed('acc-1', { card_id: 'GOTSE-123456', casino_id: casinoId }, at);

    const [filter, update] = statModel.updateMany.mock.calls[0];
    expect(filter).toEqual({ user_id: 'acc-1', status: 'pending' });
    expect(update.$set).toMatchObject({
      status: 'claimed',
      claimed_at: at,
      claimed_card_id: 'GOTSE-123456',
    });
    expect(String(update.$set.claimed_casino_id)).toBe(String(casinoId));
  });

  it('карта без зала (старая привязка) — погашение всё равно учитывается', async () => {
    await service.markClaimed('acc-1', { card_id: 'OLD-1', casino_id: null });

    expect(statModel.updateMany.mock.calls[0][1].$set.claimed_casino_id).toBeNull();
  });

  it('сгорают только ожидающие старше суток', async () => {
    const at = new Date('2026-10-10T12:00:00Z');

    const burnt = await service.expireStale(at);

    const [filter, update] = statModel.updateMany.mock.calls[0];
    expect(filter).toEqual({
      status: 'pending',
      spin_date: { $lt: new Date(at.getTime() - SPIN_PRIZE_TTL_MS) },
    });
    expect(update).toEqual({ $set: { status: 'expired', expired_at: at } });
    expect(burnt).toBe(3);
  });
});
