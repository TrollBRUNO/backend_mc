import { PartialType } from '@nestjs/mapped-types';
import { CreateCasinoDto } from './create-casino.dto';

export class UpdateCasinoDto extends PartialType(CreateCasinoDto) {}
