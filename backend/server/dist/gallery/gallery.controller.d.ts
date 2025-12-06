import { GalleryService } from './gallery.service';
export declare class GalleryController {
    private readonly galleryService;
    constructor(galleryService: GalleryService);
    findAll(): Promise<import("./gallery.schema").Gallery[]>;
    findOne(id: string): Promise<import("./gallery.schema").Gallery>;
    create(file: any, body: any): Promise<import("./gallery.schema").Gallery>;
    createJson(body: any): Promise<import("./gallery.schema").Gallery>;
    update(id: string, file: any, body: any): Promise<import("./gallery.schema").Gallery>;
    delete(id: string): Promise<import("./gallery.schema").Gallery>;
}
