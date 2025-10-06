///services/analytics-service/src/controllers/analytics.controller.ts`typescript


import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await analyticsService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getRevenueStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await analyticsService.getRevenueStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getUserMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await analyticsService.getUserMetrics();
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }

  async getMatchMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await analyticsService.getMatchMetrics();
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }

  async getChartData(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await analyticsService.getChartData(
        startDate as string,
        endDate as string
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
}