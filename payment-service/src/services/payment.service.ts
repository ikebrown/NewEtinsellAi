import { PrismaClient, PlanType, TransactionType } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
const prisma = new PrismaClient();

export class PaymentService {
  async createSubscription(userId: string, planType: PlanType) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const priceId = this.getPriceId(planType);

    // Create Stripe customer if doesn't exist
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: { userId, planType },
    });

    return { sessionId: session.id, url: session.url };
  }

  async handleWebhook(payload: any, signature: string) {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object);
        break;
    }
  }

  private async handleCheckoutCompleted(session: any) {
    const { userId, planType } = session.metadata;

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: true,
        planType: planType as PlanType,
      },
    });

    // Create subscription record
    await prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: session.subscription,
        plan: planType as PlanType,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Create transaction
    await prisma.transaction.create({
      data: {
        userId,
        type: 'SUBSCRIPTION' as TransactionType,
        amount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        status: 'SUCCESS',
        stripeSessionId: session.id,
      },
    });
  }

  private async handleSubscriptionUpdated(subscription: any) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status.toUpperCase(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  private async handleSubscriptionCanceled(subscription: any) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (sub) {
      await prisma.user.update({
        where: { id: sub.userId },
        data: {
          isPremium: false,
          planType: 'FREE',
        },
      });

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELED' },
      });
    }
  }

  private getPriceId(planType: PlanType): string {
    const prices = {
      PREMIUM: process.env.STRIPE_PREMIUM_PRICE_ID!,
      GOLD: process.env.STRIPE_GOLD_PRICE_ID!,
    };
    return prices[planType];
  }

  async purchaseCredits(userId: string, type: TransactionType, amount: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: user.stripeCustomerId,
      metadata: { userId, type },
    });

    return { clientSecret: paymentIntent.client_secret };
  }
}