import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Account, AccountDocument } from '../account/account.schema';
import { Casino, CasinoDocument } from '../casino/casino.schema';
import { AccountRole } from '../auth/roles';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction, ActivityEntity } from '../activity-log/activity-log.schema';
import { CreateCroupierDto, UpdateCroupierDto } from './dto/create-croupier.dto';

@Injectable()
export class CroupierService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Casino.name) private readonly casinoModel: Model<CasinoDocument>,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Сводка для админки: крупье, их залы, последняя активность и счётчики
  async findAll() {
    const croupiers = await this.accountModel
      .find({ role: AccountRole.CROUPIER })
      .select('login realname casino_ids is_blocked block_reason last_activity_at image_url locale')
      .sort({ last_activity_at: -1 })
      .lean();

    const ids = croupiers.map(c => c._id as Types.ObjectId);

    const [lastActivity, counts, casinos] = await Promise.all([
      this.activityLog.lastForAccounts(ids),
      this.activityLog.createdCountsByAccount(ids),
      this.loadCasinos(croupiers.flatMap(c => c.casino_ids ?? [])),
    ]);

    return croupiers.map(c => {
      const key = (c._id as Types.ObjectId).toString();
      const last = lastActivity.get(key) ?? null;

      return {
        id: key,
        login: c.login,
        realname: c.realname,
        image_url: c.image_url,
        locale: c.locale,
        is_blocked: c.is_blocked,
        block_reason: c.block_reason,
        created_at: (c._id as Types.ObjectId).getTimestamp(),

        // Залы, к которым подключён
        casinos: (c.casino_ids ?? []).map(id => casinos.get(id.toString()) ?? { id: id.toString() }),

        // Последний пост и его дата
        last_activity: last
          ? {
              action: last.action,
              entity: last.entity,
              entity_id: last.entity_id,
              title: last.title,
              casino_id: last.casino_id ? last.casino_id.toString() : null,
              created_at: last.created_at,
            }
          : null,
        last_activity_at: c.last_activity_at ?? null,

        // Сколько всего создал
        counts: counts.get(key) ?? { news: 0, gallery: 0, event: 0, total: 0 },
      };
    });
  }

  async findOne(id: string) {
    const account = await this.getCroupier(id);

    const objectId = account._id as Types.ObjectId;

    const [lastActivity, counts, casinos] = await Promise.all([
      this.activityLog.lastForAccounts([objectId]),
      this.activityLog.createdCountsByAccount([objectId]),
      this.loadCasinos(account.casino_ids ?? []),
    ]);

    const last = lastActivity.get(objectId.toString()) ?? null;

    return {
      id: objectId.toString(),
      login: account.login,
      realname: account.realname,
      image_url: account.image_url,
      locale: account.locale,
      is_blocked: account.is_blocked,
      block_reason: account.block_reason,
      created_at: objectId.getTimestamp(),
      casinos: (account.casino_ids ?? []).map(
        cid => casinos.get(cid.toString()) ?? { id: cid.toString() },
      ),
      last_activity: last,
      last_activity_at: account.last_activity_at ?? null,
      counts: counts.get(objectId.toString()) ?? { news: 0, gallery: 0, event: 0, total: 0 },
    };
  }

  // История всего, что крупье создал/изменил/удалил
  async history(
    id: string,
    filter: { entity?: ActivityEntity; action?: ActivityAction; limit?: number; skip?: number },
  ) {
    await this.getCroupier(id);

    return this.activityLog.find({ ...filter, account_id: id });
  }

  // Общая лента действий (все крупье и админы) с фильтрами
  async activity(filter: {
    account_id?: string;
    entity?: ActivityEntity;
    action?: ActivityAction;
    casino_id?: string;
    limit?: number;
    skip?: number;
  }) {
    return this.activityLog.find(filter);
  }

  async create(dto: CreateCroupierDto) {
    if (!dto.login || !dto.password || !dto.realname) {
      throw new BadRequestException('MISSING_FIELDS');
    }

    const exists = await this.accountModel.findOne({ login: dto.login });
    if (exists) throw new BadRequestException('USERNAME_TAKEN');

    const casinoIds = await this.validateCasinoIds(dto.casino_ids ?? []);

    const account = new this.accountModel({
      login: dto.login,
      password: await bcrypt.hash(dto.password, 10),
      realname: dto.realname,
      role: AccountRole.CROUPIER,
      casino_ids: casinoIds,
      locale: dto.locale ?? 'bg',
    });

    await account.save();

    return this.findOne((account._id as Types.ObjectId).toString());
  }

  async update(id: string, dto: UpdateCroupierDto) {
    const account = await this.getCroupierDocument(id);

    if (dto.realname !== undefined) account.realname = dto.realname;
    if (dto.locale !== undefined) account.locale = dto.locale as any;
    if (dto.is_blocked !== undefined) account.is_blocked = dto.is_blocked;
    if (dto.block_reason !== undefined) account.block_reason = dto.block_reason;

    if (dto.casino_ids !== undefined) {
      account.casino_ids = await this.validateCasinoIds(dto.casino_ids);
    }

    if (dto.password) {
      account.password = await bcrypt.hash(dto.password, 10);
      account.token_version += 1; // инвалидируем выданные токены
    }

    await account.save();

    return this.findOne(id);
  }

  async delete(id: string) {
    const deleted = await this.accountModel
      .findOneAndDelete({ _id: id, role: AccountRole.CROUPIER })
      .exec();

    if (!deleted) throw new NotFoundException(`Croupier ${id} not found`);

    // Журнал не трогаем: в нём сохранён логин на момент действия,
    // история созданного остаётся читаемой
    return { success: true, id };
  }

  // Профиль текущего крупье — админка рисует по нему доступные залы
  async me(userId: string) {
    const account = await this.accountModel
      .findById(userId)
      .select('login realname role casino_ids is_blocked last_activity_at image_url locale')
      .lean();

    if (!account) throw new NotFoundException('Account not found');

    const casinos = await this.loadCasinos(account.casino_ids ?? []);

    return {
      id: (account._id as Types.ObjectId).toString(),
      login: account.login,
      realname: account.realname,
      role: account.role,
      image_url: account.image_url,
      locale: account.locale,
      is_blocked: account.is_blocked,
      last_activity_at: account.last_activity_at ?? null,
      // Админ не привязан к залам — ему доступны все
      casinos:
        account.role === AccountRole.ADMIN
          ? await this.allCasinos()
          : (account.casino_ids ?? []).map(
              id => casinos.get(id.toString()) ?? { id: id.toString() },
            ),
    };
  }

  private async getCroupier(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('INVALID_ID');

    const account = await this.accountModel
      .findOne({ _id: id, role: AccountRole.CROUPIER })
      .lean();

    if (!account) throw new NotFoundException(`Croupier ${id} not found`);
    return account;
  }

  private async getCroupierDocument(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('INVALID_ID');

    const account = await this.accountModel
      .findOne({ _id: id, role: AccountRole.CROUPIER })
      .exec();

    if (!account) throw new NotFoundException(`Croupier ${id} not found`);
    return account;
  }

  private async validateCasinoIds(ids: string[]): Promise<Types.ObjectId[]> {
    if (ids.length === 0) return [];

    const invalid = ids.filter(id => !Types.ObjectId.isValid(id));
    if (invalid.length) throw new BadRequestException(`INVALID_CASINO_ID: ${invalid.join(', ')}`);

    const objectIds = ids.map(id => new Types.ObjectId(id));
    const found = await this.casinoModel.countDocuments({ _id: { $in: objectIds } });

    if (found !== objectIds.length) throw new BadRequestException('CASINO_NOT_FOUND');

    return objectIds;
  }

  private async loadCasinos(ids: (Types.ObjectId | string)[]) {
    const unique = Array.from(new Set(ids.map(id => id.toString())));
    if (unique.length === 0) return new Map<string, any>();

    const casinos = await this.casinoModel
      .find({ _id: { $in: unique.map(id => new Types.ObjectId(id)) } })
      .select('name city address image_url')
      .lean();

    return new Map(
      casinos.map(c => [
        (c._id as Types.ObjectId).toString(),
        {
          id: (c._id as Types.ObjectId).toString(),
          name: c.name,
          city: c.city,
          address: c.address,
          image_url: c.image_url,
        },
      ]),
    );
  }

  private async allCasinos() {
    const casinos = await this.casinoModel.find().select('name city address image_url').lean();

    return casinos.map(c => ({
      id: (c._id as Types.ObjectId).toString(),
      name: c.name,
      city: c.city,
      address: c.address,
      image_url: c.image_url,
    }));
  }
}
