export class CreateAccountDto {
  readonly balance: number;
  readonly bonus_balance?: number;
  readonly fake_balance?: number;

  readonly login?: string;
  readonly password?: string;
  readonly realname?: string;
  readonly google_id?: string;
  readonly apple_id?: string;

  readonly cards?: {
    card_id: string;
    city: string;
    active: boolean;
  }[];

  readonly bonus_code?: string;
  readonly bonus_code_expire?: Date;
  
  readonly create_date?: Date;

  readonly last_spin_date?: Date;

  readonly image_url?: string;

  readonly role?: string;
}
