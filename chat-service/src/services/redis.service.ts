///services/chat-service/src/services/redis.service.ts `typescript

import { createClient } from 'redis';

export class RedisService {
  private client;

  constructor() {
    this.client = createClient({ url: process.env.REDIS_URL });
    this.client.connect();
  }

  async setUserOnline(userId: string) {
    await this.client.set(`user:online:${userId}`, '1', { EX: 300 });
    await this.client.sAdd('online_users', userId);
  }

  async setUserOffline(userId: string) {
    await this.client.del(`user:online:${userId}`);
    await this.client.sRem('online_users', userId);
  }

  async isUserOnline(userId: string): Promise {
    const result = await this.client.exists(`user:online:${userId}`);
    return result === 1;
  }

  async getOnlineUsers(): Promise {
    return await this.client.sMembers('online_users');
  }
}