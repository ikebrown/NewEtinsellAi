//analytics.service.
//services/analytics-service/src/services/analytics.service.ts`typescript

import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

export class AnalyticsService {
  async getDashboardStats() {
    const [
      totalUsers,
      premiumUsers,
      activeUsers,
      totalMatches,
      totalMessages,
      pendingReports,
      revenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isPremium: true } }),
      redis.sCard('active_users:today'),
      prisma.match.count(),
      prisma.message.count(),
      prisma.report.count({ where: { resolved: false } }),
      this.getTotalRevenue(),
    ]);

    const dailyMatches = await this.getDailyMatches();
    const matchRate = await this.getMatchRate();
    const churnRate = await this.getChurnRate();

    return {
      totalUsers,
      activeUsers: Number(activeUsers),
      premiumUsers,
      totalRevenue: revenue,
      pendingReports,
      dailyMatches,
      matchRate,
      churnRate,
    };
  }

  async getRevenueStats() {
    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
    });

    const subscriptionRevenue = transactions
      .filter((t) => t.type === 'SUBSCRIPTION')
      .reduce((sum, t) => sum + t.amount, 0);

    const inAppPurchaseRevenue = transactions
      .filter((t) => t.type !== 'SUBSCRIPTION' && t.currency === 'USD')
      .reduce((sum, t) => sum + t.amount, 0);

    const etiTokenRevenue = transactions
      .filter((t) => t.currency === 'ETI')
      .reduce((sum, t) => sum + t.amount, 0);

    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
    });

    const premiumCount = subscriptions.filter((s) => s.plan === 'PREMIUM').length;
    const goldCount = subscriptions.filter((s) => s.plan === 'GOLD').length;

    const productBreakdown = await this.getProductBreakdown();

    const ltv = await this.calculateLTV();
    const arpu = await this.calculateARPU();
    const conversionRate = await this.getConversionRate();

    return {
      totalRevenue: subscriptionRevenue + inAppPurchaseRevenue + etiTokenRevenue,
      subscriptionRevenue,
      inAppPurchaseRevenue,
      etiTokenRevenue,
      adRevenue: 0, // From AdMob
      ltv,
      arpu,
      conversionRate,
      subscriptionBreakdown: {
        premium: premiumCount,
        gold: goldCount,
      },
      productBreakdown,
    };
  }

  private async getTotalRevenue() {
    const result = await prisma.transaction.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    });
    return result._sum.amount || 0;
  }

  private async getDailyMatches() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.match.count({
      where: {
        matchedAt: { gte: today },
      },
    });
  }

  private async getMatchRate() {
    const totalLikes = await prisma.like.count();
    const totalMatches = await prisma.match.count();
    return totalLikes > 0 ? ((totalMatches * 2) / totalLikes) * 100 : 0;
  }

  private async getChurnRate() {
    // Calculate 30-day churn
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usersAtStart = await prisma.user.count({
      where: { createdAt: { lte: thirtyDaysAgo } },
    });

    const canceledSubscriptions = await prisma.subscription.count({
      where: {
        status: 'CANCELED',
        updatedAt: { gte: thirtyDaysAgo },
      },
    });

    return usersAtStart > 0 ? (canceledSubscriptions / usersAtStart) * 100 : 0;
  }

  private async calculateLTV() {
    const avgSubscriptionLength = 6; // months
    const avgRevenuePerMonth = 12; // $12/month average
    return avgSubscriptionLength * avgRevenuePerMonth;
  }

  private async calculateARPU() {
    const totalUsers = await prisma.user.count();
    const totalRevenue = await this.getTotalRevenue();
    return totalUsers > 0 ? totalRevenue / totalUsers : 0;
  }

  private async getConversionRate() {
    const totalUsers = await prisma.user.count();
    const premiumUsers = await prisma.user.count({ where: { isPremium: true } });
    return totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0;
  }

  private async getProductBreakdown() {
    const transactions = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        status: 'SUCCESS',
        type: { not: 'SUBSCRIPTION' },
      },
      _count: true,
      _sum: { amount: true },
    });

    return transactions.map((t) => ({
      name: t.type,
      units: t._count,
      revenue: t._sum.amount || 0,
    }));
  }

  async getChartData(startDate: string, endDate: string) {
    // Implementation for chart data
    // Returns daily data points for graphs
    return [];
  }

  async getUserMetrics() {
    const dau = await redis.sCard('active_users:today');
    const mau = await redis.sCard('active_users:month');
    
    return {
      dau: Number(dau),
      mau: Number(mau),
      ratio: Number(dau) > 0 ? (Number(dau) / Number(mau)) * 100 : 0,
    };
  }

  async getMatchMetrics() {
    return {
      totalMatches: await prisma.match.count(),
      todayMatches: await this.getDailyMatches(),
      matchRate: await this.getMatchRate(),
    };
  }
}