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
  '餐厅': { icon: 'icon-canyin', color: 'rgb(240, 152, 56)' },
  '咖啡厅': { icon: 'icon-kafeiting', color: 'rgb(240, 152, 56)' },
  '奶茶店': { icon: 'icon-zhenzhunaicha', color: 'rgb(240, 152, 56)' },
  '商场': { icon: 'icon-shangchang1', color: 'rgb(195, 112, 231)' },
  '酒吧': { icon: 'icon-jiubajiulang', color: 'rgb(231, 102, 152)' },
  '酒店': { icon: 'icon-jiudian', color: 'rgb(159, 138, 229)' },
  '医院': { icon: 'icon-yiyuan', color: 'rgb(239, 123, 132)' },
  '地铁站': { icon: 'icon-ditiezhan', color: 'rgb(216, 71, 86)' },
  '公交站': { icon: 'icon-gongjiaoche', color: 'rgb(102, 198, 76)' },
  '火车站': { icon: 'icon-a-zu6661', color: 'rgb(88, 140, 247)' },
  'custom': { icon: 'icon-sousuo', color: 'rgb(134, 181, 255)' },
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
  const clusterRef = useRef<any>(null)
  const selectedMarkerRef = useRef<any>(null)
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

  // 更新 POI 标记（使用点聚合）
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    // 清除旧的聚合和标记
    if (clusterRef.current) {
      clusterRef.current.setMap(null)
      clusterRef.current = null
    }
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null)
      selectedMarkerRef.current = null
    }
    poiMarkersRef.current.forEach((marker) => marker?.setMap(null))
    poiMarkersRef.current = []

    if (pois.length === 0) return

    const iconConfig = searchType ? searchTypeIconConfig[searchType] : searchTypeIconConfig['custom']

    // 分离选中和未选中的 POI
    const unselectedPois = pois.filter(poi => selectedPOI?.id !== poi.id)
    const selectedPoiData = pois.find(poi => selectedPOI?.id === poi.id)

    // 渲染选中的 POI（单独显示，不参与聚合）
    if (selectedPoiData) {
      const selectedContent = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: ${iconConfig.color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        ">
          <i class="iconfont ${iconConfig.icon}" style="
            font-size: 22px;
            color: white;
          "></i>
        </div>
      `
      const selectedMarker = new window.AMap.Marker({
        position: [selectedPoiData.lng, selectedPoiData.lat],
        content: selectedContent,
        offset: new window.AMap.Pixel(-18, -18),
        title: selectedPoiData.name,
        zIndex: 200,
      })
      selectedMarker.on('click', () => onSelectPOI?.(selectedPoiData))
      selectedMarker.setMap(map)
      selectedMarkerRef.current = selectedMarker
    }

    // 使用点聚合处理未选中的 POI
    if (unselectedPois.length > 0 && window.AMap.MarkerCluster) {
      // 转换为数据点格式
      const dataPoints = unselectedPois.map(poi => ({
        lnglat: [poi.lng, poi.lat],
        poi: poi, // 存储原始数据
      }))

      const cluster = new window.AMap.MarkerCluster(map, dataPoints, {
        gridSize: 20,
        maxZoom: 14,
        // 渲染单个点
        renderMarker: (context: any) => {
          const poi = context.data[0].poi
          const content = `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              background: white;
              border: 2px solid ${iconConfig.color};
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
              cursor: pointer;
            ">
              <i class="iconfont ${iconConfig.icon}" style="
                font-size: 16px;
                color: ${iconConfig.color};
              "></i>
            </div>
          `
          context.marker.setContent(content)
          context.marker.setOffset(new window.AMap.Pixel(-14, -14))
          context.marker.on('click', () => onSelectPOI?.(poi))
        },
        // 渲染聚合点
        renderClusterMarker: (context: any) => {
          const count = context.count
          const div = document.createElement('div')
          div.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: ${iconConfig.color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            color: white;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
          `
          div.innerText = count > 99 ? '99+' : String(count)
          context.marker.setContent(div)
          context.marker.setOffset(new window.AMap.Pixel(-20, -20))
        },
      })
      clusterRef.current = cluster
    } else if (unselectedPois.length > 0) {
      // MarkerCluster 不可用时，直接添加标记
      unselectedPois.forEach((poi) => {
        const content = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: white;
            border: 2px solid ${iconConfig.color};
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          ">
            <i class="iconfont ${iconConfig.icon}" style="
              font-size: 16px;
              color: ${iconConfig.color};
            "></i>
          </div>
        `
        const marker = new window.AMap.Marker({
          position: [poi.lng, poi.lat],
          content: content,
          offset: new window.AMap.Pixel(-14, -14),
          title: poi.name,
          zIndex: 80,
        })
        marker.on('click', () => onSelectPOI?.(poi))
        marker.setMap(map)
        poiMarkersRef.current.push(marker)
      })
    }
  }, [pois, selectedPOI, searchType, onSelectPOI])

  return (
    <div
      ref={mapRef}
      className="fullscreen-map"
    />
  )
}
