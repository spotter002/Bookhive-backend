const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Book = require('../models/Book');
const auth = require('../middleware/auth');

const router = express.Router();

// Create or get chat for book between current user and owner
router.post('/for-book/:bookId', auth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const requesterId = req.userId;

    const book = await Book.findById(bookId).populate('ownerId');
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const ownerId = book.ownerId._id.toString();
    if (ownerId === requesterId) return res.status(400).json({ error: 'Cannot message your own book' });

    // Find existing chat
    let chat = await Chat.findOne({ 
      bookId, 
      participants: { $all: [ownerId, requesterId] } 
    }).populate('bookId').populate('participants', 'name email');

    if (!chat) {
      chat = await Chat.create({ 
        bookId, 
        participants: [ownerId, requesterId] 
      });
      chat = await Chat.findById(chat._id).populate('bookId').populate('participants', 'name email');
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const chats = await Chat.find({ participants: userId })
      .populate('bookId')
      .populate('participants', 'name email')
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId })
      .populate('senderId', 'name')
      .sort({ timestamp: 1 })
      .limit(200);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const message = await Message.create({
      chatId,
      senderId: req.userId,
      content: content.trim()
    });

    // Update chat's updatedAt
    await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

    const populatedMessage = await Message.findById(message._id).populate('senderId', 'name');
    res.json(populatedMessage);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;