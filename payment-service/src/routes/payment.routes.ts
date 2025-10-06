/// `services/payment-service/src/routes/payment.routes.ts`typescript

import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new PaymentController();

// Subscriptions
router.post('/subscribe', authMiddleware, controller.createSubscription);
router.post('/cancel-subscription', authMiddleware, controller.cancelSubscription);

// One-time purchases
router.post('/purchase', authMiddleware, controller.createPurchase);

// Customer portal
router.post('/customer-portal', authMiddleware, controller.createCustomerPortal);

// Get user transactions
router.get('/transactions', authMiddleware, controller.getTransactions);

export default router;