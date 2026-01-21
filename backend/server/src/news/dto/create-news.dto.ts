export class CreateNewsDto {
  readonly title: Record<string, string>; // например: { en: 'Title', ru: 'Заголовок', bg: 'Заглавие' }
  readonly description: Record<string, string>;
  readonly image_url: string;
}
