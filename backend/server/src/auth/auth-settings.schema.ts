import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuthSettingsDocument = AuthSettings & Document;

// Настройка входа одна на всё приложение, документ в коллекции ровно один
@Schema({ collection: 'authsettings' })
export class AuthSettings {
  // Вход и регистрация по номеру телефона. Каждое SMS платное, поэтому
  // админ может выключить способ целиком — кнопка в приложении пропадёт
  @Prop({ type: Boolean, default: true })
  phone_login_enabled: boolean;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;
}

export const AuthSettingsSchema = SchemaFactory.createForClass(AuthSettings);
