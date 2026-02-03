import { useState, useMemo } from 'react'
import {
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Radio,
  Divider,
  Empty,
  AutoComplete,
  Badge,
  Modal,
  Spin,
  Popover,
} from 'antd'
import {
  SearchOutlined,
  DeleteOutlined,
  HolderOutlined,
  StarOutlined,
  StarFilled,
  PlusOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { debounce } from 'lodash'
import Icon from './Icon'
import { LocationPoint, SearchType, SearchRadius, City, MidPointMode } from '@/types'
import { searchByKeyword } from '@/utils/amap'
import { FavoritePoint } from '@/hooks/useFavorites'

const { Text } = Typography

interface LocationPanelProps {
  points: LocationPoint[]
  onAddPoint: (point: LocationPoint) => void
  onRemovePoint: (id: string) => void
  onClearAll: () => void
  onReorderPoints: (points: LocationPoint[]) => void
  onSearch: (type: SearchType, keyword?: string, radius?: SearchRadius) => void
  onLocatePoint?: (point: LocationPoint) => void
  isSearching: boolean
  searchRadius?: SearchRadius
  onSearchRadiusChange?: (radius: SearchRadius)=> void
  currentCity?: City | null
  // 收藏相关
  favorites: FavoritePoint[]
  onAddFavorite: (point: LocationPoint) => void
  onRemoveFavorite: (id: string) => void
  onAddFromFavorite: (point: LocationPoint) => void
  isFavorite: (point: LocationPoint) => boolean
  // 中点计算模式相关
  midPointMode?: MidPointMode
  onMidPointModeChange?: (mode: MidPointMode) => void
  travelTimes?: number[]
  isCalculatingMidPoint?: boolean
}

// 注意：请根据你的阿里图标库中的实际图标类名替换下面的 icon-xxx
// 图标类名格式通常是 icon-xxx，你可以在阿里图标库的项目中查看具体的类名
const searchTypeConfig = [
  { type: '餐厅' as SearchType, icon: <Icon type="icon-canyin" />, color: 'rgb(240, 152, 56)', bgColor: '#FFF7E6' },        // 浅黄橙
  { type: '咖啡厅' as SearchType, icon: <Icon type="icon-kafeiting" />, color: 'rgb(240, 152, 56)', bgColor: '#FFF7EF' },      // 更浅的咖啡棕
  { type: '奶茶店' as SearchType, icon: <Icon type="icon-zhenzhunaicha" />, color: 'rgb(240, 152, 56)', bgColor: '#FFF9E6' }, // 奶茶浅米
  { type: '商场' as SearchType, icon: <Icon type="icon-shangchang1" />, color: 'rgb(195, 112, 231)', bgColor: '#F6EBFB' },    // 浅紫
  { type: '酒吧' as SearchType, icon: <Icon type="icon-jiubajiulang" />, color: 'rgb(231, 102, 152)', bgColor: '#FFF0F5' },   // 浅粉
  { type: '酒店' as SearchType, icon: <Icon type="icon-jiudian" />, color: 'rgb(159, 138, 229)', bgColor: '#F1F0FB' },        // 浅蓝紫
  { type: '医院' as SearchType, icon: <Icon type="icon-yiyuan" />, color: 'rgb(239, 123, 132)', bgColor: '#FFEFF3' },         // 浅玫红
  { type: '地铁站' as SearchType, icon: <Icon type="icon-ditiezhan" />, color: 'rgb(216, 71, 86)', bgColor: '#FFF0F0' },      // 地铁浅红
  { type: '公交站' as SearchType, icon: <Icon type="icon-gongjiaoche" />, color: 'rgb(102, 198, 76)', bgColor: '#F0FFF4' },   // 浅绿
  { type: '火车站' as SearchType, icon: <Icon type="icon-a-zu6661" />, color: 'rgb(88, 140, 247)', bgColor: '#F0F4FF' },      // 浅蓝
]

const radiusOptions = [
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '2km', value: 2000 },
  { label: '3km', value: 3000 },
]

// 中点计算模式选项
const midPointModeOptions = [
  { label: '直线', value: 'straight' },
  { label: '驾车', value: 'driving' },
  { label: '公交', value: 'transit' },
]

const getLocationLabel = (index: number) => {
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  return labels[index] || '?'
}

// 可拖拽的地点列表项组件
interface SortableLocationItemProps {
  point: LocationPoint
  index: number
  onRemove: (id: string) => void
  onLocate?: (point: LocationPoint) => void
  onFavorite?: (point: LocationPoint) => void
  isFavorited?: boolean
  travelTime?: number // 通勤时间（分钟）
  showTravelTime?: boolean
}

function SortableLocationItem({ point, index, onRemove, onLocate, onFavorite, isFavorited, travelTime, showTravelTime }: SortableLocationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: point.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`location-item ${isDragging ? 'location-item-dragging' : ''}`}
    >
      <div
        className="location-item-drag-handle"
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </div>
      <div
        className="location-item-content"
        onClick={() => onLocate?.(point)}
        style={{ cursor: 'pointer', flex: 1 }}
      >
        <div className="location-badge">
          {getLocationLabel(index)}
        </div>
        <div className="location-item-info">
          <div className="location-item-name">
            {point.name}
            {showTravelTime && travelTime !== undefined && travelTime < 999 && (
              <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
                {travelTime}分钟
              </Tag>
            )}
          </div>
          <div className="location-item-address">
            {point.address || `${point.lng.toFixed(4)}, ${point.lat.toFixed(4)}`}
          </div>
        </div>
      </div>
      <Button
        type="text"
        size="small"
        icon={isFavorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
        onClick={(e) => {
          e.stopPropagation()
          onFavorite?.(point)
        }}
        title={isFavorited ? '已收藏' : '收藏'}
      />
      <Button
        type="text"
        danger
        size="small"
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation()
          onRemove(point.id)
        }}
      />
    </div>
  )
}

export default function LocationPanel({
  points,
  onAddPoint,
  onRemovePoint,
  onClearAll,
  onReorderPoints,
  onSearch,
  onLocatePoint,
  isSearching,
  searchRadius = 1000,
  onSearchRadiusChange,
  currentCity,
  favorites,
  onAddFavorite,
  onRemoveFavorite,
  onAddFromFavorite,
  isFavorite,
  midPointMode = 'straight',
  onMidPointModeChange,
  travelTimes = [],
  isCalculatingMidPoint = false,
}: LocationPanelProps) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [customKeyword, setCustomKeyword] = useState('')
  const [activeSearchType, setActiveSearchType] = useState<SearchType | null>(null)
  const [showFavoritesModal, setShowFavoritesModal] = useState(false)

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖拽激活距离
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = points.findIndex((p) => p.id === active.id)
      const newIndex = points.findIndex((p) => p.id === over.id)
      const newPoints = arrayMove(points, oldIndex, newIndex)
      onReorderPoints(newPoints)
    }
  }

  const autoCompleteOptions = searchResults.map(item => ({
    value: item.name,
    label: (
      <div>
        <div>{item.name}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>{item.address}</Text>
      </div>
    ),
    data: item
  }))

  // 地点搜索防抖
  const debouncedSearch = useMemo(
    () => debounce(async (value: string) => {
      if (!value.trim()) return
      const results = await searchByKeyword(value, currentCity?.name)
      setSearchResults(results)
    }, 200),
    [currentCity?.name]
  )

  const handleSearch = (value: string) => {
    debouncedSearch(value)
  }

  const handleSelectSearch = (_value: string, option: any) => {
    const result = option.data
    onAddPoint({
      id: Date.now().toString(),
      name: result.name,
      address: result.address,
      lng: result.location.lng,
      lat: result.location.lat,
    })
    setSearchKeyword('')
    setSearchResults([])
  }

  const handlePOISearch = (type: SearchType) => {
    setActiveSearchType(type)
    onSearch(type, type, searchRadius)
  }

  const handleCustomSearch = () => {
    if (customKeyword.trim()) {
      setActiveSearchType('custom')
      onSearch('custom', customKeyword, searchRadius)
    }
  }

  const hasMidPoint = points.length >= 2

  return (
    <div className="location-panel-content">
      {/* 搜索输入 */}
      <div className="panel-section">
        <AutoComplete
          value={searchKeyword}
          options={autoCompleteOptions}
          onSearch={handleSearch}
          onSelect={handleSelectSearch}
          onChange={setSearchKeyword}
          placeholder="搜索地点名称..."
          className="search-input"
          notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结果" />}
        >
          <Input
            prefix={<SearchOutlined />}
            suffix={
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                onClick={() => handleSearch(searchKeyword)}
              >
                搜索
              </Button>
            }
            onPressEnter={() => handleSearch(searchKeyword)}
          />
        </AutoComplete>
        <div className="search-hint-row">
          <Text type="secondary" className="search-hint">
            或在地图上点击添加
          </Text>
          {favorites.length > 0 && (
            <a
              className="favorites-link"
              onClick={() => setShowFavoritesModal(true)}
            >
              <StarFilled style={{ color: '#faad14', marginRight: 4 }} />
              收藏夹 ({favorites.length})
            </a>
          )}
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 已添加地点 */}
      <div className="panel-section">
        <div className="section-header">
          <Space>
            <Text strong>已添加</Text>
            <Badge count={points.length} style={{ backgroundColor: '#667eea' }} />
            {isCalculatingMidPoint && (
              <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
            )}
          </Space>
          {points.length > 0 && (
            <Button
              type="text"
              size="small"
              onClick={onClearAll}
              style={{ color: '#ef4444' }}
            >
              清空
            </Button>
          )}
        </div>

        {points.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请添加至少2个地点"
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={points.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="locations-list">
                {points.map((point, index) => (
                  <SortableLocationItem
                    key={point.id}
                    point={point}
                    index={index}
                    onRemove={onRemovePoint}
                    onLocate={onLocatePoint}
                    onFavorite={onAddFavorite}
                    isFavorited={isFavorite(point)}
                    travelTime={travelTimes[index]}
                    showTravelTime={midPointMode !== 'straight' && travelTimes.length > 0}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 中点计算模式 */}
      {points.length >= 2 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div className="panel-section">
            <div className="section-header">
              <Space>
                <Icon type="icon-thunderbolt" style={{ color: '#667eea' }} />
                <Text strong>中点计算</Text>
              </Space>
            </div>
            <Radio.Group
              value={midPointMode}
              onChange={(e) => onMidPointModeChange?.(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              style={{ width: '100%' }}
              disabled={isCalculatingMidPoint}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                {midPointModeOptions.map(opt => (
                  <Radio.Button key={opt.value} value={opt.value} style={{ flex: 1 }}>
                    {opt.label}
                  </Radio.Button>
                ))}
              </div>
            </Radio.Group>
            {midPointMode !== 'straight' && (
              <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                {midPointMode === 'driving' ? '根据驾车时间' : '根据公交时间'}优化中点位置
              </Text>
            )}

            {/* 通勤时间汇总 - 使用 Popover 显示详情 */}
            {midPointMode !== 'straight' && travelTimes.length > 0 && !isCalculatingMidPoint && (
              (() => {
                const validTimes = travelTimes.filter(t => t !== undefined && t < 999)
                const allFailed = validTimes.length === 0

                // 详情内容
                const detailContent = (
                  <div className="travel-time-popover">
                    <div className="travel-time-list">
                      {points.map((point, index) => (
                        <div key={point.id} className="travel-time-item">
                          <span className="travel-time-label">{getLocationLabel(index)}</span>
                          <span className="travel-time-name">{point.name}</span>
                          <span className="travel-time-value">
                            {travelTimes[index] !== undefined && travelTimes[index] < 999
                              ? `${travelTimes[index]}分钟`
                              : '无法获取'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )

                if (allFailed) {
                  return (
                    <div className="travel-time-summary-compact error">
                      <InfoCircleOutlined style={{ marginRight: 6 }} />
                      路线规划失败，请检查网络
                    </div>
                  )
                }

                const avgTime = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
                const maxDiff = Math.max(...validTimes) - Math.min(...validTimes)

                return (
                  <Popover
                    content={detailContent}
                    title="通勤时间详情"
                    trigger="click"
                    placement="bottomLeft"
                  >
                    <div className="travel-time-summary-compact clickable">
                      <span className="summary-text">
                        平均 <strong>{avgTime}分钟</strong>
                        {' · '}
                        差异 <strong>{maxDiff}分钟</strong>
                      </span>
                      <InfoCircleOutlined className="summary-icon" />
                    </div>
                  </Popover>
                )
              })()
            )}
          </div>
        </>
      )}

      <Divider style={{ margin: '12px 0' }} />

      {/* 搜索范围选择 */}
      {hasMidPoint && (
        <>
          <div className="panel-section">
            <div className="section-header">
              <Space>
                <Icon type="icon-thunderbolt" style={{ color: '#667eea' }} />
                <Text strong>搜索范围</Text>
              </Space>
              <Tag color="red">{searchRadius < 1000 ? `${searchRadius}m` : `${searchRadius / 1000}km`}</Tag>
            </div>
            <Radio.Group
              value={searchRadius}
              onChange={(e) => onSearchRadiusChange?.(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                {radiusOptions.map(opt => (
                  <Radio.Button key={opt.value} value={opt.value} style={{ flex: 1 }}>
                    {opt.label}
                  </Radio.Button>
                ))}
              </div>
            </Radio.Group>
          </div>

          <Divider style={{ margin: '12px 0' }} />
        </>
      )}

      {/* 中点附近搜索 */}
      <div className="panel-section">
        <div className="section-header">
          <Space>
            <Icon type="icon-thunderbolt" style={{ color: '#667eea' }} />
            <Text strong>附近搜索</Text>
          </Space>
          {activeSearchType && (
            <Tag color="blue" style={{ margin: 0 }}>
              {activeSearchType === 'custom' ? customKeyword : activeSearchType}
            </Tag>
          )}
        </div>

        {!hasMidPoint ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="添加2个以上地点后可用"
          />
        ) : (
          <>
            {/* 快捷搜索按钮 */}
            <Space wrap className="quick-search-buttons">
              {searchTypeConfig.map(({ type, icon, color, bgColor }) => (
                <Button
                  key={type}
                  icon={icon}
                  loading={isSearching && activeSearchType === type}
                  onClick={() => handlePOISearch(type)}
                  className="quick-search-btn"
                  size="small"
                  style={{
                    borderColor: color,
                    color: activeSearchType === type ? 'white' : color,
                    background: activeSearchType === type ? color : bgColor
                  }}
                >
                  {type}
                </Button>
              ))}
            </Space>

            {/* 自定义搜索 */}
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="自定义关键词..."
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onPressEnter={handleCustomSearch}
                allowClear
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleCustomSearch}
                disabled={!customKeyword.trim()}
                loading={isSearching && activeSearchType === 'custom'}
              >
                搜索
              </Button>
            </Space.Compact>
          </>
        )}
      </div>

      {/* 收藏夹弹窗 */}
      <Modal
        title={
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            <span>收藏夹</span>
          </Space>
        }
        open={showFavoritesModal}
        onCancel={() => setShowFavoritesModal(false)}
        footer={null}
        width={400}
      >
        {favorites.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无收藏的地点"
          />
        ) : (
          <div className="favorites-modal-list">
            {favorites.map((fav) => (
              <div key={fav.id} className="favorite-item">
                <div className="favorite-item-content">
                  <div className="favorite-item-info">
                    <div className="favorite-item-name">{fav.name}</div>
                    <div className="favorite-item-address">
                      {fav.address || `${fav.lng.toFixed(4)}, ${fav.lat.toFixed(4)}`}
                    </div>
                  </div>
                </div>
                <Button
                  type="text"
                  title="添加"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    onAddFromFavorite(fav)
                    setShowFavoritesModal(false)
                  }}
                >
                  
                </Button>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => onRemoveFavorite(fav.id)}
                  title="取消收藏"
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
