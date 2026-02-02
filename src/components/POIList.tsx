import { useState } from 'react'
import { List, Typography } from 'antd'
import { CarOutlined, WifiOutlined, BulbOutlined } from '@ant-design/icons'
import { POI, NavMode } from '@/types'
import { generateAmapNavUrl } from '@/utils/mapCalc'

const { Text } = Typography

interface POIListProps {
  pois: POI[]
  selectedPOI: POI | null
  onSelectPOI: (poi: POI) => void
}

const navModeConfig = [
  { mode: 'drive' as NavMode, icon: <CarOutlined />, label: '驾车' },
  { mode: 'walk' as NavMode, icon: <WifiOutlined />, label: '步行' },
  { mode: 'bus' as NavMode, icon: <BulbOutlined />, label: '公交' },
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
  if (n.includes('火车高铁')) return '🚄'
  return '📍'
}

const formatDistance = (distance?: number) => {
  if (!distance) return ''
  if (distance < 1000) return `${distance}m`
  return `${(distance / 1000).toFixed(1)}km`
}

export default function POIList({ pois, selectedPOI, onSelectPOI }: POIListProps) {
  const [navMode, setNavMode] = useState<NavMode>('drive')

  const handleNavigate = (poi: POI) => {
    const url = generateAmapNavUrl(poi.lng, poi.lat, poi.name, navMode)
    window.open(url, '_blank')
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
