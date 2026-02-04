import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { message, Modal, Checkbox, Divider, Tag, Button } from 'antd'
import { debounce } from 'lodash'
import MapView from './components/MapView'
import LocationPanel from './components/LocationPanel'
import POIList from './components/POIList'
import CitySelector from './components/CitySelector'
import POIDetailCard from './components/POIDetailCard'
import { LocationPoint, MidPoint, POI, POIDetail, SearchType, SearchRadius, City, MidPointMode } from './types'
import { calculateMidPoint, calculateWeightedMidPoint } from './utils/mapCalc'
import { searchPOI, getCurrentCity, getPOIDetail, RouteResult } from './utils/amap'
import { useFavorites } from './hooks/useFavorites'
import './App.css'

// 当前版本号
const APP_VERSION = '1.2.0'
const WELCOME_STORAGE_KEY = 'meetpoint_hide_welcome'

function App() {
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [points, setPoints] = useState<LocationPoint[]>([])
  const [midPoint, setMidPoint] = useState<MidPoint | null>(null)
  const [pois, setPois] = useState<POI[]>([])
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchRadius, setSearchRadius] = useState<SearchRadius>(1000)
  const [activeSearchType, setActiveSearchType] = useState<SearchType | null>(null)
  const [lastSearchKeyword, setLastSearchKeyword] = useState<string>('') // 保存上次搜索关键词
  const [poiDetail, setPoiDetail] = useState<POIDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [focusPoint, setFocusPoint] = useState<LocationPoint | null>(null)
  const [isSatellite, setIsSatellite] = useState(false)
  const [isRanging, setIsRanging] = useState(false)

  // 中点计算模式和通勤时间
  const [midPointMode, setMidPointMode] = useState<MidPointMode>('straight')
  const [travelTimes, setTravelTimes] = useState<number[]>([])
  const [travelRoutes, setTravelRoutes] = useState<Array<RouteResult | null>>([])
  const [isCalculatingMidPoint, setIsCalculatingMidPoint] = useState(false)

  // 使用说明弹窗
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(() => {
    // 初始化时从 localStorage 读取状态
    return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true'
  })

  // 收藏功能
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites()

  // 卡片收起/展开状态（移动端默认收起）
  const isMobile = window.innerWidth <= 768
  const [panelStates, setPanelStates] = useState({
    location: !isMobile,
    poi: false,
  })

  // 用于追踪定位是否已完成，避免 StrictMode 下重复执行
  const hasInitializedRef = useRef(false)
  const hasCheckedWelcomeRef = useRef(false)

  // 检查是否显示使用说明弹窗
  useEffect(() => {
    if (hasCheckedWelcomeRef.current) return
    hasCheckedWelcomeRef.current = true

    const hideWelcome = localStorage.getItem(WELCOME_STORAGE_KEY)
    if (hideWelcome !== 'true') {
      setShowWelcomeModal(true)
    }
  }, [])

  // 关闭弹窗时保存设置
  const handleCloseWelcome = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(WELCOME_STORAGE_KEY, 'true')
    } else {
      // 如果取消勾选，移除存储的设置，下次刷新会再次弹出
      localStorage.removeItem(WELCOME_STORAGE_KEY)
    }
    setShowWelcomeModal(false)
  }, [dontShowAgain])

  // 测距结束回调
  const handleRangingEnd = useCallback(() => {
    setIsRanging(false)
  }, [])

  // 首次进入自动获取当前城市
  useEffect(() => {
    // 如果已经初始化过，直接返回
    if (hasInitializedRef.current) return

    let checkAMap: NodeJS.Timeout | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let hasCompleted = false
    let isRequesting = false // 防止重复请求

    const completeInit = (city: City | null) => {
      if (hasCompleted || hasInitializedRef.current) return
      hasCompleted = true
      hasInitializedRef.current = true

      // 立即清除定时器
      if (checkAMap) {
        clearInterval(checkAMap)
        checkAMap = null
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (city) {
        setCurrentCity(city)
        message.success(`已定位到：${city.name}`)
      } else {
        setCurrentCity({ name: '北京', adcode: '110000' })
      }
    }

    const initCity = () => {
      // 如果已完成或正在请求中，直接返回
      if (hasCompleted || isRequesting || !window.AMap) return

      isRequesting = true
      getCurrentCity()
        .then((city) => {
          completeInit(city)
        })
        .catch(() => {
          completeInit(null)
        })
        .finally(() => {
          isRequesting = false
        })
    }

    // 立即尝试
    initCity()

    // 轮询等待 AMap 加载（仅在未完成时）
    checkAMap = setInterval(() => {
      if (!hasCompleted && !isRequesting) {
        initCity()
      }
    }, 100)

    // 超时处理
    timeoutId = setTimeout(() => {
      if (!hasCompleted) {
        completeInit(null)
      }
    }, 5000)

    return () => {
      hasCompleted = true // 组件卸载时标记为已完成
      if (checkAMap) clearInterval(checkAMap)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, []) // 只执行一次

  const handleCityChange = useCallback((city: City) => {
    setCurrentCity(city)
    setPoints([])
    setMidPoint(null)
    setTravelTimes([])
    setPois([])
    setSelectedPOI(null)
    setActiveSearchType(null)
    setPoiDetail(null)
    message.success(`已切换到：${city.name}`)
  }, [])

  // 计算中点（统一函数）
  const computeMidPoint = useCallback(async (pointsList: LocationPoint[], mode: MidPointMode) => {
    if (pointsList.length < 2) {
      setMidPoint(null)
      setTravelTimes([])
      setTravelRoutes([])
      return
    }

    // 直线模式直接计算，不需要异步
    if (mode === 'straight') {
      const mid = calculateMidPoint(pointsList)
      setMidPoint(mid)
      setTravelTimes([])
      setTravelRoutes([])
      return
    }

    // 驾车/公交模式需要异步计算
    setIsCalculatingMidPoint(true)
    try {
      const result = await calculateWeightedMidPoint(pointsList, mode, currentCity?.name)
      if (result) {
        setMidPoint(result.midPoint)
        setTravelTimes(result.travelTimes)
        setTravelRoutes(result.routes)

        // 检查路线绘制情况并提示
        const totalRoutes = result.routes.length
        const validRoutes = result.routes.filter(r => r && r.path && r.path.length >= 2).length
        const failedTimes = result.travelTimes.filter(t => t >= 999).length

        if (result.usedStraightFallback) {
          message.warning('路线规划服务不可用，已回退为直线时间估算（不绘制路线）')
        } else if (totalRoutes > 0 && validRoutes === 0) {
          message.warning('所有路线规划失败，请检查地点是否合理')
        } else if (failedTimes > 0) {
          message.warning(`${failedTimes}条路线规划失败，部分路线无法显示`)
        }
      }
    } catch (error) {
      console.error('计算中点失败:', error)
      message.error('路线计算失败，已切换回直线模式')
      // 失败时回退到几何中点
      const mid = calculateMidPoint(pointsList)
      setMidPoint(mid)
      setTravelTimes([])
      setTravelRoutes([])
    } finally {
      setIsCalculatingMidPoint(false)
    }
  }, [currentCity?.name])

  const handleAddPoint = useCallback((point: LocationPoint) => {
    setPoints((prev) => {
      const newPoints = [...prev, point]
      // 新增点后切换到直线模式
      setMidPointMode('straight')
      // 异步计算中点（使用直线模式）
      computeMidPoint(newPoints, 'straight')
      return newPoints
    })
    message.success({
      content: `已添加: ${point.name}`,
      duration: 1.5,
    })
  }, [computeMidPoint])

  const handleRemovePoint = useCallback((id: string) => {
    // 先获取要删除的点的名称（在 state 更新前）
    const removedPoint = points.find((p) => p.id === id)

    setPoints((prev) => {
      const newPoints = prev.filter((p) => p.id !== id)
      // 异步计算中点
      computeMidPoint(newPoints, midPointMode)
      if (newPoints.length < 2) {
        setPois([])
      }
      return newPoints
    })

    // 在 setPoints 外部显示提示，避免 StrictMode 下重复执行
    if (removedPoint) {
      message.info({
        content: `已移除: ${removedPoint.name}`,
        duration: 1.5,
      })
    }
  }, [points, computeMidPoint, midPointMode])

  const handleClearAll = useCallback(() => {
    setPoints([])
    setMidPoint(null)
    setTravelTimes([])
    setTravelRoutes([])
    setPois([])
    setSelectedPOI(null)
    setActiveSearchType(null)
    setPoiDetail(null)
    message.info({
      content: '已清空所有地点',
      duration: 1.5,
    })
  }, [])

  // 处理地点拖拽排序
  const handleReorderPoints = useCallback((newPoints: LocationPoint[]) => {
    setPoints(newPoints)
    // 中点不变，不需要重新计算
  }, [])

  // 处理中点计算模式切换
  const handleMidPointModeChange = useCallback((mode: MidPointMode) => {
    setMidPointMode(mode)
    // 切换模式时重新计算中点
    if (points.length >= 2) {
      computeMidPoint(points, mode)
    }
  }, [points, computeMidPoint])

  // 收藏地点
  const handleAddFavorite = useCallback((point: LocationPoint) => {
    const success = addFavorite(point)
    if (success) {
      message.success({
        content: `已收藏: ${point.name}`,
        duration: 1.5,
      })
    } else {
      message.info({
        content: '该地点已在收藏中',
        duration: 1.5,
      })
    }
  }, [addFavorite])

  // 取消收藏
  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id)
    message.info({
      content: '已取消收藏',
      duration: 1.5,
    })
  }, [removeFavorite])

  // 从收藏添加地点
  const handleAddFromFavorite = useCallback((point: LocationPoint) => {
    // 检查是否已经添加
    const exists = points.some((p) => p.lng === point.lng && p.lat === point.lat)
    if (exists) {
      message.info({
        content: '该地点已添加',
        duration: 1.5,
      })
      return
    }
    // 创建新的 point（使用新 ID）
    const newPoint: LocationPoint = {
      ...point,
      id: Date.now().toString(),
    }
    handleAddPoint(newPoint)
  }, [points, handleAddPoint])

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

    const searchKeyword = keyword || type
    setIsSearching(true)
    setActiveSearchType(type)
    setLastSearchKeyword(searchKeyword) // 保存搜索关键词
    try {
      const results = await searchPOI(searchKeyword, midPoint.lng, midPoint.lat, radius)
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

  // 防抖的 POI 搜索函数
  const debouncedPOISearch = useMemo(
    () => debounce(async (keyword: string, lng: number, lat: number, radius: SearchRadius) => {
      setIsSearching(true)
      try {
        const results = await searchPOI(keyword, lng, lat, radius)
        setPois(results)
        if (results.length > 0) {
          setSelectedPOI(null)
          setPoiDetail(null)
        } else {
          message.info('未找到相关场所')
        }
      } catch (error) {
        console.error('Search failed:', error)
        message.error('搜索失败，请重试')
      } finally {
        setIsSearching(false)
      }
    }, 200),
    []
  )

  // 处理搜索范围变化，自动重新搜索
  const handleSearchRadiusChange = useCallback((radius: SearchRadius) => {
    setSearchRadius(radius)
    // 如果有活跃搜索，使用新范围重新搜索
    if (activeSearchType && midPoint && lastSearchKeyword) {
      debouncedPOISearch(lastSearchKeyword, midPoint.lng, midPoint.lat, radius)
    }
  }, [activeSearchType, midPoint, lastSearchKeyword, debouncedPOISearch])

  // 中点变化时自动重新搜索
  useEffect(() => {
    if (!midPoint || !activeSearchType || !lastSearchKeyword) return

    debouncedPOISearch(lastSearchKeyword, midPoint.lng, midPoint.lat, searchRadius)
  }, [midPoint?.lng, midPoint?.lat]) // 只在中点坐标变化时触发

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
        onRangingEnd={handleRangingEnd}
        travelRoutes={travelRoutes}
        midPointMode={midPointMode}
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
              onReorderPoints={handleReorderPoints}
              onSearch={handleSearch}
              onLocatePoint={setFocusPoint}
              isSearching={isSearching}
              searchRadius={searchRadius}
              onSearchRadiusChange={handleSearchRadiusChange}
              currentCity={currentCity}
              favorites={favorites}
              onAddFavorite={handleAddFavorite}
              onRemoveFavorite={handleRemoveFavorite}
              onAddFromFavorite={handleAddFromFavorite}
              isFavorite={isFavorite}
              midPoint={midPoint}
              midPointMode={midPointMode}
              onMidPointModeChange={handleMidPointModeChange}
              travelTimes={travelTimes}
              isCalculatingMidPoint={isCalculatingMidPoint}
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
        <button
          className="toolbar-btn"
          onClick={(e) => { e.stopPropagation(); setShowWelcomeModal(true) }}
          title="使用说明"
        >
          💡
        </button>
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
                  loading={isSearching}
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

      {/* 使用说明弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🗺️ 大家去哪玩</span>
            <Tag color="blue">v{APP_VERSION}</Tag>
          </div>
        }
        open={showWelcomeModal}
        onCancel={handleCloseWelcome}
        width={isMobile ? '90vw' : 500}
        centered={isMobile}
        styles={isMobile ? { body: { maxHeight: '55vh', overflowY: 'auto' } } : undefined}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            >
              不再自动显示
            </Checkbox>
            <Button type="primary" onClick={handleCloseWelcome}>
              知道了
            </Button>
          </div>
        }
      >
        <div className="welcome-modal-content">
          <div className="welcome-section">
            <h4>📍 这是什么？</h4>
            <p>一个帮助多人聚会找到最佳见面地点的工具。输入每个人的位置，自动计算中心点，并搜索附近的餐厅、咖啡厅等场所。</p>
          </div>

          <div className="welcome-section">
            <h4>✨ 主要功能</h4>
            <ul>
              <li><strong>添加地点</strong> - 搜索或点击地图添加多个位置</li>
              <li><strong>智能中点</strong> - 支持直线距离、驾车时间、公交时间三种计算模式</li>
              <li><strong>附近搜索</strong> - 在中点附近搜索餐厅、咖啡厅、商场等</li>
              <li><strong>一键导航</strong> - 支持驾车、步行、公交导航</li>
              <li><strong>收藏地点</strong> - 收藏常用地点，下次快速添加</li>
              <li><strong>拖拽排序</strong> - 拖动地点调整顺序</li>
              <li><strong>卫星地图</strong> - 切换卫星视图</li>
              <li><strong>测距工具</strong> - 测量地图上任意两点距离</li>
            </ul>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <div className="welcome-section">
            <h4>📢 版本更新 v{APP_VERSION}</h4>
            <ul className="changelog-list">
              <li>新增中点计算模式：支持直线距离、驾车时间、公交时间</li>
              <li>驾车/公交模式会根据通勤时间智能优化中点位置</li>
              <li>地点列表显示每个人到中点的预估通勤时间</li>
              <li>新增搜索防抖，优化请求性能</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default App
