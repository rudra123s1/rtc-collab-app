const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // In production, refine this to your client URL
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Serving uploaded files securely via routes, static asset serving is not needed since we read blobs
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Simple healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Setup server
const server = http.createServer(app);

// Setup Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Room state: { roomId: { users: [ { socketId, userId, username } ] } }
const rooms = {};

// Map socketId to room information for fast disconnect cleanup
const socketToRoom = {};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User joins a room
  socket.on('join-room', ({ roomId, userId, username }) => {
    console.log(`User ${username} (${userId}) joining room: ${roomId}`);
    
    if (!rooms[roomId]) {
      rooms[roomId] = { users: [] };
    }

    // Check if user is already in the room to prevent duplicates
    const userExists = rooms[roomId].users.some(user => user.userId === userId);
    if (!userExists) {
      rooms[roomId].users.push({ socketId: socket.id, userId, username });
    } else {
      // Update socket ID if user rejoined
      const userIndex = rooms[roomId].users.findIndex(user => user.userId === userId);
      if (userIndex !== -1) {
        rooms[roomId].users[userIndex].socketId = socket.id;
      }
    }

    socketToRoom[socket.id] = { roomId, userId, username };
    socket.join(roomId);

    // Get list of other users in the room to return to the newcomer
    const otherUsers = rooms[roomId].users.filter(user => user.socketId !== socket.id);
    
    // Send list of existing users to the joined user
    socket.emit('all-users', otherUsers);

    // Notify other users in the room that a new user has joined
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      username
    });
  });

  // Relay WebRTC SDP offer/answer or ICE candidate
  socket.on('send-signal', ({ targetSocketId, signal, senderUserId, senderUsername }) => {
    io.to(targetSocketId).emit('receive-signal', {
      senderSocketId: socket.id,
      senderUserId,
      senderUsername,
      signal
    });
  });

  // Relay chat message
  socket.on('send-message', ({ roomId, message }) => {
    // message is already encrypted client-side
    socket.to(roomId).emit('receive-message', message);
  });

  // Relay whiteboard draw actions
  socket.on('draw', ({ roomId, drawData }) => {
    // drawData describes lines, shapes, brush sizes, colors
    socket.to(roomId).emit('draw-event', drawData);
  });

  // Relay shared file notifications
  socket.on('share-file', ({ roomId, fileMetadata }) => {
    // Includes fileId, originalName, size, mimeType, and sender details
    socket.to(roomId).emit('file-shared-event', fileMetadata);
  });

  // Handle peer disconnect
  socket.on('disconnect', () => {
    const roomInfo = socketToRoom[socket.id];
    if (roomInfo) {
      const { roomId, userId, username } = roomInfo;
      console.log(`User ${username} (${userId}) disconnected from room ${roomId}`);

      if (rooms[roomId]) {
        rooms[roomId].users = rooms[roomId].users.filter(user => user.socketId !== socket.id);
        
        // Clean up empty rooms
        if (rooms[roomId].users.length === 0) {
          delete rooms[roomId];
        } else {
          // Notify remaining users in the room
          socket.to(roomId).emit('user-disconnected', {
            socketId: socket.id,
            userId,
            username
          });
        }
      }
      delete socketToRoom[socket.id];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
