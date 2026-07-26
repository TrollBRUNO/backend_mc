export class CreateCasinoDto {
  readonly city: Record<string, string>;
  readonly address: Record<string, string>;
  readonly name?: Record<string, string>;
  readonly mystery_progressive: boolean;
  readonly jackpot_url: string[];
  readonly image_url: string;
  readonly uu_id_list: string[];
  readonly photos?: string[];
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly events?: {
    name: Record<string, string> | string;
    description: Record<string, string> | string;
    start: Date;
    end: Date;
  }[];
}
