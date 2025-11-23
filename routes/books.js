const express = require('express');
const Book = require('../models/Book');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// Get user's books
router.get('/my-books', auth, async (req, res) => {
  try {
    const books = await Book.find({ ownerId: req.userId }).sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});



// Get all books
router.get('/', async (req, res) => {
  try {
    const { search, author, course, genre, subject, condition, swapOnly, minPrice, maxPrice, sortBy } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }
    if (author) query.author = { $regex: author, $options: 'i' };
    if (course) query.course = { $regex: course, $options: 'i' };
    if (genre) query.genre = { $regex: genre, $options: 'i' };
    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (condition) query.condition = condition;
    if (swapOnly === 'true') query.swapOnly = true;
    if (minPrice) query.price = { $gte: minPrice };
    if (maxPrice) query.price = { ...query.price, $lte: maxPrice };

    let sortOptions = { createdAt: -1 };
    if (sortBy === 'title-asc') sortOptions = { title: 1 };
    else if (sortBy === 'title-desc') sortOptions = { title: -1 };
    else if (sortBy === 'author-asc') sortOptions = { author: 1 };
    else if (sortBy === 'author-desc') sortOptions = { author: -1 };
    else if (sortBy === 'price-asc') sortOptions = { price: 1 };
    else if (sortBy === 'price-desc') sortOptions = { price: -1 };
    else if (sortBy === 'genre') sortOptions = { genre: 1 };
    else if (sortBy === 'subject') sortOptions = { subject: 1 };

    const books = await Book.find(query).populate('ownerId', 'name email').sort(sortOptions);
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single book
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate('ownerId', 'name email location');
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create book
router.post('/', auth, async (req, res) => {
  try {
    const bookData = {
      ...req.body,
      ownerId: req.userId
    };
    
    // Set copiesAvailable to totalCopies if not specified
    if (bookData.totalCopies && !bookData.copiesAvailable) {
      bookData.copiesAvailable = bookData.totalCopies;
    }
    
    const book = new Book(bookData);
    await book.save();
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update book
router.put('/:id', auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    Object.assign(book, req.body);
    await book.save();
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update book inventory
router.patch('/:id/inventory', auth, async (req, res) => {
  try {
    const { copiesAvailable, totalCopies, status } = req.body;
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (totalCopies !== undefined) book.totalCopies = totalCopies;
    if (copiesAvailable !== undefined) book.copiesAvailable = copiesAvailable;
    if (status) book.status = status;
    
    // Auto-update status based on inventory
    if (book.copiesAvailable === 0 && book.status === 'Available') {
      book.status = 'Sold Out';
    } else if (book.copiesAvailable > 0 && book.status === 'Sold Out') {
      book.status = 'Available';
    }

    await book.save();
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete book
router.delete('/:id', auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;