/**
 * @file apps/server/src/config/razorpay.js
 * Server configuration and helper utilities for razorpay operations.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from './logger.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function createOrder(amount, currency = 'INR', receipt) {
  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency,
    receipt,
    payment_capture: 1,
  });
  logger.info(`Razorpay order created: ${order.id}`);
  return order;
}

export function verifyPaymentSignature(orderId, paymentId, signature) {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  return expectedSignature === signature;
}

export function generateReceiptId(studentId, periodLabel) {
  return `RCP-${studentId.substring(0, 4)}-${periodLabel}-${Date.now()}`;
}

export default razorpay;
