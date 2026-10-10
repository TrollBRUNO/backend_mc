import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSettingsService } from './auth-settings.service';

describe('AuthController', () => {
  let controller: AuthController;
  let adminCode: string | undefined;

  beforeEach(async () => {
    adminCode = 's3cret-code';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => adminCode } },
        { provide: AuthSettingsService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('admin-verify', () => {
    it('пускает с верным кодом', async () => {
      await expect(controller.verifyAdmin('s3cret-code')).resolves.toEqual({
        ok: true,
      });
    });

    it('не пускает с неверным кодом', async () => {
      await expect(controller.verifyAdmin('wrong')).resolves.toEqual({
        ok: false,
      });
    });

    it('без настроенного кода не пускает даже запрос без кода', async () => {
      adminCode = undefined;

      await expect(controller.verifyAdmin(undefined as any)).resolves.toEqual({
        ok: false,
      });
    });

    it('не пишет коды в лог', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});

      await controller.verifyAdmin('wrong');
      await controller.verifyAdmin('s3cret-code');

      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });
  });
});
