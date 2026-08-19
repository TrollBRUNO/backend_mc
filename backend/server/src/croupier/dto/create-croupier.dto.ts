export class CreateCroupierDto {
  readonly login: string;
  readonly password: string;
  readonly realname: string;
  // Залы, к которым подключается крупье
  readonly casino_ids?: string[];
  readonly locale?: string;
}

export class UpdateCroupierDto {
  readonly realname?: string;
  readonly casino_ids?: string[];
  readonly locale?: string;
  readonly is_blocked?: boolean;
  readonly block_reason?: string;
  // Смена пароля админом — разлогинивает крупье на всех устройствах
  readonly password?: string;
}
