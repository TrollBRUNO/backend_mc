"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const news_schema_1 = require("./news.schema");
let NewsService = class NewsService {
    newsModel;
    constructor(newsModel) {
        this.newsModel = newsModel;
    }
    async findAll() {
        return this.newsModel.find().sort({ create_date: -1 }).exec();
    }
    async findOne(id) {
        const doc = await this.newsModel.findById(id).exec();
        if (!doc)
            throw new common_1.NotFoundException(`News ${id} not found`);
        return doc;
    }
    async create(dto) {
        const news = new this.newsModel(dto);
        return news.save();
    }
    async update(id, dto) {
        const updated = await this.newsModel.findByIdAndUpdate(id, dto, { new: true }).exec();
        if (!updated)
            throw new common_1.NotFoundException(`News ${id} not found`);
        return updated;
    }
    async delete(id) {
        const deleted = await this.newsModel.findByIdAndDelete(id).exec();
        if (!deleted)
            throw new common_1.NotFoundException(`News ${id} not found`);
        return deleted;
    }
};
exports.NewsService = NewsService;
exports.NewsService = NewsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(news_schema_1.News.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], NewsService);
//# sourceMappingURL=news.service.js.map