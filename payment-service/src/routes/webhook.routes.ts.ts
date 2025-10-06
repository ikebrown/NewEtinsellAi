///services/payment-service/src/routes/webhook.routes.ts`,..typescript
//services/payment-service/src/routes/webhook.routes.ts`typescript

import { Router } from 'express';
import { StripeService } from '../services/stripe.service';

const router = Router();
const stripeService = new StripeService();

router.post('/webhook', async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  
  try {
    await stripeService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default router;