import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import MapView from './components/MapView'
import LocationPanel from './components/LocationPanel'
import POIList from './components/POIList'
import CitySelector from './components/CitySelector'
import POIDetailCard from './components/POIDetailCard'
import { LocationPoint, MidPoint, POI, POIDetail, SearchType, SearchRadius, City } from './types'
import { calculateMidPoint } from './utils/mapCalc'
import { searchPOI, getCurrentCity, getPOIDetail } from './utils/amap'
import './App.css'

function App() {
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [points, setPoints] = useState<LocationPoint[]>([])
  const [midPoint, setMidPoint] = useState<MidPoint | null>(null)
  const [pois, setPois] = useState<POI[]>([])
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchRadius, setSearchRadius] = useState<SearchRadius>(1000)
  const [activeSearchType, setActiveSearchType] = useState<SearchType | null>(null)
  const [poiDetail, setPoiDetail] = useState<POIDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [focusPoint, setFocusPoint] = useState<LocationPoint | null>(null)
  const [isSatellite, setIsSatellite] = useState(false)
  const [isRanging, setIsRanging] = useState(false)

  // 卡片收起/展开状态（移动端默认收起）
  const isMobile = window.innerWidth <= 768
  const [panelStates, setPanelStates] = useState({
    location: !isMobile,
    poi: false,
  })

  // 首次进入自动获取当前城市
  useEffect(() => {
    console.log('App: useEffect 执行，开始定位流程')

    let checkAMap: NodeJS.Timeout | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let hasCompleted = false

    const completeInit = (city: City | null) => {
      if (hasCompleted) return
      hasCompleted = true

      if (checkAMap) clearInterval(checkAMap)
      if (timeoutId) clearTimeout(timeoutId)

      if (city) {
        console.log('App: 设置城市', city.name)
        setCurrentCity(city)
        message.success(`已定位到：${city.name}`)
      } else {
        console.log('App: 定位失败，使用默认北京')
        setCurrentCity({ name: '北京', adcode: '110000' })
      }
    }

    const initCity = () => {
      console.log('App: initCity 调用，window.AMap =', !!window.AMap)
      if (window.AMap && !hasCompleted) {
        getCurrentCity().then((city) => {
          console.log('App: 定位返回', city)
          completeInit(city)
        }).catch((e) => {
          console.log('App: 定位异常', e)
          completeInit(null)
        })
      }
    }

    // 立即尝试
    initCity()

    // 轮询等待 AMap 加载
    checkAMap = setInterval(() => {
      if (!hasCompleted) {
        initCity()
      }
    }, 100)

    // 超时处理
    timeoutId = setTimeout(() => {
      if (!hasCompleted) {
        console.log('App: 超时，使用默认北京')
        completeInit(null)
      }
    }, 5000)

    return () => {
      if (checkAMap) clearInterval(checkAMap)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, []) // 只执行一次

  const handleCityChange = useCallback((city: City) => {
    setCurrentCity(city)
    setPoints([])
    setMidPoint(null)
    setPois([])
    setSelectedPOI(null)
    setActiveSearchType(null)
    setPoiDetail(null)
    message.success(`已切换到：${city.name}`)
  }, [])

  const handleAddPoint = useCallback((point: LocationPoint) => {
    setPoints((prev) => {
      const newPoints = [...prev, point]
      const mid = calculateMidPoint(newPoints)
      setMidPoint(mid)
      return newPoints
    })
  }, [])

  const handleRemovePoint = useCallback((id: string) => {
    setPoints((prev) => {
      const newPoints = prev.filter((p) => p.id !== id)
      const mid = calculateMidPoint(newPoints)
      setMidPoint(mid)
      if (newPoints.length < 2) {
        setPois([])
      }
      return newPoints
    })
  }, [])

  const handleClearAll = useCallback(() => {
    setPoints([])
    setMidPoint(null)
    setPois([])
    setSelectedPOI(null)
    setActiveSearchType(null)
    setPoiDetail(null)
  }, [])

  const handleMapClick = useCallback((lng: number, lat: number) => {
    const point: LocationPoint = {
      id: Date.now().toString(),
      name: `自定义点位`,
      lng,
      lat,
    }
    handleAddPoint(point)
  }, [points.length, handleAddPoint])

  const handleSearch = useCallback(async (type: SearchType, keyword?: string, radius: SearchRadius = 500) => {
    if (!midPoint) return

    setIsSearching(true)
    setActiveSearchType(type)
    try {
      const results = await searchPOI(keyword || type, midPoint.lng, midPoint.lat, radius)
      setPois(results)
      if (results.length > 0) {
        setSelectedPOI(null)
        setPoiDetail(null)
        // 自动展开POI面板
        setPanelStates(prev => ({ ...prev, poi: true }))
      } else {
        message.info('未找到相关场所')
      }
    } catch (error) {
      console.error('Search failed:', error)
      message.error('搜索失败，请重试')
    } finally {
      setIsSearching(false)
    }
  }, [midPoint])

  const handleSelectPOI = useCallback(async (poi: POI) => {
    setSelectedPOI(poi)
    setIsLoadingDetail(true)
    setPoiDetail(null)
    try {
      const detail = await getPOIDetail(poi.id)
      if (detail) {
        detail.distance = poi.distance
        setPoiDetail(detail)
      }
    } catch (error) {
      console.error('获取POI详情失败:', error)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  const togglePanel = useCallback((panel: 'location' | 'poi') => {
    setPanelStates(prev => ({ ...prev, [panel]: !prev[panel] }))
  }, [])

  return (
    <div className="app-container">
      {/* 全屏地图 */}
      <MapView
        points={points}
        midPoint={midPoint}
        onMapClick={handleMapClick}
        selectedPOI={selectedPOI}
        currentCity={currentCity}
        searchRadius={searchRadius}
        pois={pois}
        searchType={activeSearchType}
        onSelectPOI={handleSelectPOI}
        focusPoint={focusPoint}
        isSatellite={isSatellite}
        isRanging={isRanging}
        onRangingEnd={() => setIsRanging(false)}
      />

      {/* 顶部栏 - 城市选择器和搜索范围 */}
      <div className="top-bar">
        <CitySelector
          currentCity={currentCity}
          onCityChange={handleCityChange}
        />
        {midPoint && (
          <div className="midpoint-card">
            <div className="midpoint-icon">🎯</div>
            <div className="midpoint-info">
              <div className="midpoint-label">搜索范围</div>
              <div className="midpoint-coords">
                {searchRadius < 1000 ? `${searchRadius}m` : `${searchRadius / 1000}km`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 左侧悬浮面板 - 地点添加 */}
      <div className="floating-panels-left">
        <div
          className={`floating-panel location-panel-wrapper ${panelStates.location ? 'expanded' : 'collapsed'}`}
        >
          <div className="panel-header" onClick={() => togglePanel('location')}>
            <span className="panel-title">
              <span className="title-icon">📍</span>
              <span className="title-text" style={{color: 'rgb(158, 158, 158)'}}>添加地点</span>
            </span>
            <span className="toggle-icon">{panelStates.location ? '▼' : '▲'}</span>
          </div>
          {panelStates.location && (
            <LocationPanel
              points={points}
              onAddPoint={handleAddPoint}
              onRemovePoint={handleRemovePoint}
              onClearAll={handleClearAll}
              onSearch={handleSearch}
              onLocatePoint={setFocusPoint}
              isSearching={isSearching}
              searchRadius={searchRadius}
              onSearchRadiusChange={setSearchRadius}
              currentCity={currentCity}
            />
          )}
        </div>
      </div>
      {/* 地图工具栏 */}
      <div className="map-toolbar">
        <button
          className={`toolbar-btn ${isSatellite ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setIsSatellite(!isSatellite) }}
          title="卫星地图"
        >
          🛰️ 卫星
        </button>
        {!isMobile && (
          <button
            className={`toolbar-btn ${isRanging ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setIsRanging(!isRanging) }}
            title="测距工具"
          >
            📏 测距
          </button>
        )}
      </div>
      {/* 右侧悬浮面板 - 附近场所 */}
      {pois.length > 0 && (
        <div className="floating-panels-right">
          <div
            className={`floating-panel poi-panel-wrapper ${panelStates.poi ? 'expanded' : 'collapsed'}`}
          >
            <div className="panel-header" onClick={() => togglePanel('poi')}>
              <span className="panel-title">
                <span className="title-icon">🏪</span>
                <span className="title-text" style={{color: 'rgb(158, 158, 158)'}}>附近场所</span>
                <span className="count-badge">{pois.length}</span>
              </span>
              <span className="toggle-icon">{panelStates.poi ? '▼' : '▲'}</span>
            </div>
            {panelStates.poi && (
              <>
                <POIList
                  pois={pois}
                  selectedPOI={selectedPOI}
                  onSelectPOI={handleSelectPOI}
                />
              </>
            )}
          </div>

          {/* POI 详情卡片 */}
          {(selectedPOI && (isLoadingDetail || poiDetail)) && (
            <POIDetailCard
              detail={poiDetail}
              isLoading={isLoadingDetail}
              onClose={() => {
                setSelectedPOI(null)
                setPoiDetail(null)
              }}
            />
          )}
        </div>
      )}

      {/* 提示信息 */}
      {points.length === 0 && (
        <div className="welcome-tip">
          <div className="tip-content">
            <div className="tip-icon">👆</div>
            <div className="tip-text">点击地图添加地点</div>
            <div className="tip-text">杰哥大地图</div>
            <div className="tip-sub">添加至少2个地点后计算中点</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
