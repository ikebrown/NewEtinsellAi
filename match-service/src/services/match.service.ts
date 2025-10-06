/////services/match-service/src/services/match.service.ts`typescript


import { PrismaClient } from '@prisma/client';
import { RedisService } from './redis.service';

const prisma = new PrismaClient();

export class MatchService {
  private redis: RedisService;

  constructor() {
    this.redis = new RedisService();
  }

  async getPotentialMatches(userId: string, limit: number = 20) {
    // Get user and preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) throw new Error('User not found');

    const pref = user.preferences;
    if (!pref) throw new Error('Preferences not set');

    // Check cache first
    const cachedDeck = await this.redis.getCachedDeck(userId);
    if (cachedDeck && cachedDeck.length > 0) {
      return cachedDeck.slice(0, limit);
    }

    // Get users already liked/passed
    const likedUsers = await prisma.like.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
    });

    const likedUserIds = likedUsers.map((l) => l.receiverId);

    // Find potential matches
    const potentialMatches = await prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...likedUserIds] },
        gender: pref.showMe || undefined,
        // Add location filtering here with geo queries
      },
      include: {
        photos: {
          where: { moderationStatus: 'APPROVED' },
          take: 5,
        },
      },
      take: limit * 2,
    });

    // Cache the deck
    await this.redis.cacheDeck(userId, potentialMatches);

    return potentialMatches.slice(0, limit);
  }

  async swipe(
    senderId: string,
    receiverId: string,
    liked: boolean
  ) {
    if (!liked) {
      // Just track the pass, don't create a like
      return { matched: false };
    }

    // Create like
    await prisma.like.create({
      data: {
        senderId,
        receiverId,
      },
    });

    // Check if it's a match (receiver also liked sender)
    const reciprocalLike = await prisma.like.findFirst({
      where: {
        senderId: receiverId,
        receiverId: senderId,
      },
    });

    if (reciprocalLike) {
      // Create match
      const match = await prisma.match.create({
        data: {
          users: {
            connect: [{ id: senderId }, { id: receiverId }],
          },
        },
      });

      // Create chat
      const chat = await prisma.chat.create({
        data: {
          matchId: match.id,
          users: {
            create: [
              { userId: senderId },
              { userId: receiverId },
            ],
          },
        },
      });

      // Update match with chatId
      await prisma.match.update({
        where: { id: match.id },
        data: { chatId: chat.id },
      });

      return { matched: true, matchId: match.id, chatId: chat.id };
    }

    return { matched: false };
  }

  async getMatches(userId: string) {
    const matches = await prisma.match.findMany({
      where: {
        users: {
          some: { id: userId },
        },
      },
      include: {
        users: {
          include: {
            photos: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
        chat: true,
      },
      orderBy: {
        matchedAt: 'desc',
      },
    });

    return matches;
  }

  async unmatch(matchId: string, userId: string) {
    // Verify user is part of the match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        users: {
          some: { id: userId },
        },
      },
    });

    if (!match) throw new Error('Match not found');

    // Delete match and related data
    await prisma.match.delete({
      where: { id: matchId },
    });
  }
}
