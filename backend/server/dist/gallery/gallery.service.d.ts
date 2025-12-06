import { Model } from 'mongoose';
import { Gallery, GalleryDocument } from './gallery.schema';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
export declare class GalleryService {
    private galleryModel;
    constructor(galleryModel: Model<GalleryDocument>);
    findAll(): Promise<Gallery[]>;
    findOne(id: string): Promise<Gallery>;
    create(dto: CreateGalleryDto): Promise<Gallery>;
    update(id: string, dto: UpdateGalleryDto): Promise<Gallery>;
    delete(id: string): Promise<Gallery>;
}
