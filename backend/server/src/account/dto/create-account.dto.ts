export class CreateAccountDto {
  readonly balance: number;
  readonly bonus_balance?: number;
  readonly fake_balance?: number;

  readonly login?: string;
  readonly password?: string;
  readonly google_id?: string;
  readonly apple_id?: string;

  readonly last_spin_date?: Date;

  readonly image_url?: string;
}
