import { PartialType } from '@nestjs/mapped-types';
import { CreateStatisticsDto } from './create-statistics.dto';

export class UpdateStatisticsDto extends PartialType(CreateStatisticsDto) {}
