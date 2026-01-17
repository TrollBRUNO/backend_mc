import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PushService {
  private readonly FCM_URL = 'https://fcm.googleapis.com/fcm/send';
  private readonly SERVER_KEY = process.env.FCM_SERVER_KEY;

  async send(token: string, payload: { title: string; body: string }) {
    if (!token) return;

    await axios.post(
      this.FCM_URL,
      {
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
      },
      {
        headers: {
          Authorization: `key=${this.SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
