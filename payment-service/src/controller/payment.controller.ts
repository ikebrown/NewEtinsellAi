////services/payment-service/src/controllers/payment.controller.ts```typescript

import { Request, Response, NextFunction } from 'express';
import { StripeService } from '../services/stripe.service';
import { PrismaClient } from '@prisma/client';

const stripeService = new StripeService();
const prisma = new PrismaClient();

export class PaymentController {
  async createSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { planType } = req.body;

      const result = await stripeService.createSubscriptionCheckout(userId, planType);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createPurchase(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { productType, quantity } = req.body;

      const result = await stripeService.createOneTimeCheckout(userId, productType, quantity);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const result = await stripeService.cancelSubscription(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createCustomerPortal(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const result = await stripeService.createCustomerPortal(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  }
}