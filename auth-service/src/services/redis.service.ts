
///services/auth-service/src/services/redis.service.ts`.typescript

import { createClient } from 'redis';

export class RedisService {
  private client;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    this.client.connect();
  }

  async setRefreshToken(userId: string, token: string) {
    await this.client.set(`refresh_token:${userId}`, token, {
      EX: 7 * 24 * 60 * 60, // 7 days
    });
  }

  async getRefreshToken(userId: string): Promise {
    return await this.client.get(`refresh_token:${userId}`);
  }

  async deleteRefreshToken(userId: string) {
    await this.client.del(`refresh_token:${userId}`);
  }
}
```

### `services/auth-service/src/dtos/auth.dto.ts`
```typescript
export interface RegisterDto {
  email: string;
  phone?: string;
  password: string;
  name: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER';
  location?: any;
}

export interface LoginDto {
  email: string;
  password: string;
}
```

### `services/auth-service/src/routes/auth.routes.ts`
```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authMiddleware, authController.logout);

export default router;