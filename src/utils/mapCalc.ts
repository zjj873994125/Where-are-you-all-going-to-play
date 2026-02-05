import { LocationPoint, MidPoint, MidPointMode, NavMode } from '@/types'
import { getBatchRouteTimes, RouteResult } from './amap'

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

/**
 * 交通加权中点计算结果
 */
export interface WeightedMidPointResult {
  midPoint: MidPoint
  travelTimes: number[] // 每个点到中点的通勤时间（分钟）
  routes: Array<RouteResult | null> // 每个点到中点的路线
  usedStraightFallback?: boolean // 是否回退到直线时间估算
}

/**
 * 计算交通加权中点
 * 通过迭代调整中点位置，使得所有人的通勤时间更均衡
 */
export async function calculateWeightedMidPoint(
  points: LocationPoint[],
  mode: MidPointMode,
  city?: string,
  maxIterations: number = 3
): Promise<WeightedMidPointResult | null> {
  if (points.length < 2) return null

  // 如果是直线距离模式，直接返回几何中点
  if (mode === 'straight') {
    const midPoint = calculateMidPoint(points)
    if (!midPoint) return null

    const result = await getBatchRouteTimes(points, midPoint.lng, midPoint.lat, mode, city)
    return { midPoint, travelTimes: result.times, routes: result.routes }
  }

  // 从几何中点开始
  let currentMid = calculateMidPoint(points)
  if (!currentMid) return null

  let travelTimes: number[] = []
  let routes: Array<RouteResult | null> = []

  // 迭代优化中点位置
  for (let i = 0; i < maxIterations; i++) {
    // 获取每个点到当前中点的通勤时间
    const result = await getBatchRouteTimes(points, currentMid.lng, currentMid.lat, mode, city)
    travelTimes = result.times
    routes = result.routes

    // 检查是否所有路线都失败了
    const validTimes = travelTimes.filter(t => t < 999)
    if (validTimes.length === 0) {
      console.warn('所有路线规划都失败了，使用直线距离模式作为备选')
      // 回退到直线距离模式的时间估算
      const fallbackResult = await getBatchRouteTimes(points, currentMid.lng, currentMid.lat, 'straight', city)
      return {
        midPoint: currentMid,
        travelTimes: fallbackResult.times,
        routes: points.map(() => null),
        usedStraightFallback: true,
      }
    }

    // 计算平均时间（只使用有效的时间）
    const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length

    // 如果所有有效时间都接近（差异小于 5 分钟），停止迭代
    const maxDiff = Math.max(...validTimes) - Math.min(...validTimes)
    if (maxDiff < 5) break

    // 计算加权中点：时间越长的点权重越大
    // 对于失败的路线，使用平均时间
    const adjustedTimes = travelTimes.map(t => t >= 999 ? avgTime : t)
    const weights = adjustedTimes.map((t) => Math.pow(t / avgTime, 2))
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)

    const weightedLng = points.reduce((sum, p, idx) => sum + p.lng * weights[idx], 0) / totalWeight
    const weightedLat = points.reduce((sum, p, idx) => sum + p.lat * weights[idx], 0) / totalWeight

    // 平滑移动：新位置 = 0.5 * 旧位置 + 0.5 * 加权位置，避免震荡
    currentMid = {
      id: 'midpoint',
      name: '中点',
      lng: currentMid.lng * 0.5 + weightedLng * 0.5,
      lat: currentMid.lat * 0.5 + weightedLat * 0.5,
    }
  }

  // 最后一次获取通勤时间和路线
  const finalResult = await getBatchRouteTimes(points, currentMid.lng, currentMid.lat, mode, city)

  return {
    midPoint: currentMid,
    travelTimes: finalResult.times,
    routes: finalResult.routes,
    usedStraightFallback: false,
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

export interface AmapNavUrls {
  appUrl: string
  webUrl: string 
}

export function generateAmapNavUrls(
  destLng: number,
  destLat: number,
  destName: string,
  mode: NavMode = 'drive'
): AmapNavUrls {
  const modeMap = {
    drive: { appMode: 'car', webType: 'car' },
    walk: { appMode: 'walk', webType: 'walk' },
    bus: { appMode: 'bus', webType: 'bus' },
  } as const

  const modeConfig = modeMap[mode]
  const lnglat = `${destLng.toFixed(6)},${destLat.toFixed(6)}`

  const appParams = new URLSearchParams({
    to: `${lnglat},${destName}`,
    mode: modeConfig.appMode,
    src: 'MeetPoint',
    callnative: '1',
  })

  const webParams = new URLSearchParams({
    type: modeConfig.webType,
    'to[lnglat]': `${destLng.toFixed(6)},${destLat.toFixed(6)}`,
    'to[name]': destName,
    src: 'MeetPoint',
  })

  return {
    appUrl: `https://uri.amap.com/navigation?${appParams.toString()}`,
    webUrl: `https://ditu.amap.com/dir?${webParams.toString()}`,
  }
}

export function generateAmapNavUrl(
  destLng: number,
  destLat: number,
  destName: string,
  mode: NavMode = 'drive'
): string {
  return generateAmapNavUrls(destLng, destLat, destName, mode).webUrl
}
