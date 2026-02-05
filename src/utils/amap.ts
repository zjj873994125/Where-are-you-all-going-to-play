import { POI, POIDetail, City, MidPointMode } from '@/types'

declare global {
  interface Window {
    AMap: any
  }
}

const ROUTE_SEARCH_TIMEOUT_MS = 12000
const ROUTE_BATCH_SIZE = 2
const ROUTE_BATCH_DELAY_MS = 120

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// 确保插件加载完成
function loadPlugin(pluginName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 提取插件的简短名称（去掉 AMap. 前缀）
    const shortName = pluginName.replace('AMap.', '')

    // 检查插件是否已加载
    if (window.AMap && window.AMap[shortName]) {
      resolve()
      return
    }

    // 确保使用完整的插件名称加载
    const fullName = pluginName.startsWith('AMap.') ? pluginName : `AMap.${pluginName}`

    window.AMap?.plugin([fullName], () => {
      // 加载完成后再次检查
      if (window.AMap && window.AMap[shortName]) {
        resolve()
      } else {
        // 即使检查失败也尝试 resolve，因为有些插件加载后不会挂载到 AMap 对象上
        console.warn(`Plugin ${fullName} loaded but check failed, trying anyway`)
        resolve()
      }
    })
  })
}

export async function searchPOI(
  keyword: string,
  lng: number,
  lat: number,
  radius: number = 500
): Promise<POI[]> {
  if (!window.AMap) {
    console.error('AMap not loaded')
    return []
  }

  try {
    await loadPlugin('PlaceSearch')
  } catch (e) {
    console.error('PlaceSearch plugin failed to load:', e)
    return []
  }

  return new Promise((resolve) => {
    const placeSearch = new window.AMap.PlaceSearch({
      pageSize: 20,
      pageIndex: 1,
    })

    placeSearch.searchNearBy(
      keyword,
      [lng, lat],
      radius,
      (status: string, result: any) => {
        if (status === 'complete' && result.poiList?.pois) {
          const pois: POI[] = result.poiList.pois.map((poi: any) => ({
            id: poi.id,
            name: poi.name,
            address: poi.address || '',
            lng: poi.location.lng,
            lat: poi.location.lat,
            distance: poi.distance,
            type: poi.type,
          }))
          resolve(pois)
        } else {
          console.log('searchPOI result:', status, result)
          resolve([])
        }
      }
    )
  })
}

export async function searchByKeyword(keyword: string, city?: string): Promise<any[]> {
  if (!window.AMap) {
    console.error('AMap not loaded')
    return []
  }

  try {
    await loadPlugin('PlaceSearch')
  } catch (e) {
    console.error('PlaceSearch plugin failed to load:', e)
    return []
  }

  return new Promise((resolve) => {
    const placeSearch = new window.AMap.PlaceSearch({
      pageSize: 10,
      pageIndex: 1,
      city: city || '全国',
      citylimit: !!city, // 如果指定了城市，则限制在该城市范围内搜索
    })

    placeSearch.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.poiList?.pois) {
        resolve(result.poiList.pois)
      } else {
        resolve([])
      }
    })
  })
}

export async function getCityFromLocation(lng: number, lat: number): Promise<string> {
  if (!window.AMap) {
    return Promise.resolve('')
  }

  try {
    await loadPlugin('Geocoder')
  } catch (e) {
    console.error('Geocoder plugin failed to load:', e)
    return ''
  }

  return new Promise((resolve) => {
    const geocoder = new window.AMap.Geocoder()

    geocoder.getAddress([lng, lat], (status: string, result: any) => {
      if (status === 'complete' && result.regeocode) {
        resolve(result.regeocode.addressComponent.city || result.regeocode.addressComponent.province || '')
      } else {
        resolve('')
      }
    })
  })
}

/**
 * 获取当前定位的城市
 */
export async function getCurrentCity(): Promise<City | null> {
  if (!window.AMap) {
    console.error('AMap not loaded')
    return null
  }

  try {
    await loadPlugin('Geolocation')
  } catch (e) {
    console.error('Geolocation plugin failed to load:', e)
    return null
  }

  return new Promise((resolve) => {
    const geolocation = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 5000,
    })

    geolocation.getCityInfo((status: string, result: any) => {
      console.log('getCityInfo 回调:', { status, result })
      if (status === 'complete') {
        const city = {
          name: result.city || result.province,
          adcode: result.adcode,
          center: result.center ? {
            lng: result.center.lng,
            lat: result.center.lat
          } : undefined
        }
        console.log('定位成功，城市信息:', city)
        resolve(city)
      } else {
        console.error('获取城市失败:', result)
        resolve(null)
      }
    })
  })
}

/**
 * 搜索城市（支持模糊搜索）
 */
export async function searchCity(keyword: string): Promise<City[]> {
  if (!window.AMap || !keyword.trim()) {
    return []
  }

  try {
    await loadPlugin('DistrictSearch')
  } catch (e) {
    console.error('DistrictSearch plugin failed to load:', e)
    return []
  }

  return new Promise((resolve) => {
    const districtSearch = new window.AMap.DistrictSearch({
      level: 'city',
      subdistrict: 0,
      showbiz: false,
      extensions: 'base',
    })

    districtSearch.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.districtList?.length) {
        const cities: City[] = result.districtList
          .map((district: any) => {
            const center = district.center
            let lng: number | null = null
            let lat: number | null = null

            if (typeof center === 'string') {
              const [lngStr, latStr] = center.split(',')
              lng = Number(lngStr)
              lat = Number(latStr)
            } else if (center && typeof center === 'object') {
              lng = Number(center.lng ?? center.getLng?.())
              lat = Number(center.lat ?? center.getLat?.())
            }

            if (!district.adcode || !Number.isFinite(lng) || !Number.isFinite(lat)) return null

            return {
              name: district.name,
              adcode: district.adcode,
              center: {
                lng,
                lat,
              },
            }
          })
          .filter(Boolean) as City[]

        resolve(cities.slice(0, 10))
      } else {
        resolve([])
      }
    })
  })
}

/**
 * 获取热门城市列表
 */
export function getHotCities(): City[] {
  return [
    { name: '北京', adcode: '110000' },
    { name: '上海', adcode: '310000' },
    { name: '广州', adcode: '440100' },
    { name: '深圳', adcode: '440300' },
    { name: '杭州', adcode: '330100' },
    { name: '成都', adcode: '510100' },
    { name: '重庆', adcode: '500000' },
    { name: '武汉', adcode: '420100' },
    { name: '西安', adcode: '610100' },
    { name: '南京', adcode: '320100' },
    { name: '苏州', adcode: '320500' },
    { name: '天津', adcode: '120000' },
    { name: '长沙', adcode: '430100' },
    { name: '郑州', adcode: '410100' },
    { name: '东莞', adcode: '441900' },
    { name: '青岛', adcode: '370200' },
    { name: '沈阳', adcode: '210100' },
    { name: '大连', adcode: '210200' },
    { name: '厦门', adcode: '350200' },
    { name: '济南', adcode: '370100' },
  ]
}

/**
 * 根据城市名称获取城市信息（包含中心点坐标）
 */
export async function getCityByName(cityName: string): Promise<City | null> {
  if (!window.AMap || !cityName.trim()) {
    return null
  }

  try {
    await loadPlugin('Geocoder')
  } catch (e) {
    console.error('Geocoder plugin failed to load:', e)
    return null
  }

  return new Promise((resolve) => {
    const geocoder = new window.AMap.Geocoder({ city: cityName })

    geocoder.getLocation(cityName, (status: string, result: any) => {
      if (status === 'complete' && result.geocodes?.length > 0) {
        const geo = result.geocodes[0]
        resolve({
          name: cityName,
          adcode: geo.adcode,
          center: {
            lng: geo.location.lng,
            lat: geo.location.lat
          }
        })
      } else {
        resolve(null)
      }
    })
  })
}

/**
 * 获取 POI 详情
 */
export async function getPOIDetail(poiId: string): Promise<POIDetail | null> {
  if (!window.AMap || !poiId) {
    return null
  }

  try {
    await loadPlugin('PlaceSearch')
  } catch (e) {
    console.error('PlaceSearch plugin failed to load:', e)
    return null
  }

  return new Promise((resolve) => {
    const placeSearch = new window.AMap.PlaceSearch({
      extensions: 'all' // 返回详细信息
    })

    placeSearch.getDetails(poiId, (status: string, result: any) => {
      if (status === 'complete' && result.poiList?.pois?.length > 0) {
        const poi = result.poiList.pois[0]
        const rawBizExt = poi.biz_ext ?? poi.bizExt ?? {}
        let bizExt: any = rawBizExt
        if (typeof rawBizExt === 'string') {
          try {
            bizExt = JSON.parse(rawBizExt)
          } catch {
            bizExt = {}
          }
        }

        const parseNumeric = (value: unknown): number | undefined => {
          if (typeof value === 'number' && Number.isFinite(value)) return value
          if (typeof value === 'string') {
            const n = parseFloat(value)
            return Number.isFinite(n) ? n : undefined
          }
          return undefined
        }

        // photos 字段可能是数组、字符串或 undefined，需要做类型检查
        let photos: { url: string }[] = []
        if (Array.isArray(poi.photos)) {
          photos = poi.photos.map((p: any) => ({ url: p.url }))
        }
        const rating = parseNumeric(bizExt.rating ?? bizExt.star ?? poi.rating)
        const averageCost = parseNumeric(
          bizExt.cost ?? bizExt.avg_cost ?? bizExt.average_cost ?? poi.cost
        )
        const openTimeRange =
          bizExt.open_time ??
          bizExt.openTime ??
          bizExt.opentime ??
          poi.open_time ??
          poi.opentime ??
          undefined
        const openTimeDescription =
          bizExt.opentime2 ??
          bizExt.open_time2 ??
          bizExt.openTime2 ??
          poi.opentime2 ??
          undefined
        const detail: POIDetail = {
          id: poi.id,
          name: poi.name,
          address: poi.address || '',
          lng: poi.location.lng,
          lat: poi.location.lat,
          distance: poi.distance,
          type: poi.type,
          tel: poi.tel || undefined,
          photos,
          rating,
          averageCost,
          openTimeRange,
          openTimeDescription,
          openingHours: openTimeDescription || openTimeRange || poi.business_hours || undefined,
          website: poi.website || undefined,
          cityname: poi.cityname || undefined,
          adname: poi.adname || undefined,
          businessArea: poi.business_area || undefined
        }
        resolve(detail)
      } else {
        console.log('getPOIDetail result:', status, result)
        resolve(null)
      }
    })
  })
}

/**
 * 路径规划结果
 */
export interface RouteResult {
  duration: number // 时间（秒）
  distance: number // 距离（米）
  path: Array<{ lng: number; lat: number }> // 路线点位
}

/**
 * 驾车路径规划
 */
export async function getDrivingRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<RouteResult | null> {
  if (!window.AMap) {
    console.error('AMap not loaded')
    return null
  }

  // 检查 Driving 构造函数是否可用
  if (!window.AMap.Driving) {
    console.error('AMap.Driving not available, trying to load plugin')
    try {
      await loadPlugin('AMap.Driving')
    } catch (e) {
      console.error('Driving plugin failed to load:', e)
      return null
    }
  }

  // 再次检查
  if (!window.AMap.Driving) {
    console.error('AMap.Driving still not available after loading')
    return null
  }

  return new Promise((resolve) => {
    try {
      let settled = false
      const finish = (route: RouteResult | null) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(route)
      }
      const timeoutId = setTimeout(() => {
        console.warn('Driving search timeout')
        finish(null)
      }, ROUTE_SEARCH_TIMEOUT_MS)

      const driving = new window.AMap.Driving({
        policy: 0, // 0: 最快捷模式
      })

      const start = new window.AMap.LngLat(startLng, startLat)
      const end = new window.AMap.LngLat(endLng, endLat)

      driving.search(start, end, (status: string, result: any) => {
        if (status === 'complete' && result.routes?.length > 0) {
          const route = result.routes[0]

          // 提取路线点位
          const path: Array<{ lng: number; lat: number }> = []
          if (route.steps) {
            route.steps.forEach((step: any) => {
              if (step.path) {
                step.path.forEach((point: any) => {
                  path.push({ lng: point.lng, lat: point.lat })
                })
              }
            })
          }

          finish({
            duration: route.time, // 秒
            distance: route.distance, // 米
            path,
          })
        } else {
          console.warn('Driving search failed:', status, result?.info || result)
          finish(null)
        }
      })
    } catch (e) {
      console.error('Driving search error:', e)
      resolve(null)
    }
  })
}

/**
 * 公交路径规划
 */
export async function getTransitRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  city: string = '北京'
): Promise<RouteResult | null> {
  if (!window.AMap) {
    console.error('AMap not loaded')
    return null
  }

  // 检查 Transfer 构造函数是否可用
  if (!window.AMap.Transfer) {
    console.error('AMap.Transfer not available, trying to load plugin')
    try {
      await loadPlugin('AMap.Transfer')
    } catch (e) {
      console.error('Transfer plugin failed to load:', e)
      return null
    }
  }

  // 再次检查
  if (!window.AMap.Transfer) {
    console.error('AMap.Transfer still not available after loading')
    return null
  }

  return new Promise((resolve) => {
    try {
      let settled = false
      const finish = (route: RouteResult | null) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(route)
      }
      const timeoutId = setTimeout(() => {
        console.warn('Transfer search timeout')
        finish(null)
      }, ROUTE_SEARCH_TIMEOUT_MS)

      const transfer = new window.AMap.Transfer({
        city: city,
        policy: 0, // 0: 最快捷模式
      })

      const start = new window.AMap.LngLat(startLng, startLat)
      const end = new window.AMap.LngLat(endLng, endLat)

      transfer.search(start, end, (status: string, result: any) => {
        if (status === 'complete' && result.plans?.length > 0) {
          const plan = result.plans[0]

          // 提取路线点位
          const path: Array<{ lng: number; lat: number }> = []
          if (plan.segments) {
            plan.segments.forEach((segment: any) => {
              // 步行段
              if (segment.walking?.path) {
                segment.walking.path.forEach((point: any) => {
                  path.push({ lng: point.lng, lat: point.lat })
                })
              }
              // 公交段
              if (segment.transit?.path) {
                segment.transit.path.forEach((point: any) => {
                  path.push({ lng: point.lng, lat: point.lat })
                })
              }
              // 地铁段可能在 transit.lines 中
              if (segment.transit?.lines) {
                segment.transit.lines.forEach((line: any) => {
                  if (line.path) {
                    line.path.forEach((point: any) => {
                      path.push({ lng: point.lng, lat: point.lat })
                    })
                  }
                })
              }
            })
          }

          finish({
            duration: plan.time, // 秒
            distance: plan.distance, // 米
            path,
          })
        } else {
          console.warn('Transfer search failed:', status, result?.info || result)
          finish(null)
        }
      })
    } catch (e) {
      console.error('Transfer search error:', e)
      resolve(null)
    }
  })
}

/**
 * 批量路线结果
 */
export interface BatchRouteResult {
  times: number[] // 通勤时间（分钟）
  routes: Array<RouteResult | null> // 完整路线数据
}

export interface CurrentLocationResult {
  lng: number
  lat: number
  address?: string
  city?: string
}

/**
 * 获取当前精确位置（经纬度）
 */
export async function getCurrentLocation(): Promise<CurrentLocationResult | null> {
  if (!window.AMap) {
    console.error('AMap not loaded')
    return null
  }

  try {
    await loadPlugin('Geolocation')
  } catch (e) {
    console.error('Geolocation plugin failed to load:', e)
    return null
  }

  return new Promise((resolve) => {
    const geolocation = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 8000,
      convert: true,
    })

    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete' && result?.position) {
        resolve({
          lng: result.position.lng,
          lat: result.position.lat,
          address: result.formattedAddress || result.addressComponent?.street || '',
          city: result.addressComponent?.city || result.addressComponent?.province || '',
        })
      } else {
        console.error('getCurrentPosition failed:', status, result)
        resolve(null)
      }
    })
  })
}

/**
 * 批量获取路径规划时间和路线
 */
export async function getBatchRouteTimes(
  points: Array<{ lng: number; lat: number }>,
  targetLng: number,
  targetLat: number,
  mode: MidPointMode,
  city?: string
): Promise<BatchRouteResult> {
  if (mode === 'straight') {
    // 直线距离模式，返回基于距离估算的时间（假设平均速度 30km/h）
    const times = points.map((point) => {
      const distance = window.AMap?.GeometryUtil?.distance(
        new window.AMap.LngLat(point.lng, point.lat),
        new window.AMap.LngLat(targetLng, targetLat)
      ) || 0
      return Math.round(distance / 500) // 500米/分钟 ≈ 30km/h
    })
    // 直线模式不返回路线
    return { times, routes: points.map(() => null) }
  }

  console.log(`开始批量计算 ${mode} 路线，共 ${points.length} 个点`)

  const results: Array<{ time: number; route: RouteResult | null }> = []
  for (let start = 0; start < points.length; start += ROUTE_BATCH_SIZE) {
    const batch = points.slice(start, start + ROUTE_BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (point, batchIndex) => {
        const index = start + batchIndex
        try {
          let route: RouteResult | null = null

          if (mode === 'driving') {
            route = await getDrivingRoute(point.lng, point.lat, targetLng, targetLat)
          } else if (mode === 'transit') {
            route = await getTransitRoute(point.lng, point.lat, targetLng, targetLat, city || '北京')
          }

          if (route) {
            const minutes = Math.round(route.duration / 60)
            console.log(`点 ${index + 1}: ${minutes} 分钟, 路线点数: ${route.path.length}`)
            return { time: minutes, route }
          } else {
            console.warn(`点 ${index + 1}: 路线规划失败`)
            return { time: 999, route: null }
          }
        } catch (e) {
          console.error(`点 ${index + 1}: 路线规划异常`, e)
          return { time: 999, route: null }
        }
      })
    )

    results.push(...batchResults)

    if (start + ROUTE_BATCH_SIZE < points.length) {
      await sleep(ROUTE_BATCH_DELAY_MS)
    }
  }

  const times = results.map(r => r.time)
  const routes = results.map(r => r.route)

  console.log('批量路线计算结果:', times)
  return { times, routes }
}
