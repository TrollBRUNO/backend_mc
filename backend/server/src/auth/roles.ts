// Роли аккаунта. Хранятся в Account.role и попадают в JWT при логине.
export enum AccountRole {
  USER = 'user',
  ADMIN = 'admin',
  CROUPIER = 'croupier',
}

// То, что кладёт в request.user JwtStrategy.validate
export interface CurrentUser {
  sub: string;
  role: string;
}
