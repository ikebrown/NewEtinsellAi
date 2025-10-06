///services/auth-service/src/controllers/auth.controller.ts````typescript

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto } from '../dtos/auth.dto';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: RegisterDto = req.body;
      const result = await this.authService.register(dto);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: LoginDto = req.body;
      const result = await this.authService.login(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.authService.refreshToken(refreshToken);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user;
      await this.authService.logout(userId);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };
}
```