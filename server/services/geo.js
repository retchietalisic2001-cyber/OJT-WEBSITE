export function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

export const CITY_COORDS = {
  Manila: [14.5995, 120.9842],
  Makati: [14.5547, 121.0244],
  'Quezon City': [14.676, 121.0437],
  Pasig: [14.5864, 121.0619],
  Taguig: [14.5176, 121.0509],
  Mandaluyong: [14.5794, 121.0352],
  Pasay: [14.5378, 120.9908],
  Paranaque: [14.4797, 121.0198],
  Marikina: [14.6346, 121.0993],
  Caloocan: [14.7566, 121.0451],
  'Las Pinas': [14.4506, 120.9827],
  Muntinlupa: [14.3894, 121.0609]
}

export function cityCoords(city) {
  const key = String(city || '').trim()
  const entry = CITY_COORDS[key]
  if (!entry) return null
  return { lat: entry[0], lng: entry[1] }
}