////services/chat-service/src/gateways/chat.gateway.ts`typescript
////services/chat-service/src/gateways/chat.gateway.ts``typescript

import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chat.service';
import { RedisService } from '../services/redis.service';

export class ChatGateway {
  private chatService: ChatService;
  private redisService: RedisService;

  constructor(private io: Server) {
    this.chatService = new ChatService();
    this.redisService = new RedisService();
    this.initializeListeners();
  }

  private initializeListeners() {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId;
      console.log(`User connected: ${userId}`);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Set user online
      this.redisService.setUserOnline(userId);

      // Join chat rooms
      socket.on('join_chat', async (chatId: string) => {
        socket.join(`chat:${chatId}`);
        socket.emit('joined_chat', { chatId });
      });

      // Leave chat room
      socket.on('leave_chat', (chatId: string) => {
        socket.leave(`chat:${chatId}`);
      });

      // Send message
      socket.on('send_message', async (data: {
        chatId: string;
        content: string;
        type?: string;
        mediaUrl?: string;
      }) => {
        try {
          const message = await this.chatService.sendMessage(
            data.chatId,
            userId,
            data.content,
            data.type,
            data.mediaUrl
          );

          // Emit to chat room
          this.io.to(`chat:${data.chatId}`).emit('new_message', message);

          // Send push notification to recipient(s)
          const chatUsers = await this.chatService.getChatUsers(data.chatId);
          const recipients = chatUsers.filter((u) => u.userId !== userId);
          
          for (const recipient of recipients) {
            // Check if user is online
            const isOnline = await this.redisService.isUserOnline(recipient.userId);
            if (!isOnline) {
              // Send push notification
              this.io.to(`user:${recipient.userId}`).emit('notification', {
                type: 'new_message',
                data: { chatId: data.chatId, message },
              });
            }
          }
        } catch (error: any) {
          socket.emit('error', { message: error.message });
        }
      });

      // Typing indicator
      socket.on('typing', (data: { chatId: string; isTyping: boolean }) => {
        socket.to(`chat:${data.chatId}`).emit('user_typing', {
          userId,
          isTyping: data.isTyping,
        });
      });

      // Read message
      socket.on('read_message', async (messageId: string) => {
        await this.chatService.markAsRead(messageId);
        socket.emit('message_read', { messageId });
      });

      // Voice call events
      socket.on('call_user', async (data: {
        toUserId: string;
        chatId: string;
        offer: any;
      }) => {
        this.io.to(`user:${data.toUserId}`).emit('incoming_call', {
          fromUserId: userId,
          chatId: data.chatId,
          offer: data.offer,
        });
      });

      socket.on('answer_call', (data: {
        toUserId: string;
        answer: any;
      }) => {
        this.io.to(`user:${data.toUserId}`).emit('call_answered', {
          fromUserId: userId,
          answer: data.answer,
        });
      });

      socket.on('ice_candidate', (data: {
        toUserId: string;
        candidate: any;
      }) => {
        this.io.to(`user:${data.toUserId}`).emit('ice_candidate', {
          fromUserId: userId,
          candidate: data.candidate,
        });
      });

      socket.on('end_call', (data: { toUserId: string }) => {
        this.io.to(`user:${data.toUserId}`).emit('call_ended', {
          fromUserId: userId,
        });
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${userId}`);
        this.redisService.setUserOffline(userId);
      });
    });
  }
}