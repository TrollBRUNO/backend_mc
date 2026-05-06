import { Test, TestingModule } from '@nestjs/testing';
import { NotificationLogService } from './notification-log.service';

describe('NotificationLogService', () => {
  let service: NotificationLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationLogService],
    }).compile();

    service = module.get<NotificationLogService>(NotificationLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
