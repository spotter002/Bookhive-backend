const express = require('express');
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user cart
router.get('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId }).populate('items.bookId');
    if (!cart) {
      return res.json({ items: [], totalAmount: 0 });
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { bookId, quantity = 1 } = req.body;
    
    const book = await Book.findById(bookId);
    if (!book || book.swapOnly) {
      return res.status(400).json({ message: 'Book not available for purchase' });
    }

    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.bookId.toString() === bookId);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newQuantity = currentQuantity + quantity;
    
    // Check if new quantity exceeds available copies
    if (newQuantity > book.copiesAvailable) {
      return res.status(400).json({ 
        message: `Cannot add ${quantity} items. Only ${book.copiesAvailable - currentQuantity} copies available.`,
        availableCopies: book.copiesAvailable,
        currentInCart: currentQuantity
      });
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ bookId, quantity });
    }

    // Calculate total
    await cart.populate('items.bookId');
    cart.totalAmount = cart.items.reduce((total, item) => total + (item.bookId.price * item.quantity), 0);
    
    await cart.save();
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove item from cart
router.delete('/remove/:bookId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.bookId.toString() !== req.params.bookId);
    
    await cart.populate('items.bookId');
    cart.totalAmount = cart.items.reduce((total, item) => total + (item.bookId.price * item.quantity), 0);
    
    await cart.save();
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear cart
router.delete('/clear', auth, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.userId });
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;