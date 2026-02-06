import { useState } from 'react'
import { List, Typography, Skeleton, Empty } from 'antd'
import { POI, NavMode } from '@/types'
import { generateAmapNavUrls } from '@/utils/mapCalc'
import Icon from './Icon'

const { Text } = Typography

interface POIListProps {
  pois: POI[]
  selectedPOI: POI | null
  onSelectPOI: (poi: POI) => void
  loading?: boolean
}

const navModeConfig = [
  { mode: 'drive' as NavMode, icon: <Icon type="icon-kaiche" />, label: '驾车' },
  { mode: 'walk' as NavMode, icon: <Icon type="icon-buxing" />, label: '步行' },
  { mode: 'bus' as NavMode, icon: <Icon type="icon-gongjiaoche" />, label: '公交' },
]

const getPOIIcon = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('餐厅') || n.includes('饭') || n.includes('菜') || n.includes('食')) return '🍽️'
  if (n.includes('咖啡') || n.includes('cafe')) return '☕'
  if (n.includes('商场') || n.includes('购物') || n.includes('广场')) return '🏬'
  if (n.includes('酒吧') || n.includes('酒')) return '🍷'
  if (n.includes('电影') || n.includes('影院')) return '🎬'
  if (n.includes('ktv')) return '🎤'
  if (n.includes('公园')) return '🌳'
  if (n.includes('医院')) return '🏥'
  if (n.includes('地铁站')) return '🚇'
  if (n.includes('公交站')) return '🚌'
  if (n.includes('火车站')) return '🚄'
  return '📍'
}

const formatDistance = (distance?: number) => {
  if (!distance) return ''
  if (distance < 1000) return `${distance}m`
  return `${(distance / 1000).toFixed(1)}km`
}

// POI 列表骨架屏组件
function POIListSkeleton() {
  return (
    <div className="poi-list-skeleton">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="poi-skeleton-item">
          <Skeleton.Avatar active size={40} shape="circle" />
          <div className="poi-skeleton-content">
            <Skeleton.Input active size="small" style={{ width: 120, marginBottom: 8 }} />
            <Skeleton.Input active size="small" style={{ width: 180 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function POIList({ pois, selectedPOI, onSelectPOI, loading = false }: POIListProps) {
  const [navMode, setNavMode] = useState<NavMode>('drive')

  const isMobileBrowser = () => /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)

  const handleNavigate = (poi: POI) => {
    const { appUrl, webUrl } = generateAmapNavUrls(poi.lng, poi.lat, poi.name, navMode)

    if (!isMobileBrowser()) {
      window.open(webUrl, '_blank')
      return
    }

    let hasLeftPage = false
    const markLeftPage = () => {
      hasLeftPage = true
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        hasLeftPage = true
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', markLeftPage)
    window.addEventListener('blur', markLeftPage)

    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', markLeftPage)
      window.removeEventListener('blur', markLeftPage)

      if (!hasLeftPage) {
        window.location.href = webUrl
      }
    }, 1200)

    window.location.href = appUrl
  }

  // 加载状态：显示骨架屏
  if (loading) {
    return (
      <div className="poi-list-content-wrapper">
        <div className="nav-mode-section">
          <div className="nav-mode-buttons">
            {navModeConfig.map(({ mode, icon, label }) => (
              <button
                key={mode}
                title={label}
                className={`nav-mode-btn ${navMode === mode ? 'active' : ''}`}
                disabled
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <POIListSkeleton />
      </div>
    )
  }

  // 空状态：无搜索结果
  if (pois.length === 0) {
    return (
      <div className="poi-list-content-wrapper">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#999' }}>
              暂无搜索结果<br />
              <Text type="secondary" style={{ fontSize: 12 }}>试试扩大搜索范围或更换关键词</Text>
            </span>
          }
          style={{ padding: '40px 0' }}
        />
      </div>
    )
  }

  return (
    <div className="poi-list-content-wrapper">
      {/* 导航模式选择 */}
      <div className="nav-mode-section">
        <div className="nav-mode-buttons">
          {navModeConfig.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setNavMode(mode)}
              title={label}
              className={`nav-mode-btn ${navMode === mode ? 'active' : ''}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* POI列表 */}
      <List
        className="poi-items-list"
        dataSource={pois}
        renderItem={(poi) => (
          <div
            className={`poi-item ${selectedPOI?.id === poi.id ? 'active' : ''}`}
            onClick={() => onSelectPOI(poi)}
          >
            <div className="poi-item-content">
              <div className="poi-item-icon">
                {getPOIIcon(poi.name)}
              </div>
              <div className="poi-item-info">
                <div className="poi-item-name">{poi.name}</div>
                <div className="poi-item-address">{poi.address}</div>
                {poi.distance && (
                  <div className="poi-item-distance">
                    距中点 {formatDistance(poi.distance)}
                  </div>
                )}
              </div>
              <button
                className="nav-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNavigate(poi)
                }}
              >
                导航
              </button>
            </div>
          </div>
        )}
      />
    </div>
  )
}
