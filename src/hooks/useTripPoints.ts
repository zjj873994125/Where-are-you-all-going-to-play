import { useCallback, useState } from 'react'
import { LocationPoint } from '@/types'

export interface TripPoint extends LocationPoint {
  createdTime: number
}

function buildTripPoint(point: LocationPoint, suffix: string): TripPoint {
  return {
    ...point,
    id: `trip_${Date.now()}_${suffix}`,
    createdTime: Date.now(),
  }
}

export function useTripPoints() {
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([])

  const saveTripPoints = useCallback((next: TripPoint[]) => {
    setTripPoints(next)
  }, [])

  const addTripPoint = useCallback((point: LocationPoint) => {
    const exists = tripPoints.some((item) => item.lng === point.lng && item.lat === point.lat)
    if (exists) return false

    const next = [...tripPoints, buildTripPoint(point, 'single')]
    saveTripPoints(next)
    return true
  }, [tripPoints, saveTripPoints])

  const addTripPoints = useCallback((points: LocationPoint[]) => {
    if (points.length === 0) return 0
    const existsSet = new Set(tripPoints.map((item) => `${item.lng}_${item.lat}`))
    const next = [...tripPoints]
    let added = 0

    points.forEach((point, index) => {
      const key = `${point.lng}_${point.lat}`
      if (existsSet.has(key)) return
      existsSet.add(key)
      next.push(buildTripPoint(point, `batch_${index}`))
      added += 1
    })

    if (added > 0) {
      saveTripPoints(next)
    }

    return added
  }, [tripPoints, saveTripPoints])

  const removeTripPoint = useCallback((id: string) => {
    const next = tripPoints.filter((item) => item.id !== id)
    saveTripPoints(next)
  }, [tripPoints, saveTripPoints])

  const clearTripPoints = useCallback(() => {
    saveTripPoints([])
  }, [saveTripPoints])

  return {
    tripPoints,
    addTripPoint,
    addTripPoints,
    removeTripPoint,
    clearTripPoints,
  }
}
