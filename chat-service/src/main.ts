
//// 💬 COMPLETE CHAT SERVICE WITH SOCKET.IO
/// `services/chat-service/src/main.ts``typescript

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.routes';
import { ChatGateway } from './gateways/chat.gateway';
import { authSocketMiddleware } from './middleware/auth.socket.middleware';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.SOCKET_IO_CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-service' });
});

app.use('/api/v1/chat', chatRoutes);

// Socket.IO authentication middleware
io.use(authSocketMiddleware);

// Initialize chat gateway
new ChatGateway(io);

const PORT = process.env.CHAT_SERVICE_PORT || 3004;
httpServer.listen(PORT, () => {
  console.log(`💬 Chat Service running on port ${PORT}`);
});