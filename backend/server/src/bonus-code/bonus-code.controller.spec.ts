import { Test, TestingModule } from '@nestjs/testing';
import { BonusCodeController } from './bonus-code.controller';

describe('BonusCodeController', () => {
  let controller: BonusCodeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BonusCodeController],
    }).compile();

    controller = module.get<BonusCodeController>(BonusCodeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
