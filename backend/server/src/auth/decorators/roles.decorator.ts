import { SetMetadata } from '@nestjs/common';
import { AccountRole } from '../roles';

export const ROLES_KEY = 'roles';

// @Roles(AccountRole.ADMIN, AccountRole.CROUPIER) вместе с RolesGuard
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);
