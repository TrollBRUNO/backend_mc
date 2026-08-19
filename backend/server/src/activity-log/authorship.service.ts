import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { AccountRole, CurrentUser } from '../auth/roles';

export interface Author {
  id: Types.ObjectId;
  login: string;
  role: string;
  casino_ids: Types.ObjectId[];
}

// Кто пишет запись и что ему можно. Роль и залы читаются из базы на каждом
// запросе, а не из JWT: админ мог поменять список залов, заблокировать или
// разжаловать крупье уже после выдачи токена.
@Injectable()
export class AuthorshipService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
  ) {}

  async resolve(user: CurrentUser): Promise<Author> {
    const account = await this.accountModel
      .findById(user.sub)
      .select('login role casino_ids is_blocked')
      .lean();

    if (!account) throw new ForbiddenException('ACCOUNT_NOT_FOUND');
    if (account.is_blocked) throw new ForbiddenException('ACCOUNT_BLOCKED');

    if (account.role !== AccountRole.ADMIN && account.role !== AccountRole.CROUPIER) {
      throw new ForbiddenException('ROLE_NOT_ALLOWED');
    }

    return {
      id: account._id as Types.ObjectId,
      login: account.login,
      role: account.role,
      casino_ids: (account.casino_ids ?? []).map(id => new Types.ObjectId(id)),
    };
  }

  isAdmin(author: Author): boolean {
    return author.role === AccountRole.ADMIN;
  }

  // Крупье правит и удаляет только свои записи, админ — любые
  assertCanEdit(author: Author, createdBy: Types.ObjectId | null | undefined): void {
    if (this.isAdmin(author)) return;

    if (!createdBy || !author.id.equals(createdBy)) {
      throw new ForbiddenException('NOT_YOUR_RECORD');
    }
  }

  // Мероприятия — только в своих залах
  assertCanManageCasino(author: Author, casinoId: Types.ObjectId | string): void {
    if (this.isAdmin(author)) return;

    const target = new Types.ObjectId(casinoId);
    if (!author.casino_ids.some(id => id.equals(target))) {
      throw new ForbiddenException('CASINO_NOT_ASSIGNED');
    }
  }

  // От имени какого зала публикуется новость/выигрыш.
  // Явно переданный casino_id проверяется по списку залов автора,
  // иначе берётся единственный (первый) зал крупье; у админа — null.
  resolveCasinoId(author: Author, requested?: string | null): Types.ObjectId | null {
    if (requested) {
      this.assertCanManageCasino(author, requested);
      return new Types.ObjectId(requested);
    }

    if (this.isAdmin(author)) return null;

    return author.casino_ids[0] ?? null;
  }
}
