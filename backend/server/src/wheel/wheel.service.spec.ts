import { Test, TestingModule } from '@nestjs/testing';
import { WheelService } from './wheel.service';

describe('WheelService', () => {
  let service: WheelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WheelService],
    }).compile();

    service = module.get<WheelService>(WheelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
