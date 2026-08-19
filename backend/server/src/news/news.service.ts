import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { News, NewsDocument } from './news.schema';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { Account, AccountDocument } from '../account/account.schema';
import { PushService } from '../push/push.service';
import { AuthorshipService } from '../activity-log/authorship.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction, ActivityEntity } from '../activity-log/activity-log.schema';
import { CurrentUser } from '../auth/roles';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name) private newsModel: Model<NewsDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    private readonly pushService: PushService,
    private readonly authorship: AuthorshipService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Новости общие для всех: фильтры нужны админке, приложение зовёт без них
  async findAll(filter: { casino_id?: string; created_by?: string } = {}): Promise<News[]> {
    const query: FilterQuery<NewsDocument> = {};

    if (filter.casino_id) query.casino_id = this.toObjectId(filter.casino_id, 'casino_id');
    if (filter.created_by) query.created_by = this.toObjectId(filter.created_by, 'created_by');

    return this.newsModel.find(query).sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<News> {
    const doc = await this.newsModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`News ${id} not found`);
    return doc;
  }

  async create(dto: CreateNewsDto, user: CurrentUser): Promise<News> {
    const author = await this.authorship.resolve(user);
    const casinoId = this.authorship.resolveCasinoId(author, dto.casino_id);

    const now = new Date();

    const news = await new this.newsModel({
      ...dto,
      casino_id: casinoId,
      created_by: author.id,
      created_by_login: author.login,
    }).save();

    await this.activityLog.log(author, {
      action: ActivityAction.CREATE,
      entity: ActivityEntity.NEWS,
      entity_id: (news as NewsDocument)._id.toString(),
      title: dto.title,
      casino_id: casinoId,
    });

    const users = await this.accountModel.find({ 'notification_settings.news_post': true, });

    await Promise.all(
      users.map(u => {
        if (u.last_new_notify && now.getTime() - u.last_new_notify.getTime() < 24 * 60 * 60 * 1000) {
          return null;
        }

        this.pushService.sendLocalized(u.fcm_token, 'news', u.locale).catch(() => {}),

        u.last_new_notify = now;
        u.save();
      }),
    );

    return news;
  }

  async update(id: string, dto: UpdateNewsDto, user: CurrentUser): Promise<News> {
    const author = await this.authorship.resolve(user);

    const existing = await this.newsModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`News ${id} not found`);

    this.authorship.assertCanEdit(author, existing.created_by);

    // Автора записи сменить нельзя (поля из тела запроса отбрасываем),
    // зал — только на свой
    const {
      casino_id,
      created_by: _createdBy,
      created_by_login: _createdByLogin,
      ...rest
    } = dto as UpdateNewsDto & {
      casino_id?: string;
      created_by?: unknown;
      created_by_login?: unknown;
    };

    const patch: Record<string, unknown> = { ...rest };
    if (casino_id) patch.casino_id = this.authorship.resolveCasinoId(author, casino_id);

    const updated = await this.newsModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!updated) throw new NotFoundException(`News ${id} not found`);

    await this.activityLog.log(author, {
      action: ActivityAction.UPDATE,
      entity: ActivityEntity.NEWS,
      entity_id: id,
      title: updated.title,
      casino_id: updated.casino_id,
    });

    return updated;
  }

  async delete(id: string, user: CurrentUser): Promise<News> {
    const author = await this.authorship.resolve(user);

    const existing = await this.newsModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`News ${id} not found`);

    this.authorship.assertCanEdit(author, existing.created_by);

    const deleted = await this.newsModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`News ${id} not found`);

    await this.activityLog.log(author, {
      action: ActivityAction.DELETE,
      entity: ActivityEntity.NEWS,
      entity_id: id,
      title: deleted.title,
      casino_id: deleted.casino_id,
    });

    return deleted;
  }

  private toObjectId(value: string, field: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
    }
    return new Types.ObjectId(value);
  }
}
