import { useEffect, useRef } from 'react'
import { LocationPoint, MidPoint, POI, City, SearchRadius, SearchType } from '@/types'

interface MapViewProps {
  points: LocationPoint[]
  midPoint: MidPoint | null
  onMapClick: (lng: number, lat: number) => void
  selectedPOI: POI | null
  currentCity?: City | null
  searchRadius?: SearchRadius
  pois?: POI[]
  searchType?: SearchType | null
  onSelectPOI?: (poi: POI) => void
}

// 搜索类型对应的图标和颜色配置
const searchTypeIconConfig: Record<string, { icon: string; color: string }> = {
  '餐厅': { icon: 'icon-canyin', color: '#ff6b6b' },
  '咖啡厅': { icon: 'icon-kafeiting', color: '#845ef7' },
  '奶茶店': { icon: 'icon-zhenzhunaicha', color: '#20c997' },
  '商场': { icon: 'icon-shangchang1', color: '#20c997' },
  '酒吧': { icon: 'icon-jiubajiulang', color: '#fd7e14' },
  '酒店': { icon: 'icon-jiudian', color: '#20c997' },
  '医院': { icon: 'icon-yiyuan', color: '#20c997' },
  '地铁站': { icon: 'icon-ditiezhan', color: '#20c997' },
  '公交站': { icon: 'icon-gongjiaozhan', color: '#20c997' },
  '火车高铁': { icon: 'icon-huoche', color: '#20c997' },
  'custom': { icon: 'icon-sousuo', color: '#667eea' },
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

export default function MapView({ points, midPoint, onMapClick, selectedPOI, currentCity, searchRadius = 1000, pois = [], searchType, onSelectPOI }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const poiMarkersRef = useRef<any[]>([])
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

  // 更新地图标记（用户添加的地点）
  useEffect(() => {
    if (!mapInstanceRef.current) return

    markersRef.current.forEach((marker) => marker?.setMap(null))
    markersRef.current = []

    const map = mapInstanceRef.current

    points.forEach((point, index) => {
      const letter = String.fromCharCode(65 + index)
      const markerContent = `
        <div style="
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        ">${letter}</div>
      `
      const marker = new window.AMap.Marker({
        position: [point.lng, point.lat],
        title: point.name,
        content: markerContent,
        offset: new window.AMap.Pixel(-16, -16),
      })
      marker.setMap(map)
      markersRef.current.push(marker)
    })

    const allPositions = [
      ...points.map((p) => [p.lng, p.lat]),
      ...(midPoint ? [[midPoint.lng, midPoint.lat]] : []),
    ]
    // 只在有多个点时自动调整视野，且限制最大缩放级别
    if (allPositions.length > 1) {
      map.setFitView(null, false, [50, 50, 50, 50], 15) // maxZoom 限制为 15
    }
  }, [points, midPoint])

  // 更新 POI 标记
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // 清除旧的 POI 标记
    poiMarkersRef.current.forEach((marker) => marker?.setMap(null))
    poiMarkersRef.current = []

    const map = mapInstanceRef.current
    const iconConfig = searchType ? searchTypeIconConfig[searchType] : searchTypeIconConfig['custom']

    pois.forEach((poi) => {
      const isSelected = selectedPOI?.id === poi.id
      const markerContent = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${isSelected ? '32px' : '24px'};
          height: ${isSelected ? '32px' : '24px'};
          background: ${isSelected ? iconConfig.color : 'white'};
          border: 2px solid ${iconConfig.color};
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          transition: all 0.2s;
        ">
          <i class="iconfont ${iconConfig.icon}" style="
            font-size: ${isSelected ? '16px' : '12px'};
            color: ${isSelected ? 'white' : iconConfig.color};
          "></i>
        </div>
      `

      const marker = new window.AMap.Marker({
        position: [poi.lng, poi.lat],
        content: markerContent,
        offset: new window.AMap.Pixel(isSelected ? -16 : -12, isSelected ? -16 : -12),
        title: poi.name,
        zIndex: isSelected ? 100 : 80,
      })

      // 添加点击事件
      marker.on('click', () => {
        onSelectPOI?.(poi)
      })

      marker.setMap(map)
      poiMarkersRef.current.push(marker)
    })
  }, [pois, selectedPOI, searchType, onSelectPOI])

  return (
    <div
      ref={mapRef}
      className="fullscreen-map"
    />
  )
}
