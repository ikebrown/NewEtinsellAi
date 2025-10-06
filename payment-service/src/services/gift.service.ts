
import { PrismaClient } from '@prisma/client';
import { StripeService } from './stripe.service';
import { ETITokenService } from '../../blockchain-service/src/services/eti-token.service';

const prisma = new PrismaClient();

const GIFT_CATALOG = {
  rose: { name: 'Rose', priceUSD: 1.99, priceETI: 10, emoji: '🌹' },
  champagne: { name: 'Champagne', priceUSD: 4.99, priceETI: 25, emoji: '🍾' },
  diamond: { name: 'Diamond', priceUSD: 9.99, priceETI: 50, emoji: '💎' },
  heart: { name: 'Heart', priceUSD: 2.99, priceETI: 15, emoji: '❤️' },
  star: { name: 'Star', priceUSD: 3.99, priceETI: 20, emoji: '⭐' },
};

export class GiftService {
  private stripeService = new StripeService();
  private etiService = new ETITokenService();

  async sendGift(
    senderId: string,
    receiverId: string,
    giftType: string,
    paymentMethod: 'stripe' | 'eti'
  ) {
    const gift = GIFT_CATALOG[giftType as keyof typeof GIFT_CATALOG];
    if (!gift) throw new Error('Invalid gift type');

    // Process payment
    if (paymentMethod === 'stripe') {
      await this.processStripePayment(senderId, gift.priceUSD, giftType);
    } else {
      await this.processETIPayment(senderId, gift.priceETI);
    }

    // Create gift record
    const giftRecord = await prisma.gift.create({
      data: {
        senderId,
        receiverId,
        giftType,
        costInETI: gift.priceETI,
      },
    });

    // Send notification to receiver
    // (notification service integration)

    return giftRecord;
  }

  private async processStripePayment(userId: string, amount: number, giftType: string) {
    const priceId = process.env[`STRIPE_${giftType.toUpperCase()}_GIFT_PRICE_ID`];
    if (!priceId) throw new Error('Gift price not configured');

    await this.stripeService.createOneTimeCheckout(userId, `${giftType.toUpperCase()}_GIFT`, 1);
  }

  private async processETIPayment(userId: string, amount: number) {
    await this.etiService.purchaseWithETI(userId, 'GIFT', amount);
  }

  async getUserGiftsReceived(userId: string) {
    return await prisma.gift.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            photos: { where: { isMain: true }, take: 1 },
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });
  }

  async getUserGiftsSent(userId: string) {
    return await prisma.gift.findMany({
      where: { senderId: userId },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            photos: { where: { isMain: true }, take: 1 },
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });
  }
}