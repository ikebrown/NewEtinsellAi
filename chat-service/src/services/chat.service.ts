////services/chat-service/src/services/chat.service.ts`typescript


import { PrismaClient, MessageType } from '@prisma/client';

const prisma = new PrismaClient();

export class ChatService {
  async getChatMessages(chatId: string, limit: number = 50, offset: number = 0) {
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            photos: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
      },
    });

    return messages.reverse();
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    type: MessageType = 'TEXT'
  ) {
    // Update chat last activity
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastActivity: new Date() },
    });

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        content,
        type,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            photos: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
      },
    });

    return message;
  }

  async markAsRead(messageId: string) {
    await prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
  }

  async getUserChats(userId: string) {
    const chats = await prisma.chat.findMany({
      where: {
        users: {
          some: { userId },
        },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                photos: {
                  where: { isMain: true },
                  take: 1,
                },
              },
            },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        lastActivity: 'desc',
      },
    });

    return chats;
  }
}