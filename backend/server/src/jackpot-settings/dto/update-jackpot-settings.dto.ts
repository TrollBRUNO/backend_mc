export class ThresholdRangeDto {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export class UpdateJackpotSettingsDto {
  readonly mini: ThresholdRangeDto;
  readonly middle: ThresholdRangeDto;
  readonly mega: ThresholdRangeDto;
}
