import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from 'src/account/account.schema';
import { BonusCode, BonusCodeDocument } from './bonus-code.schema';

@Injectable()
export class BonusCodeService {
    constructor(
        @InjectModel(BonusCode.name) private bonusCodeModel: Model<BonusCodeDocument>,
        @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    ) {}

    /* async generateBonusCode(accountId: string) {
        const account = await this.accountModel.findById(accountId);
        if (!account) throw new NotFoundException();

        // удаляем старые коды аккаунта
        await this.bonusCodeModel.deleteMany({
            account_id: account._id,
            used: false,
        });

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await this.bonusCodeModel.create({
            code,
            account_id: account._id,
            expires_at: expiresAt,
        });

        return {
            code,
            expires_at: expiresAt,
            server_time: new Date(),
        };
    } */

    async generateBonusCode(accountId: string) {
        const account = await this.accountModel.findById(accountId);
        if (!account) throw new NotFoundException();

        // 1. Попробовать найти уже существующий активный код
        const existingCode = await this.bonusCodeModel.findOne({
            account_id: account._id,
            used: false,
            expires_at: { $gt: new Date() }, // ещё не истёк
        });

        if (existingCode) {
            // Вернуть существующий код с оставшимся временем
            return {
                code: existingCode.code,
                expires_at: existingCode.expires_at,
                server_time: new Date(),
            };
        }

        // 2. Если кода нет или истёк — создаём новый
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await this.bonusCodeModel.deleteMany({
            account_id: account._id,
            used: false,
        });

        await this.bonusCodeModel.create({
            code,
            account_id: account._id,
            expires_at: expiresAt,
        });

        return {
            code,
            expires_at: expiresAt,
            server_time: new Date(),
        };
    }


    async verifyBonusCode(card_id: string, code: string) {
        // 1. Найти код
        const bonus = await this.bonusCodeModel.findOne({
            code,
            used: false,
            expires_at: { $gt: new Date() },
        });

        if (!bonus) {
            throw new BadRequestException('INVALID_OR_EXPIRED_CODE');
        }

        // 2. Найти аккаунт
        const account = await this.accountModel.findById(bonus.account_id);
        if (!account) throw new BadRequestException('ACCOUNT_NOT_FOUND');

        // 3. Проверить карту
        const card = account.cards.find(
            c => c.card_id === card_id && c.active
        );

        if (!card) {
            throw new BadRequestException('CARD_NOT_LINKED');
        }

        // 4. Списать бонусы
        const amount = Number(account.bonus_balance ?? 0);
        if (amount <= 0) {
            throw new BadRequestException('NO_BONUS_BALANCE');
        }

        account.bonus_balance = 0 as any;
        await account.save();

        // 5. Пометить код использованным
        bonus.used = true;
        await bonus.save();

        return {
            success: true,
            amount,
            account_id: account._id,
        };
    }
}
