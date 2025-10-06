//## 💳 COMPLETE PAYMENT SERVICE WITH ALL STRIPE FEATURES
//### `services/payment-service/src/main.ts` typescript

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3005;

// Webhook route needs raw body
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Regular middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// Routes
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/payments', webhookRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`💳 Payment Service running on port ${PORT}`);
});