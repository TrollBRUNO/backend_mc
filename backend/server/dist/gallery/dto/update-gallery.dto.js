"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGalleryDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_gallery_dto_1 = require("./create-gallery.dto");
class UpdateGalleryDto extends (0, mapped_types_1.PartialType)(create_gallery_dto_1.CreateGalleryDto) {
}
exports.UpdateGalleryDto = UpdateGalleryDto;
//# sourceMappingURL=update-gallery.dto.js.map