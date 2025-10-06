////services/payment-service/src/services/stripe.service.ts`typescript

import Stripe from 'stripe';
import { PrismaClient, PlanType, TransactionType, TransactionStatus } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const prisma = new PrismaClient();

// Price mappings
const STRIPE_PRICES = {
  PREMIUM: process.env.STRIPE_PREMIUM_PRICE_ID!,
  GOLD: process.env.STRIPE_GOLD_PRICE_ID!,
  TRUSTED_BADGE: process.env.STRIPE_TRUSTED_BADGE_PRICE_ID!,
  UNDO_SWIPE: process.env.STRIPE_UNDO_SWIPE_PRICE_ID!,
  INCOGNITO: process.env.STRIPE_INCOGNITO_PRICE_ID!,
  SUPER_LIKE: process.env.STRIPE_SUPER_LIKE_PRICE_ID!,
  ROSE_GIFT: process.env.STRIPE_ROSE_GIFT_PRICE_ID!,
  DIAMOND_GIFT: process.env.STRIPE_DIAMOND_GIFT_PRICE_ID!,
  BOOST: process.env.STRIPE_BOOST_PRICE_ID!,
  GEOFILTER: process.env.STRIPE_GEOFILTER_PRICE_ID!,
};

export class StripeService {
  // Create subscription checkout
  async createSubscriptionCheckout(userId: string, planType: PlanType) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const priceId = STRIPE_PRICES[planType];
    
    // Create or get Stripe customer
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
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: { userId, planType },
      subscription_data: {
        metadata: { userId, planType },
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  // One-time purchases
  async createOneTimeCheckout(userId: string, productType: string, quantity: number = 1) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const priceId = STRIPE_PRICES[productType];
    if (!priceId) throw new Error('Invalid product type');

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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: { userId, productType, quantity: quantity.toString() },
    });

    return { sessionId: session.id, url: session.url };
  }

  // Handle webhook events
  async handleWebhook(payload: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { userId, planType, productType, quantity } = session.metadata || {};

    if (!userId) return;

    // Handle subscription
    if (session.mode === 'subscription' && planType) {
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
          stripeSubscriptionId: session.subscription as string,
          plan: planType as PlanType,
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Transaction record
      await this.createTransaction({
        userId,
        type: 'SUBSCRIPTION',
        amount: session.amount_total! / 100,
        currency: session.currency!.toUpperCase(),
        status: 'SUCCESS',
        stripeSessionId: session.id,
      });
    }

    // Handle one-time purchases
    if (session.mode === 'payment' && productType) {
      await this.handleOneTimePurchase(userId, productType, parseInt(quantity || '1'));
      
      await this.createTransaction({
        userId,
        type: productType as TransactionType,
        amount: session.amount_total! / 100,
        currency: session.currency!.toUpperCase(),
        status: 'SUCCESS',
        stripeSessionId: session.id,
      });
    }
  }

  private async handleOneTimePurchase(userId: string, productType: string, quantity: number) {
    const updates: any = {};

    switch (productType) {
      case 'UNDO_SWIPE':
        updates.undoCredits = { increment: quantity };
        break;
      
      case 'INCOGNITO_MODE':
        updates.hasIncognito = true;
        updates.incognitoExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        break;
      
      case 'VERIFIED_BADGE':
        updates.hasBadge = true;
        updates.badgeType = 'VERIFIED';
        updates.badgePurchasedAt = new Date();
        break;
      
      case 'SUPER_LIKE':
        // Add super like credits
        break;
      
      case 'ROSE_GIFT':
      case 'DIAMOND_GIFT':
        // Handle gift purchase
        break;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updates,
      });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status.toUpperCase() as any,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Update user premium status
    const isActive = ['active', 'trialing'].includes(subscription.status);
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: isActive,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'CANCELED' },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: false,
        planType: 'FREE',
      },
    });
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    // Log successful payment
    console.log('Invoice payment succeeded:', invoice.id);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    // Handle failed payment - send notification
    console.error('Invoice payment failed:', invoice.id);
  }

  private async createTransaction(data: any) {
    return await prisma.transaction.create({ data });
  }

  // Cancel subscription
  async cancelSubscription(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    return { success: true };
  }

  // Get customer portal
  async createCustomerPortal(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    return { url: session.url };
  }
}