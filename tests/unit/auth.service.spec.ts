
import { AuthService } from '../../services/auth-service/src/services/auth.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    authService = new AuthService();
  });

  describe('register', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isVerified: false,
        isPremium: false,
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        birthDate: '1995-01-01',
        gender: 'MALE',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error if user exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: '1' });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          birthDate: '1995-01-01',
          gender: 'MALE',
        })
      ).rejects.toThrow('User already exists');
    });
  });
});