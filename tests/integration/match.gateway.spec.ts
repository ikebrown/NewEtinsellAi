
import request from 'supertest';
import { app } from '../../services/match-service/src/main';

describe('Match API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    // Login to get token
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    authToken = response.body.accessToken;
  });

  describe('GET /api/v1/matches/potential', () => {
    it('should return potential matches', async () => {
      const response = await request(app)
        .get('/api/v1/matches/potential')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .get('/api/v1/matches/potential');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/matches/swipe', () => {
    it('should create a like', async () => {
      const response = await request(app)
        .post('/api/v1/matches/swipe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ receiverId: 'user123', liked: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matched');
    });
  });
});