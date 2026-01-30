import { useEffect, useRef } from 'react'
import { LocationPoint, MidPoint, POI, City, SearchRadius } from '@/types'

interface MapViewProps {
  points: LocationPoint[]
  midPoint: MidPoint | null
  onMapClick: (lng: number, lat: number) => void
  selectedPOI: POI | null
  currentCity?: City | null
  searchRadius?: SearchRadius
}

// 常见城市中心点坐标
const cityCenterMap: Record<string, [number, number]> = {
  '北京': [116.397428, 39.90923],
  '上海': [121.473701, 31.230416],
  '广州': [113.264385, 23.129112],
  '深圳': [114.057868, 22.543099],
  '杭州': [120.153576, 30.287459],
  '成都': [104.066541, 30.572269],
  '重庆': [106.551556, 29.563009],
  '武汉': [114.305393, 30.593099],
  '西安': [108.93977, 34.341574],
  '南京': [118.796877, 32.060255],
  '苏州': [120.619585, 31.317987],
  '天津': [117.190091, 39.125596],
  '长沙': [112.938814, 28.228209],
  '郑州': [113.625368, 34.746599],
  '东莞': [113.751837, 23.020269],
  '青岛': [120.382631, 36.067108],
  '沈阳': [123.431474, 41.805698],
  '大连': [121.614682, 38.914003],
  '厦门': [118.089425, 24.479833],
  '济南': [117.1205, 36.650999],
}

// 获取城市中心点坐标
function getCityCenter(city: City | null | undefined): [number, number] {
  if (!city) {
    return cityCenterMap['北京']
  }

  if (city.center) {
    return [city.center.lng, city.center.lat]
  }

  // 尝试精确匹配
  if (cityCenterMap[city.name]) {
    return cityCenterMap[city.name]
  }

  // 尝试去除"市"字后匹配
  const nameWithoutSuffix = city.name.replace(/市$/, '')
  if (cityCenterMap[nameWithoutSuffix]) {
    return cityCenterMap[nameWithoutSuffix]
  }

  return cityCenterMap['北京']
}

export default function MapView({ points, midPoint, onMapClick, selectedPOI, currentCity, searchRadius = 1000 }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const circleRef = useRef<any>(null)
  const initializedCityRef = useRef<string | null>(null)

  // 初始化或更新地图
  useEffect(() => {
    let checkAMap: NodeJS.Timeout | null = null

    const initOrUpdateMap = () => {
      if (!window.AMap || !mapRef.current) return

      const cityName = currentCity?.name || null
      const center = getCityCenter(currentCity)

      // 如果地图还没初始化，创建新地图
      if (!mapInstanceRef.current) {
        const map = new window.AMap.Map(mapRef.current, {
          zoom: 12,
          center: center,
          mapStyle: 'amap://styles/normal',
          viewMode: '2D',
        })

        map.on('click', (e: any) => {
          onMapClick(e.lnglat.lng, e.lnglat.lat)
        })

        mapInstanceRef.current = map
        initializedCityRef.current = cityName
      } else if (cityName && cityName !== initializedCityRef.current) {
        // 城市变化，更新地图中心
        mapInstanceRef.current.setCenter(center)
        mapInstanceRef.current.setZoom(12)
        initializedCityRef.current = cityName
      }
    }

    // 立即尝试初始化
    initOrUpdateMap()

    // 如果还没初始化，轮询等待
    if (!mapInstanceRef.current) {
      checkAMap = setInterval(() => {
        initOrUpdateMap()
      }, 100)
    }

    return () => {
      if (checkAMap) clearInterval(checkAMap)
    }
  }, [currentCity])

  // 绘制/更新搜索范围圆圈
  useEffect(() => {
    if (!mapInstanceRef.current || !midPoint) {
      // 移除圆圈
      if (circleRef.current) {
        circleRef.current.setMap(null)
        circleRef.current = null
      }
      return
    }

    const map = mapInstanceRef.current

    // 移除旧圆圈
    if (circleRef.current) {
      circleRef.current.setMap(null)
    }

    // 创建新圆圈
    const circle = new window.AMap.Circle({
      center: [midPoint.lng, midPoint.lat],
      radius: searchRadius,
      strokeColor: '#ef4444',
      strokeOpacity: 0.5,
      strokeWeight: 2,
      fillColor: '#ef4444',
      fillOpacity: 0.1,
      zIndex: 50,
    })

    circle.setMap(map)
    circleRef.current = circle
  }, [midPoint, searchRadius])

  // 更新地图标记
  useEffect(() => {
    if (!mapInstanceRef.current) return

    markersRef.current.forEach((marker) => marker?.setMap(null))
    markersRef.current = []

    const map = mapInstanceRef.current

    points.forEach((point, index) => {
      const marker = new window.AMap.Marker({
        position: [point.lng, point.lat],
        title: point.name,
        label: {
          content: `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);">${String.fromCharCode(65 + index)}</div>`,
          direction: 'top',
        },
      })
      marker.setMap(map)
      markersRef.current.push(marker)
    })

    // 中点不再显示标记，只显示范围圆圈
    // if (midPoint) {
    //   ...
    // }

    if (selectedPOI) {
      const poiMarker = new window.AMap.Marker({
        position: [selectedPOI.lng, selectedPOI.lat],
        icon: new window.AMap.Icon({
          image: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
              <path d="M20 4 L8 18 C6 20 5 23 5 26 C5 32 10 36 20 36 C30 36 35 32 35 26 C35 23 34 20 32 18 L20 4Z" fill="#10b981"/>
              <circle cx="20" cy="22" r="5" fill="white"/>
            </svg>
          `),
          size: new window.AMap.Size(36, 36),
          imageSize: new window.AMap.Size(36, 36),
        }),
        title: selectedPOI.name,
        zIndex: 90,
      })
      poiMarker.setMap(map)
      markersRef.current.push(poiMarker)
    }

    const allPositions = [
      ...points.map((p) => [p.lng, p.lat]),
      midPoint ? [midPoint.lng, midPoint.lat] : [],
    ].filter(Boolean)

    if (allPositions.length > 0) {
      map.setFitView()
    }
  }, [points, midPoint, selectedPOI])

  return (
    <div
      ref={mapRef}
      className="fullscreen-map"
    />
  )
}
