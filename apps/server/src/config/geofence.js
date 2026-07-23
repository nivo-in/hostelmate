import dotenv from 'dotenv';
dotenv.config();

/**
 * Calculates the great-circle distance between two GPS coordinates using
 * the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point A (degrees)
 * @param {number} lon1 - Longitude of point A (degrees)
 * @param {number} lat2 - Latitude of point B (degrees)
 * @param {number} lon2 - Longitude of point B (degrees)
 * @returns {number} Distance in metres
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Determines whether a student's GPS location falls within the hostel's
 * allowed attendance radius.
 *
 * Hostel coordinates are read from HOSTEL_LAT / HOSTEL_LNG env vars,
 * falling back to New Delhi coordinates if not configured.
 *
 * @param {number} studentLat - Student's current latitude
 * @param {number} studentLng - Student's current longitude
 * @param {number} [hostelLat] - Hostel latitude (default: env var or 28.6139)
 * @param {number} [hostelLng] - Hostel longitude (default: env var or 77.2090)
 * @param {number} [radiusMeters=100] - Allowed radius in metres (default: 100m)
 * @returns {{ allowed: boolean, distance: number }}
 */
export function isWithinGeofence(
  studentLat,
  studentLng,
  hostelLat = parseFloat(process.env.HOSTEL_LAT || '28.6139'),
  hostelLng = parseFloat(process.env.HOSTEL_LNG || '77.2090'),
  radiusMeters = 100
) {
  const distance = calculateDistance(studentLat, studentLng, hostelLat, hostelLng);
  return {
    allowed: distance <= radiusMeters,
    distance,
  };
}
