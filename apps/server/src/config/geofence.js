import dotenv from 'dotenv'
dotenv.config()

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // metres
  const φ1 = lat1 * Math.PI/180
  const φ2 = lat2 * Math.PI/180
  const Δφ = (lat2-lat1) * Math.PI/180
  const Δλ = (lon2-lon1) * Math.PI/180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

export function isWithinGeofence(studentLat, studentLng, hostelLat = parseFloat(process.env.HOSTEL_LAT || '28.6139'), hostelLng = parseFloat(process.env.HOSTEL_LNG || '77.2090'), radiusMeters = 100) {
  const distance = calculateDistance(studentLat, studentLng, hostelLat, hostelLng)
  return {
    allowed: distance <= radiusMeters,
    distance
  }
}
