import { Test, TestingModule } from '@nestjs/testing';
import { WheelController } from './wheel.controller';

describe('WheelController', () => {
  let controller: WheelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WheelController],
    }).compile();

    controller = module.get<WheelController>(WheelController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
