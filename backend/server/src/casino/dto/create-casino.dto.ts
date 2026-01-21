export class CreateCasinoDto {
  readonly city: Record<string, string>;
  readonly address: Record<string, string>;
  readonly mystery_progressive: boolean;
  readonly jackpot_url: string;
  readonly image_url: string;
  readonly uu_id_list: string[];
}
