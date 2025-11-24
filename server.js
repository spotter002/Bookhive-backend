const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/swaps', require('./routes/swaps'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users', require('./routes/users'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/chats', require('./routes/chats'));

// Make io available to routes
app.set('io', io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Socket.IO setup
const Message = require('./models/Message');
const Chat = require('./models/Chat');

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Auth token missing'));
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: user.userId, ...user };
    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.user.id);

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('send_message', async ({ chatId, content }) => {
    try {
      if (!content || !chatId) return;

      const message = await Message.create({
        chatId,
        senderId: socket.user.id,
        content,
        timestamp: new Date(),
        read: false
      });

      const chat = await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() }, { new: true })
        .populate('bookId')
        .populate('participants', 'name email');
      
      const populatedMessage = await Message.findById(message._id).populate('senderId', 'name');
      
      io.to(chatId).emit('receive_message', populatedMessage);
      
      // Update chat list for all participants
      chat.participants.forEach(participant => {
        io.emit('chat_list_update', { userId: participant._id.toString(), chat });
      });
    } catch (err) {
      console.error('send_message error:', err);
    }
  });

  socket.on('mark_read', async ({ chatId }) => {
    try {
      await Message.updateMany(
        { chatId, senderId: { $ne: socket.user.id }, read: false },
        { $set: { read: true } }
      );
      io.to(chatId).emit('messages_read', { chatId, userId: socket.user.id });
    } catch (err) {
      console.error('mark_read error:', err);
    }
  });

  socket.on('typing', ({ chatId }) => {
    socket.to(chatId).emit('typing_status', { userId: socket.user.id, typing: true });
  });

  socket.on('stop_typing', ({ chatId }) => {
    socket.to(chatId).emit('typing_status', { userId: socket.user.id, typing: false });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.user.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));