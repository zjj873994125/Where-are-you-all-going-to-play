import { LocationPoint, MidPoint } from '@/types'

export function calculateMidPoint(points: LocationPoint[]): MidPoint | null {
  if (points.length < 2) return null

  const sumLng = points.reduce((sum, p) => sum + p.lng, 0)
  const sumLat = points.reduce((sum, p) => sum + p.lat, 0)

  return {
    id: 'midpoint',
    name: '中点',
    lng: sumLng / points.length,
    lat: sumLat / points.length,
  }
}

export function calculateDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function generateAmapNavUrl(
  destLng: number,
  destLat: number,
  destName: string,
  mode: 'drive' | 'walk' | 'bus' = 'drive'
): string {
  const modeMap = { drive: 0, walk: 2, bus: 1 }
  return `https://uri.amap.com/navigation?to=${destLng.toFixed(6)},${destLat.toFixed(6)},${encodeURIComponent(destName)}&mode=${modeMap[mode]}&src=MeetPoint`
}
