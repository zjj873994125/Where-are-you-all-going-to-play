import { useState, useEffect, useRef } from 'react'
import {
  Popover,
  Input,
  Tag,
  Empty,
  Spin,
  Divider,
  Typography
} from 'antd'
import {
  EnvironmentOutlined,
  SearchOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import { City } from '@/types'
import { searchCity, getHotCities, getCurrentCity } from '@/utils/amap'

const { Text } = Typography

interface CitySelectorProps {
  currentCity: City | null
  onCityChange: (city: City) => void
}

export default function CitySelector({ currentCity, onCityChange }: CitySelectorProps) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<City[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const searchRequestIdRef = useRef(0)

  const hotCities = getHotCities()

  // 搜索城市
  useEffect(() => {
    const requestId = ++searchRequestIdRef.current
    const keyword = searchKeyword.trim()

    const timer = setTimeout(async () => {
      if (keyword) {
        setIsSearching(true)
        try {
          const results = await searchCity(keyword)
          if (searchRequestIdRef.current !== requestId) return
          setSearchResults(results)
        } finally {
          if (searchRequestIdRef.current === requestId) {
            setIsSearching(false)
          }
        }
      } else {
        if (searchRequestIdRef.current !== requestId) return
        setSearchResults([])
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchKeyword])

  // 获取当前位置
  const handleLocate = async () => {
    setIsLocating(true)
    try {
      const city = await getCurrentCity()
      if (city) {
        onCityChange(city)
        setIsOpen(false)
      }
    } catch (error) {
      console.error('定位失败:', error)
    } finally {
      setIsLocating(false)
    }
  }

  const handleCitySelect = (city: City) => {
    onCityChange(city)
    setIsOpen(false)
    setSearchKeyword('')
  }

  const content = (
    <div className="city-selector-content">
      {/* 定位按钮 */}
      <div className="locate-section">
        <button
          className="locate-btn"
          onClick={handleLocate}
          disabled={isLocating}
        >
          {isLocating ? <LoadingOutlined spin /> : <EnvironmentOutlined />}
          <span>{isLocating ? '定位中...' : '自动定位当前城市'}</span>
        </button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 搜索框 */}
      <div className="city-search">
        <Input
          placeholder="搜索城市..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          prefix={<SearchOutlined />}
          autoFocus
          allowClear
        />
      </div>

      {/* 搜索结果 */}
      {searchKeyword && (
        <div className="city-search-results">
          {isSearching ? (
            <div className="loading-container">
              <Spin size="small" />
              <Text type="secondary">搜索中...</Text>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="city-grid">
              {searchResults.map((city) => (
                <Tag
                  key={city.adcode}
                  className="city-tag"
                  onClick={() => handleCitySelect(city)}
                >
                  {city.name}
                </Tag>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="未找到相关城市"
              className="empty-small"
            />
          )}
        </div>
      )}

      {!searchKeyword && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          {/* 热门城市 */}
          <div className="hot-cities-section">
            <Text type="secondary" className="section-title">热门城市</Text>
            <div className="city-grid">
              {hotCities.map((city) => (
                <Tag
                  key={city.adcode}
                  className="city-tag"
                  onClick={() => handleCitySelect(city)}
                >
                  {city.name}
                </Tag>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottomLeft"
      overlayClassName="city-selector-popover"
    >
      <button className="city-selector-trigger">
        <EnvironmentOutlined />
        <span className="city-name">
          {currentCity?.name || '选择城市'}
        </span>
      </button>
    </Popover>
  )
}
