import { PartialType } from '@nestjs/mapped-types';
import { CreateWheelDto } from './create-wheel.dto';

export class UpdateWheelDto extends PartialType(CreateWheelDto) {}