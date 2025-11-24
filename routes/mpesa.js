const express = require('express');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const { stkPush } = require('../utils/mpesa');
const auth = require('../middleware/auth');

const router = express.Router();

// Initiate payment
router.post('/pay', auth, async (req, res) => {
  try {
    const { phone } = req.body;
    
    const cart = await Cart.findOne({ userId: req.userId }).populate('items.bookId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Create order
    const order = new Order({
      userId: req.userId,
      items: cart.items.map(item => ({
        bookId: item.bookId._id,
        quantity: item.quantity,
        price: item.bookId.price
      })),
      totalAmount: cart.totalAmount,
      phone
    });

    await order.save();

    // Initiate M-Pesa payment
    const mpesaResponse = await stkPush(phone, cart.totalAmount);
    
    if (mpesaResponse.ResponseCode === '0') {
      order.mpesaCheckoutRequestId = mpesaResponse.CheckoutRequestID;
      await order.save();
      
      res.json({
        success: true,
        message: 'Payment initiated. Check your phone for M-Pesa prompt.',
        orderId: order._id,
        checkoutRequestId: mpesaResponse.CheckoutRequestID
      });
    } else {
      res.status(400).json({ message: 'Payment initiation failed' });
    }
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Payment failed' });
  }
});

// M-Pesa callback
router.post('/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    
    const order = await Order.findOne({ 
      mpesaCheckoutRequestId: stkCallback.CheckoutRequestID 
    });

    if (order) {
      if (stkCallback.ResultCode === 0) {
        order.status = 'paid';
        order.mpesaReceiptNumber = stkCallback.CallbackMetadata.Item.find(
          item => item.Name === 'MpesaReceiptNumber'
        )?.Value;
        
        // Clear user cart
        await Cart.findOneAndDelete({ userId: order.userId });
      } else {
        order.status = 'failed';
      }
      
      await order.save();
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Callback error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Failed' });
  }
});

// Check payment status
router.get('/status/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order || order.userId.toString() !== req.userId) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json({ status: order.status, mpesaReceiptNumber: order.mpesaReceiptNumber });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;