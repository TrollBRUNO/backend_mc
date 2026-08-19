import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Gallery, GalleryDocument } from './gallery.schema';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Account, AccountDocument } from '../account/account.schema';
import { PushService } from '../push/push.service';
import { AuthorshipService } from '../activity-log/authorship.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction, ActivityEntity } from '../activity-log/activity-log.schema';
import { CurrentUser } from '../auth/roles';

@Injectable()
export class GalleryService {
  constructor(
    @InjectModel(Gallery.name) private galleryModel: Model<GalleryDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    private readonly pushService: PushService,
    private readonly authorship: AuthorshipService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Выигрыши общие для всех: фильтры нужны админке, приложение зовёт без них
  async findAll(filter: { casino_id?: string; created_by?: string } = {}): Promise<Gallery[]> {
    const query: FilterQuery<GalleryDocument> = {};

    if (filter.casino_id) query.casino_id = this.toObjectId(filter.casino_id, 'casino_id');
    if (filter.created_by) query.created_by = this.toObjectId(filter.created_by, 'created_by');

    return this.galleryModel.find(query).sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Gallery> {
    const doc = await this.galleryModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Gallery ${id} not found`);
    return doc;
  }

  async create(dto: CreateGalleryDto, user: CurrentUser): Promise<Gallery> {
    const author = await this.authorship.resolve(user);
    const casinoId = this.authorship.resolveCasinoId(author, dto.casino_id);

    const now = new Date();

    const gallery = await new this.galleryModel({
      ...dto,
      casino_id: casinoId,
      created_by: author.id,
      created_by_login: author.login,
    }).save();

    await this.activityLog.log(author, {
      action: ActivityAction.CREATE,
      entity: ActivityEntity.GALLERY,
      entity_id: (gallery as GalleryDocument)._id.toString(),
      title: dto.description,
      casino_id: casinoId,
    });

    const users = await this.accountModel.find({ 'notification_settings.jackpot_win_post': true, });

    await Promise.all(
      users.map(u => {
        if (u.last_gallery_notify && now.getTime() - u.last_gallery_notify.getTime() < 24 * 60 * 60 * 1000) {
          return null;
        }

        this.pushService.sendLocalized(u.fcm_token, 'gallery', u.locale).catch(() => {}),

        u.last_gallery_notify = now;
        u.save();
      }),
    );

    return gallery;
  }

  async update(id: string, dto: UpdateGalleryDto, user: CurrentUser): Promise<Gallery> {
    const author = await this.authorship.resolve(user);

    const existing = await this.galleryModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Gallery ${id} not found`);

    this.authorship.assertCanEdit(author, existing.created_by);

    // Автора записи сменить нельзя (поля из тела запроса отбрасываем),
    // зал — только на свой
    const {
      casino_id,
      created_by: _createdBy,
      created_by_login: _createdByLogin,
      ...rest
    } = dto as UpdateGalleryDto & {
      casino_id?: string;
      created_by?: unknown;
      created_by_login?: unknown;
    };

    const patch: Record<string, unknown> = { ...rest };
    if (casino_id) patch.casino_id = this.authorship.resolveCasinoId(author, casino_id);

    const updated = await this.galleryModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Gallery ${id} not found`);

    await this.activityLog.log(author, {
      action: ActivityAction.UPDATE,
      entity: ActivityEntity.GALLERY,
      entity_id: id,
      title: updated.description,
      casino_id: updated.casino_id,
    });

    return updated;
  }

  async delete(id: string, user: CurrentUser): Promise<Gallery> {
    const author = await this.authorship.resolve(user);

    const existing = await this.galleryModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Gallery ${id} not found`);

    this.authorship.assertCanEdit(author, existing.created_by);

    const deleted = await this.galleryModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Gallery ${id} not found`);

    await this.activityLog.log(author, {
      action: ActivityAction.DELETE,
      entity: ActivityEntity.GALLERY,
      entity_id: id,
      title: deleted.description,
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
