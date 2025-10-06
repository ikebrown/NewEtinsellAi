
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const app = express();
const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

redis.connect();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'analytics-service' });
});

// Track event
app.post('/api/v1/analytics/track', async (req, res) => {
  try {
    const { userId, event, properties } = req.body;

    // Store in Redis for real-time analytics
    await redis.hIncrBy('events:count', event, 1);
    await redis.lPush(
      `events:${event}`,
      JSON.stringify({ userId, properties, timestamp: new Date() })
    );

    // Trim list to last 1000 events
    await redis.lTrim(`events:${event}`, 0, 999);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats
app.get('/api/v1/analytics/stats', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const premiumUsers = await prisma.user.count({ where: { isPremium: true } });
    const activeUsers = await redis.sCard('active_users:today');
    
    const totalMatches = await prisma.match.count();
    const totalMessages = await prisma.message.count();
    const totalRevenue = await prisma.transaction.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    });

    const eventCounts = await redis.hGetAll('events:count');

    res.json({
      totalUsers,
      premiumUsers,
      activeUsers: Number(activeUsers),
      totalMatches,
      totalMessages,
      totalRevenue: totalRevenue._sum.amount || 0,
      eventCounts,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user activity
app.get('/api/v1/analytics/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [likes, matches, messages] = await Promise.all([
      prisma.like.count({ where: { senderId: userId } }),
      prisma.match.count({
        where: { users: { some: { id: userId } } },
      }),
      prisma.message.count({ where: { senderId: userId } }),
    ]);

    res.json({ likes, matches, messages });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.ANALYTICS_SERVICE_PORT || 3008;
app.listen(PORT, () => {
  console.log(`📊 Analytics Service running on port ${PORT}`);
});