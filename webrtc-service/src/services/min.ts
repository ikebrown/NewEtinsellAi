
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'webrtc-service' });
});

// Store active calls
const activeCalls = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-call', ({ callId, userId }) => {
    socket.join(callId);
    
    if (!activeCalls.has(callId)) {
      activeCalls.set(callId, { participants: [] });
    }

    const call = activeCalls.get(callId);
    call.participants.push({ socketId: socket.id, userId });

    // Notify other participants
    socket.to(callId).emit('user-joined', { userId, socketId: socket.id });

    // Send existing participants to new user
    const otherParticipants = call.participants.filter(
      (p: any) => p.socketId !== socket.id
    );
    socket.emit('existing-participants', otherParticipants);
  });

  socket.on('offer', ({ to, offer, callId }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('leave-call', ({ callId }) => {
    handleDisconnect(socket, callId);
  });

  socket.on('disconnect', () => {
    // Find and remove from all active calls
    activeCalls.forEach((call, callId) => {
      handleDisconnect(socket, callId);
    });
  });

  function handleDisconnect(socket: any, callId: string) {
    const call = activeCalls.get(callId);
    if (call) {
      call.participants = call.participants.filter(
        (p: any) => p.socketId !== socket.id
      );

      if (call.participants.length === 0) {
        activeCalls.delete(callId);
      } else {
        socket.to(callId).emit('user-left', { socketId: socket.id });
      }
    }
    socket.leave(callId);
  }
});

const PORT = process.env.WEBRTC_SERVICE_PORT || 3009;
server.listen(PORT, () => {
  console.log(`📹 WebRTC Service running on port ${PORT}`);
});