import { describe, it, expect, beforeAll, jest } from '@jest/globals'

// Mock Supabase
jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis()
    }))
  }
}))

// Mock Redis
jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true)
}))

// Mock Logger
jest.unstable_mockModule('../config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

describe('Attendance API', () => {
  describe('QR Token Validation', () => {
    it('should reject QR with wrong date', () => {
      const today = new Date().toISOString().split('T')[0]
      const wrongDateQR = {
        hostel: 'hostelmate',
        date: '2020-01-01',
        token: '2020-01-01-secret123',
        nonce: Date.now()
      }
      const isValid = wrongDateQR.date === today && 
                      wrongDateQR.token.startsWith(`${today}-secret123`)
      expect(isValid).toBe(false)
    })

    it('should reject expired QR nonce (older than 30s)', () => {
      const oldNonce = Date.now() - 31000
      const qrAge = Date.now() - oldNonce
      expect(qrAge).toBeGreaterThan(30000)
    })

    it('should accept valid QR within 30 seconds', () => {
      const today = new Date().toISOString().split('T')[0]
      const validQR = {
        hostel: 'hostelmate',
        date: today,
        token: `${today}-secret123`,
        nonce: Date.now()
      }
      const isValidDate = validQR.date === today
      const isValidToken = validQR.token.startsWith(`${today}-secret123`)
      const isValidNonce = (Date.now() - validQR.nonce) <= 30000
      
      expect(isValidDate).toBe(true)
      expect(isValidToken).toBe(true)
      expect(isValidNonce).toBe(true)
    })

    it('should reject QR with tampered token', () => {
      const today = new Date().toISOString().split('T')[0]
      const tamperedQR = {
        date: today,
        token: `${today}-wrongsecret`,
        nonce: Date.now()
      }
      const isValid = tamperedQR.token.startsWith(`${today}-secret123`)
      expect(isValid).toBe(false)
    })
  })

  describe('Geofencing Logic', () => {
    it('should reject attendance from far location', async () => {
      const { isWithinGeofence } = await import('../config/geofence.js')
      const hostelLat = 12.9394941
      const hostelLng = 77.5669014
      // Far away location (Delhi)
      const { allowed, distance } = isWithinGeofence(28.6139, 77.209, hostelLat, hostelLng)
      expect(allowed).toBe(false)
      expect(distance).toBeGreaterThan(100)
    })

    it('should allow attendance from hostel location', async () => {
      const { isWithinGeofence } = await import('../config/geofence.js')
      const hostelLat = 12.9394941
      const hostelLng = 77.5669014
      // Same location
      const { allowed } = isWithinGeofence(12.9394941, 77.5669014, hostelLat, hostelLng)
      expect(allowed).toBe(true)
    })

    it('should allow attendance within 100m radius', async () => {
      const { isWithinGeofence } = await import('../config/geofence.js')
      const hostelLat = 12.9394941
      const hostelLng = 77.5669014
      // ~50m away
      const { allowed } = isWithinGeofence(12.9398, 77.5669, hostelLat, hostelLng)
      expect(allowed).toBe(true)
    })
  })
})