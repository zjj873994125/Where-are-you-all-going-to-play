import { POI, City } from '@/types'

declare global {
  interface Window {
    AMap: any
  }
}

// 确保插件加载完成
function loadPlugin(pluginName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AMap && window.AMap[pluginName]) {
      resolve()
      return
    }
    window.AMap?.plugin([pluginName], () => {
      if (window.AMap && window.AMap[pluginName]) {
        resolve()
      } else {
        reject(new Error(`Plugin ${pluginName} failed to load`))
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
      type: keyword,
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
          resolve([])
        }
      }
    )
  })
}

export async function searchByKeyword(keyword: string): Promise<any[]> {
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
    await loadPlugin('AutoComplete')
  } catch (e) {
    console.error('AutoComplete plugin failed to load:', e)
    return []
  }

  return new Promise((resolve) => {
    const autoComplete = new window.AMap.AutoComplete({
      city: '全国'
    })

    autoComplete.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.tips) {
        const cities: City[] = result.tips
          .filter((tip: any) => tip.location && (tip.type === '城市' || tip.adcode))
          .map((tip: any) => ({
            name: tip.name || tip.district,
            adcode: tip.adcode,
            center: {
              lng: tip.location.lng,
              lat: tip.location.lat
            }
          }))
          // 去重
          .filter((city: City, index: number, self: City[]) =>
            index === self.findIndex((c: City) => c.name === city.name)
          )
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
