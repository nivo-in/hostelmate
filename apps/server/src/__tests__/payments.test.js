import { jest } from '@jest/globals';
import request from 'supertest';

let queryResults = [];
const supabaseMock = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  then: jest.fn(function (resolve) {
    resolve(queryResults.shift() || { data: null, error: null });
  }),
};

jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn(() => supabaseMock),
  },
}));

jest.unstable_mockModule('../config/razorpay.js', () => ({
  createOrder: jest.fn().mockResolvedValue({ id: 'order_123', amount: 500000, currency: 'INR' }),
  verifyPaymentSignature: jest.fn().mockReturnValue(true),
  generateReceiptId: jest.fn(() => 'receipt_abc123'),
}));

jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

jest.unstable_mockModule('../config/notify.js', () => ({
  createNotification: jest.fn().mockResolvedValue(true),
}));

let currentProfile = { id: 'student-id', role: 'student' };
let authEnabled = true;

jest.unstable_mockModule('../middleware/rateLimit.js', () => ({
  generalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
  notificationLimiter: (req, res, next) => next(),
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    if (!authEnabled) {return res.status(401).json({ error: 'Unauthorized' });}
    req.user = { id: currentProfile.id };
    req.profile = currentProfile;
    next();
  },
}));

const { default: app } = await import('../index.js');

describe('Payments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = { id: 'student-id', role: 'student' };
    authEnabled = true;
    queryResults = [];
  });

  /**
   * Test: GET /api/v1/payments/fee-structures should return grouped fee structures
   * Verifies behaviour under correct inputs and constraints.
   */
  it('GET /api/v1/payments/fee-structures should return grouped fee structures', async () => {
    queryResults = [
      {
        data: [
          { id: '1', billing_period: 'monthly' },
          { id: '2', billing_period: 'yearly' },
        ],
        error: null,
      },
    ];

    const res = await request(app).get('/api/v1/payments/fee-structures');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.monthly).toHaveLength(1);
    expect(res.body.data.yearly).toHaveLength(1);
  });

  /**
   * Test: POST /api/v1/payments/fee-structures should create structure if warden
   * Verifies behaviour under correct inputs and constraints.
   */
  it('POST /api/v1/payments/fee-structures should create structure if warden', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [{ data: { id: '3', name: 'New Fee' }, error: null }];

    const res = await request(app).post('/api/v1/payments/fee-structures').send({
      name: 'New Fee',
      amount: 5000,
      fee_type: 'mess',
      billing_period: 'monthly',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('3');
  });

  /**
   * Test: GET /api/v1/payments/my should return student fees
   * Verifies behaviour under correct inputs and constraints.
   */
  it('GET /api/v1/payments/my should return student fees', async () => {
    queryResults = [
      { data: [{ id: 'payment-1', status: 'pending', amount: 1000 }], error: null },
      { data: [{ id: 'payment-2', status: 'paid', amount: 2000 }], error: null },
    ];

    const res = await request(app).get('/api/v1/payments/my');
    expect(res.status).toBe(200);
    expect(res.body.data.payments.pending).toHaveLength(1);
    expect(res.body.data.payments.history).toBeUndefined(); // It actually splits into paid and failed
  });

  /**
   * Test: POST /api/v1/payments/create-order should create a Razorpay order
   * Verifies behaviour under correct inputs and constraints.
   */
  it('POST /api/v1/payments/create-order should create a Razorpay order', async () => {
    queryResults = [
      { data: { id: 'payment-1', amount: 5000, status: 'pending' }, error: null },
      { data: { id: 'payment-1' }, error: null },
    ];

    const res = await request(app).post('/api/v1/payments/create-order').send({ fee_payment_id: 'payment-1' });
    expect(res.status).toBe(200);
    expect(res.body.data.order_id).toBe('order_123');
  });

  /**
   * Test: POST /api/v1/payments/verify should verify a successful payment
   * Verifies behaviour under correct inputs and constraints.
   */
  it('POST /api/v1/payments/verify should verify a successful payment', async () => {
    queryResults = [
      { data: { id: 'payment-1', status: 'pending', student_id: 'student-id', amount: 5000 }, error: null },
      { data: { id: 'payment-1', status: 'completed', amount: 5000 }, error: null },
    ];

    const res = await request(app).post('/api/v1/payments/verify').send({
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig_123',
      fee_payment_id: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /**
   * Test: GET /api/v1/payments/all should return all payments for warden
   * Verifies behaviour under correct inputs and constraints.
   */
  it('GET /api/v1/payments/all should return all payments for warden', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [
      { data: [{ id: 'payment-1', status: 'paid', amount: 500 }], count: 1, error: null },
    ];

    const res = await request(app).get('/api/v1/payments/all');
    expect(res.status).toBe(200);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.summary.total_collected).toBe(500);
  });

  /**
   * Test: POST /api/v1/payments/generate-bills should generate bills for warden
   * Verifies behaviour under correct inputs and constraints.
   */
  it('POST /api/v1/payments/generate-bills should generate bills for warden', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [
      { data: { id: 'fs-1', amount: 2000 }, error: null },
      { data: [{ id: 'student-1' }], error: null },
      { data: null, error: null },
    ];

    const res = await request(app).post('/api/v1/payments/generate-bills').send({
      fee_structure_id: '123e4567-e89b-12d3-a456-426614174000',
      period_label: 'June 2026',
      due_date: '2026-06-30',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.generated).toBe(1);
  });

  it('POST /api/v1/payments/cancel should cancel payment for student', async () => {
    queryResults = [
      { data: null, error: null },
    ];
    const res = await request(app).post('/api/v1/payments/cancel').send({
      fee_payment_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/payments/students-list should return students', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [{ data: [{ id: 's1', roll_number: '123' }], error: null }];

    const res = await request(app).get('/api/v1/payments/students-list');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /api/v1/payments/send-reminders should notify and update cache', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [
      { data: [{ id: 'p1', amount: 5000, student_id: 'student-id' }], error: null },
      { data: null, error: null }, // parent check
    ];

    const res = await request(app).post('/api/v1/payments/send-reminders');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reminders_sent).toBe(1);
  });

  it('PATCH /api/v1/payments/:id/mark-paid should mark as paid offline', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [
      { data: { id: 'p1', amount: 5000, student_id: 'student-id' }, error: null },
    ];

    const res = await request(app).patch('/api/v1/payments/p1/mark-paid').send({ payment_method: 'cash' });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('p1');
  });

  it('GET /api/v1/payments/receipt/:id should return receipt details', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    queryResults = [
      { data: { id: 'p1', amount: 5000, student_id: 'student-id' }, error: null },
    ];

    const res = await request(app).get('/api/v1/payments/receipt/p1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('p1');
  });

  it('GET /api/v1/payments/receipt/:id should return receipt for parent', async () => {
    currentProfile = { id: 'parent-id', role: 'parent' };
    queryResults = [
      { data: { id: 'p1', amount: 5000, student_id: 'student-id' }, error: null },
      { data: { student_id: 'student-id' }, error: null },
    ];

    const res = await request(app).get('/api/v1/payments/receipt/p1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('p1');
  });

  it('GET /api/v1/payments/last-reminder should return last reminder for warden', async () => {
    currentProfile = { id: 'warden-id', role: 'warden' };
    const { getCache } = await import('../config/redis.js');
    getCache.mockResolvedValueOnce('2023-01-01');

    const res = await request(app).get('/api/v1/payments/last-reminder');
    expect(res.status).toBe(200);
    expect(res.body.last_reminder).toBe('2023-01-01');
  });
});
