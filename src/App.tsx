import { useState, useCallback, useEffect, useRef } from 'react'
import { message, Modal, Checkbox, Divider, Tag } from 'antd'
import MapView from './components/MapView'
import LocationPanel from './components/LocationPanel'
import POIList from './components/POIList'
import CitySelector from './components/CitySelector'
import POIDetailCard from './components/POIDetailCard'
import { LocationPoint, MidPoint, POI, POIDetail, SearchType, SearchRadius, City } from './types'
import { calculateMidPoint } from './utils/mapCalc'
import { searchPOI, getCurrentCity, getPOIDetail } from './utils/amap'
import { useFavorites } from './hooks/useFavorites'
import './App.css'

// 当前版本号
const APP_VERSION = '1.1.0'
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
  const [poiDetail, setPoiDetail] = useState<POIDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [focusPoint, setFocusPoint] = useState<LocationPoint | null>(null)
  const [isSatellite, setIsSatellite] = useState(false)
  const [isRanging, setIsRanging] = useState(false)

  // 使用说明弹窗
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

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
    message.success({
      content: `已添加: ${point.name}`,
      duration: 1.5,
    })
  }, [])

  const handleRemovePoint = useCallback((id: string) => {
    // 先获取要删除的点的名称（在 state 更新前）
    const removedPoint = points.find((p) => p.id === id)

    setPoints((prev) => {
      const newPoints = prev.filter((p) => p.id !== id)
      const mid = calculateMidPoint(newPoints)
      setMidPoint(mid)
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
  }, [points])

  const handleClearAll = useCallback(() => {
    setPoints([])
    setMidPoint(null)
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
        onRangingEnd={handleRangingEnd}
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
              onSearchRadiusChange={setSearchRadius}
              currentCity={currentCity}
              favorites={favorites}
              onAddFavorite={handleAddFavorite}
              onRemoveFavorite={handleRemoveFavorite}
              onAddFromFavorite={handleAddFromFavorite}
              isFavorite={isFavorite}
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
        onOk={handleCloseWelcome}
        okText="知道了"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={500}
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
              <li><strong>计算中点</strong> - 自动计算所有地点的几何中心</li>
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
              <li>新增收藏地点功能，支持收藏常用位置</li>
              <li>新增使用说明弹窗</li>
              <li>优化 POI 列表加载体验，添加骨架屏</li>
              <li>支持地点拖拽排序</li>
              <li>修复若干已知问题</li>
            </ul>
          </div>

          <div className="welcome-footer">
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            >
              不再自动显示
            </Checkbox>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default App
