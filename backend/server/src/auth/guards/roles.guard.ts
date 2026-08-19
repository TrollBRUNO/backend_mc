import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AccountRole } from '../roles';

// Проверяет роль из JWT. Актуальность роли в базе (аккаунт разжаловали
// или заблокировали уже после выдачи токена) дополнительно проверяет
// AuthorshipService.resolve на каждом пишущем запросе.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AccountRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('ROLE_NOT_ALLOWED');
    }

    return true;
  }
}
