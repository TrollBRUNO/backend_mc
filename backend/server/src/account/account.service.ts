import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Account> {
    const doc = await this.accountModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Account ${id} not found`);
    return doc;
  }  

  async create(dto: CreateAccountDto): Promise<Account> {
    const account = new this.accountModel(dto);
    return account.save();
  } 

  async update(id: string, dto: UpdateAccountDto): Promise<Account> {
    const updated = await this.accountModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Account ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Account> {
    const deleted = await this.accountModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Account ${id} not found`);
    return deleted;
  }   
}
