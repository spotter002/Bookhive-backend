const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  course: { type: String, default: '' },
  genre: { type: String, default: '' },
  subject: { type: String, default: '' },
  condition: { type: String, enum: ['New', 'Like New', 'Good', 'Worn'], required: true },
  price: { type: Number, default: 0 },
  swapOnly: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['Available', 'Pending', 'Sold', 'Sold Out', 'Swapped'], default: 'Available' },
  copiesAvailable: { type: Number, default: 1, min: 0 },
  totalCopies: { type: Number, default: 1, min: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);