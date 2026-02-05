import { useEffect, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Dropdown, Empty, Input, Modal, Select, Space, Tag, Typography, message } from 'antd'
import type { MenuProps } from 'antd'
import { DeleteOutlined, FolderOpenOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { debounce } from 'lodash'
import MapView from '@/components/MapView'
import { calculateDistance } from '@/utils/mapCalc'
import { getCurrentCity, getCurrentLocation, searchByKeyword } from '@/utils/amap'
import CitySelector from '@/components/CitySelector'
import { City, LocationPoint } from '@/types'
import { useFavorites } from '@/hooks/useFavorites'
import { useTripFolders } from '@/hooks/useTripFolders'
import { useTripPoints } from '@/hooks/useTripPoints'

type TripRouteItem = {
  point: LocationPoint
  distanceFromPrev?: number
}

type RouteMode = 'tsp' | 'nearby'

const HIGHLIGHT_TOP = 4

function formatDistance(distance?: number) {
  if (distance === undefined || Number.isNaN(distance)) return '--'
  if (distance < 1000) return `${Math.round(distance)} m`
  return `${(distance / 1000).toFixed(2)} km`
}

function getDistance(a: LocationPoint, b: LocationPoint): number {
  return calculateDistance(a.lng, a.lat, b.lng, b.lat)
}

function buildNearestNeighborRoute(points: LocationPoint[], start: LocationPoint): LocationPoint[] {
  const remaining = [...points]
  const ordered: LocationPoint[] = []
  let current = start

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY

    remaining.forEach((candidate, index) => {
      const distance = getDistance(current, candidate)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })

    const next = remaining.splice(bestIndex, 1)[0]
    ordered.push(next)
    current = next
  }

  return ordered
}

function optimizeRoute2Opt(points: LocationPoint[], start: LocationPoint): LocationPoint[] {
  if (points.length < 3) return points
  let route = [...points]
  let improved = true
  let iterations = 0
  const maxIterations = 6

  while (improved && iterations < maxIterations) {
    improved = false
    iterations += 1

    for (let i = 0; i < route.length - 1; i += 1) {
      for (let k = i + 1; k < route.length; k += 1) {
        const a = i === 0 ? start : route[i - 1]
        const b = route[i]
        const c = route[k]
        const d = k + 1 < route.length ? route[k + 1] : null

        const currentDist = getDistance(a, b) + (d ? getDistance(c, d) : 0)
        const swappedDist = getDistance(a, c) + (d ? getDistance(b, d) : 0)

        if (swappedDist + 0.01 < currentDist) {
          const reversed = route.slice(i, k + 1).reverse()
          route = [...route.slice(0, i), ...reversed, ...route.slice(k + 1)]
          improved = true
          break
        }
      }
      if (improved) break
    }
  }

  return route
}

function parseJsonPoints(raw: unknown): LocationPoint[] {
  const data = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as any).points)
      ? (raw as any).points
      : []

  if (!Array.isArray(data)) return []

  return data
    .map((item: any, index: number) => {
      const lng = Number(item?.lng)
      const lat = Number(item?.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      const name = typeof item?.name === 'string' && item.name.trim()
        ? item.name.trim()
        : `导入地点${index + 1}`
      const address = typeof item?.address === 'string' ? item.address : undefined
      return {
        id: `import_${Date.now()}_${index}`,
        name,
        address,
        lng,
        lat,
      }
    })
    .filter(Boolean) as LocationPoint[]
}

export default function TripPlanPage() {
  const { favorites } = useFavorites()
  const { folders, addFolder, removeFolder, addPointsToFolder, removePointFromFolder } = useTripFolders()
  const { tripPoints, addTripPoint, addTripPoints, removeTripPoint, clearTripPoints } = useTripPoints()
  const [myLocation, setMyLocation] = useState<LocationPoint | null>(null)
  const [myCity, setMyCity] = useState('')
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [isManualLocating, setIsManualLocating] = useState(false)
  const [focusPoint, setFocusPoint] = useState<LocationPoint | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [pendingAddress, setPendingAddress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isComputed, setIsComputed] = useState(false)
  const [routeMode, setRouteMode] = useState<RouteMode>('tsp')
  const [isLocateMenuOpen, setIsLocateMenuOpen] = useState(false)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const hasAutoCityRef = useRef(false)
  const isMobile = window.innerWidth <= 768
  const [panelStates, setPanelStates] = useState({
    trip: !isMobile,
  })
  const locateMenuLockRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const routePoints = useMemo<TripRouteItem[]>(() => {
    if (!myLocation || !isComputed) {
      return tripPoints.map((point) => ({ point }))
    }

    if (routeMode === 'nearby') {
      return [...tripPoints]
        .map((point) => ({
          point,
          distanceFromPrev: getDistance(myLocation, point),
        }))
        .sort((a, b) => (a.distanceFromPrev || 0) - (b.distanceFromPrev || 0))
    }

    const nearestRoute = buildNearestNeighborRoute(tripPoints, myLocation)
    const optimizedRoute = optimizeRoute2Opt(nearestRoute, myLocation)
    const result: TripRouteItem[] = []
    let current = myLocation

    optimizedRoute.forEach((point) => {
      const distance = getDistance(current, point)
      result.push({
        point,
        distanceFromPrev: distance,
      })
      current = point
    })

    return result
  }, [tripPoints, myLocation, isComputed, routeMode])

  const rankedPoints = useMemo(() => {
    if (!myLocation || !isComputed) return undefined
    const map: Record<string, number> = {}
    routePoints.forEach((item, index) => {
      map[item.point.id] = index + 1
    })
    return map
  }, [routePoints, myLocation, isComputed])

  const mapPoints = useMemo(() => {
    const base = routePoints.map((item) => item.point)
    return myLocation ? [...base, myLocation] : base
  }, [routePoints, myLocation])

  useEffect(() => {
    if (!isComputed) return
    setIsComputed(false)
  }, [tripPoints, myLocation, routeMode])

  const handleLocateMe = async () => {
    setIsLocating(true)
    try {
      const result = await getCurrentLocation()
      if (!result) {
        message.error('定位失败，请稍后重试')
        return
      }
      const locationPoint: LocationPoint = {
        id: `my_${Date.now()}`,
        name: '我的位置',
        lng: result.lng,
        lat: result.lat,
        address: result.address,
        isMyLocation: true,
      }
      setMyLocation(locationPoint)
      setMyCity(result.city || '')
      setFocusPoint(locationPoint)
      message.success('定位成功')
    } finally {
      setIsLocating(false)
    }
  }

  useEffect(() => {
    if (hasAutoCityRef.current) return
    hasAutoCityRef.current = true
    const locateCity = async () => {
      const city = await getCurrentCity()
      if (city) {
        setCurrentCity(city)
        setMyCity(city.name || '')
      }
    }
    locateCity()
  }, [])

  const handleMapClick = (lng: number, lat: number) => {
    if (isManualLocating) {
      const manualPoint: LocationPoint = {
        id: `my_manual_${Date.now()}`,
        name: '我的位置',
        lng,
        lat,
        isMyLocation: true,
      }
      setMyLocation(manualPoint)
      setFocusPoint(manualPoint)
      setIsManualLocating(false)
      message.success('已手动设置我的位置')
      return
    }
    setPendingCoords({ lng, lat })
    setPendingName(`想去地点${tripPoints.length + 1}`)
    setPendingAddress('')
    setIsAddModalOpen(true)
  }

  const handleConfirmAdd = () => {
    if (!pendingCoords) return
    if (!pendingName.trim()) {
      message.warning('请填写地点名称')
      return
    }
    const added = addTripPoint({
      id: `trip_${Date.now()}`,
      name: pendingName.trim(),
      address: pendingAddress.trim() || undefined,
      lng: pendingCoords.lng,
      lat: pendingCoords.lat,
    })
    if (!added) {
      message.info('该地点已存在')
      return
    }
    setIsAddModalOpen(false)
    message.success('已添加到行程')
  }

  const handleImportFavorites = () => {
    if (favorites.length === 0) {
      message.info('收藏夹暂无地点')
      return
    }
    const points = favorites.map((fav) => ({
      id: fav.id,
      name: fav.name,
      address: fav.address,
      lng: fav.lng,
      lat: fav.lat,
    }))
    const added = addTripPoints(points)
    if (added === 0) {
      message.info('没有新地点可以导入')
      return
    }
    message.success(`已导入 ${added} 个收藏点`)
  }

  const handleImportJsonClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportJsonFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || ''))
        const points = parseJsonPoints(raw)
        if (points.length === 0) {
          message.error('JSON 中没有可用的点位')
          return
        }
        const added = addTripPoints(points)
        if (added === 0) {
          message.info('没有新地点可以导入')
          return
        }
        message.success(`已导入 ${added} 个地点`)
      } catch (error) {
        message.error('JSON 解析失败，请检查格式')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const debouncedSearch = useMemo(
    () => debounce(async (value: string) => {
      if (!value.trim()) return
      const city = currentCity?.name || myCity || undefined
      const results = await searchByKeyword(value, city)
      setSearchResults(results)
    }, 200),
    [currentCity?.name, myCity]
  )

  const handleSearch = (value: string) => {
    debouncedSearch(value)
  }

  const handleSelectSearch = (_value: string, option: any) => {
    const result = option.data
    const location = result?.location
    if (!location?.lng || !location?.lat) return
    const added = addTripPoint({
      id: Date.now().toString(),
      name: result.name,
      address: result.address,
      lng: location.lng,
      lat: location.lat,
    })
    if (!added) {
      message.info('该地点已在行程中')
      return
    }
    setSearchKeyword('')
    setSearchResults([])
    message.success('已添加到行程')
  }

  const handleComputeRoute = () => {
    if (!myLocation) {
      message.info('请先定位我的位置')
      return
    }
    if (tripPoints.length === 0) {
      message.info('请先添加想去的地点')
      return
    }
    setIsComputed(true)
  }

  const closeLocateMenu = () => {
    setIsLocateMenuOpen(false)
    if (locateMenuLockRef.current) {
      clearTimeout(locateMenuLockRef.current)
    }
    locateMenuLockRef.current = setTimeout(() => {
      locateMenuLockRef.current = null
    }, 350)
  }

  const handleLocateMenuClick: MenuProps['onClick'] = (info) => {
    info.domEvent?.stopPropagation?.()
    info.domEvent?.preventDefault?.()
    closeLocateMenu()
    if (info.key === 'auto') {
      handleLocateMe()
      return
    }
    if (info.key === 'manual') {
      setIsManualLocating(true)
      message.info('请在地图上点击设置我的位置')
    }
  }

  const handleLocateMenuOpenChange = (open: boolean, info: { source: 'trigger' | 'menu' }) => {
    if (locateMenuLockRef.current) {
      setIsLocateMenuOpen(false)
      return
    }
    if (info.source === 'menu') {
      closeLocateMenu()
      return
    }
    setIsLocateMenuOpen(open)
  }

  const togglePanel = (key: keyof typeof panelStates) => {
    setPanelStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleActionMenuClick = ({ key }: { key: string }) => {
    if (key === 'favorites') {
      handleImportFavorites()
      return
    }
    if (key === 'json') {
      handleImportJsonClick()
      return
    }
    if (key === 'folders') {
      setIsFolderModalOpen(true)
      return
    }
    if (key === 'clear') {
      clearTripPoints()
    }
  }

  const handleCreateFolder = () => {
    const name = newFolderName.trim()
    if (!name) {
      message.info('请输入收藏夹名称')
      return
    }
    const created = addFolder(name)
    if (!created) {
      message.info('收藏夹名称重复或无效')
      return
    }
    setNewFolderName('')
    message.success('已创建收藏夹')
  }

  const handleAddTripToFolder = (folderId: string) => {
    if (tripPoints.length === 0) {
      message.info('当前行程暂无地点')
      return
    }
    const added = addPointsToFolder(folderId, tripPoints)
    if (added === 0) {
      message.info('没有新地点可加入')
      return
    }
    message.success(`已加入 ${added} 个地点`)
  }

  const handleImportFolderToTrip = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId)
    if (!folder) return
    if (folder.points.length === 0) {
      message.info('收藏夹暂无地点')
      return
    }
    const added = addTripPoints(folder.points)
    if (added === 0) {
      message.info('没有新地点可导入')
      return
    }
    message.success(`已导入 ${added} 个地点`)
  }

  return (
    <div className="app-container trip-container">
      <div className="top-bar">
        <CitySelector
          currentCity={currentCity}
          onCityChange={(city) => {
            setCurrentCity(city)
            setMyCity(city.name || '')
          }}
        />
      </div>
      <MapView
        points={mapPoints}
        midPoint={null}
        onMapClick={handleMapClick}
        selectedPOI={null}
        focusPoint={focusPoint}
        currentCity={currentCity}
        rankedPoints={rankedPoints}
        highlightTop={myLocation && isComputed ? HIGHLIGHT_TOP : 0}
        autoFit={false}
      />

      <div className="floating-panels-left">
        <div className={`floating-panel trip-panel-wrapper ${panelStates.trip ? 'expanded' : 'collapsed'}`}>
          <div className="panel-header" onClick={() => togglePanel('trip')}>
            <span className="panel-title">
              <span className="title-icon">🧭</span>
              <span className="title-text" style={{color: 'rgb(158, 158, 158)'}}>行程清单</span>
              <span className="count-badge">{tripPoints.length}</span>
            </span>
            <span className="toggle-icon">{panelStates.trip ? '▼' : '▲'}</span>
          </div>
          {panelStates.trip && (
            <div className="trip-panel-content">
            <div className="trip-actions">
              <Space size={8}>
                <Select<RouteMode>
                  size="small"
                  value={routeMode}
                  onChange={(value) => setRouteMode(value)}
                  options={[
                    { value: 'tsp', label: '路线优化' },
                    { value: 'nearby', label: '离我最近' },
                  ]}
                />
                <Button type="primary" size="small" onClick={handleComputeRoute}>
                  {isComputed ? '重新计算' : '开始计算'}
                </Button>
                <Dropdown
                  placement="bottomLeft"
                  menu={{
                    items: [
                      { key: 'favorites', label: '导入全局收藏' },
                      { key: 'json', label: '导入 JSON' },
                      { key: 'folders', label: '规划收藏夹' },
                      { key: 'clear', label: '清空行程', danger: true },
                    ],
                    onClick: handleActionMenuClick,
                  }}
                >
                  <Button size="small">更多操作</Button>
                </Dropdown>
              </Space>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleImportJsonFile}
              />
            </div>
            <div className="trip-hint">
              支持点击地图添加地点。JSON 示例：[{`{"name":"景点","lng":120.12,"lat":30.28}`}]
            </div>
            <div className="trip-search">
              <AutoComplete
                value={searchKeyword}
                options={searchResults.map((item: any) => ({
                  value: item.name,
                  label: (
                    <div>
                      <div>{item.name}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.address}
                      </Typography.Text>
                    </div>
                  ),
                  data: item,
                }))}
                onSearch={handleSearch}
                onSelect={handleSelectSearch}
                onChange={setSearchKeyword}
                placeholder="搜索地点名称..."
                className="search-input"
                notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结果" />}
              >
                <Input
                  prefix={<SearchOutlined />}
                  suffix={(
                    <Button
                      type="primary"
                      size="small"
                      icon={<SearchOutlined />}
                      onClick={() => handleSearch(searchKeyword)}
                    >
                      搜索
                    </Button>
                  )}
                  onPressEnter={() => handleSearch(searchKeyword)}
                />
              </AutoComplete>
            </div>
            {routePoints.length === 0 ? (
              <div className="trip-empty">暂无行程点，点击地图或导入数据</div>
            ) : (
              <div className="trip-list">
                {routePoints.map((item, index) => {
                  const rank = myLocation && isComputed ? index + 1 : undefined
                  const isHighlight = myLocation && isComputed ? rank !== undefined && rank <= HIGHLIGHT_TOP : false
                  const distanceLabel = myLocation && isComputed
                    ? (routeMode === 'nearby' ? '距我' : (index === 0 ? '距我' : '距上一站'))
                    : '未计算'
                  return (
                    <div
                      key={item.point.id}
                      className={`trip-item ${isHighlight ? 'is-highlight' : ''}`}
                      onClick={() => setFocusPoint(item.point)}
                    >
                      <div className="trip-item-main">
                        <div className={`trip-rank-badge ${isHighlight ? 'is-highlight' : ''}`}>
                          {rank ?? '—'}
                        </div>
                        <div className="trip-item-info">
                          <div className="trip-item-name">{item.point.name}</div>
                          <div className="trip-item-sub">
                            {item.point.address || `${item.point.lng.toFixed(4)}, ${item.point.lat.toFixed(4)}`}
                          </div>
                        </div>
                      </div>
                      <div className="trip-item-meta">
                        <div className="trip-distance-label">{distanceLabel}</div>
                        <div className={`trip-distance ${isHighlight ? 'is-highlight' : ''}`}>
                          {formatDistance(item.distanceFromPrev)}
                        </div>
                        <Button
                          type="text"
                          size="small"
                          danger
                          className="trip-remove-btn"
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            removeTripPoint(item.point.id)
                          }}
                        >
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          )}
        </div>
      </div>

      <div className="map-toolbar">
        <Dropdown
          placement="bottomRight"
          trigger={['click']}
          open={isLocateMenuOpen}
          onOpenChange={handleLocateMenuOpenChange}
          menu={{
            items: [
              { key: 'auto', label: '自动定位' },
              { key: 'manual', label: '手动定位（地图点击）' },
            ],
            onClick: handleLocateMenuClick,
          }}
        >
          <Button
            className={`toolbar-btn ${isLocating || isManualLocating ? 'active' : ''}`}
            disabled={isLocating}
            loading={isLocating}
          >
            {isManualLocating ? '点击地图定位' : '定位方式'}
          </Button>
        </Dropdown>
      </div>

      <Modal
        title={(
          <Space>
            <FolderOpenOutlined />
            <span>规划收藏夹</span>
          </Space>
        )}
        open={isFolderModalOpen}
        onCancel={() => setIsFolderModalOpen(false)}
        footer={null}
        width={520}
      >
        <div className="trip-folder-modal">
          <div className="trip-folder-create">
            <Input
              placeholder="输入收藏夹名称"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateFolder}>
              新建
            </Button>
          </div>
          {folders.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收藏夹" />
          ) : (
            <div className="trip-folder-list">
              {folders.map((folder) => (
                <div key={folder.id} className="trip-folder-card">
                  <div className="trip-folder-header">
                    <div className="trip-folder-title">
                      <FolderOpenOutlined />
                      <span>{folder.name}</span>
                      <Tag color="blue">{folder.points.length}</Tag>
                    </div>
                    <Space size={6}>
                      <Button size="small" onClick={() => handleImportFolderToTrip(folder.id)}>
                        使用收藏行程
                      </Button>
                      <Button size="small" onClick={() => handleAddTripToFolder(folder.id)}>
                        添加行程
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeFolder(folder.id)}
                      />
                    </Space>
                  </div>
                  {folder.points.length === 0 ? (
                    <div className="trip-folder-empty">暂无地点</div>
                  ) : (
                    <div className="trip-folder-points">
                      {folder.points.map((point) => (
                        <div key={point.id} className="trip-folder-point">
                          <div className="trip-folder-point-info">
                            <div className="trip-folder-point-name">{point.name}</div>
                            <div className="trip-folder-point-sub">
                              {point.address || `${point.lng.toFixed(4)}, ${point.lat.toFixed(4)}`}
                            </div>
                          </div>
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removePointFromFolder(folder.id, point.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title="添加到行程"
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        onOk={handleConfirmAdd}
        okText="添加"
        cancelText="取消"
      >
        <div className="trip-modal-content">
          <label className="trip-modal-label">地点名称</label>
          <Input
            placeholder="例如：西湖断桥"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
          />
          <label className="trip-modal-label">备注/地址（可选）</label>
          <Input
            placeholder="可填写备注或地址"
            value={pendingAddress}
            onChange={(e) => setPendingAddress(e.target.value)}
          />
          {pendingCoords && (
            <div className="trip-modal-coords">
              坐标：{pendingCoords.lng.toFixed(5)}, {pendingCoords.lat.toFixed(5)}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
