export class CreateNewsDto {
  readonly title: Record<string, string>; // например: { en: 'Title', ru: 'Заголовок', bg: 'Заглавие' }
  readonly description: Record<string, string>;
  readonly image_url: string;
  // Зал, от имени которого публикуется. Для крупье проверяется по его списку
  // залов, если не передан — берётся его единственный зал
  readonly casino_id?: string | null;
}
