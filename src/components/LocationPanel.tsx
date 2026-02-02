import { useState } from 'react'
import {
  Input,
  Button,
  List,
  Space,
  Typography,
  Tag,
  Radio,
  Divider,
  Empty,
  AutoComplete,
  Badge,
} from 'antd'
import {
  SearchOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import Icon from './Icon'
import { LocationPoint, SearchType, SearchRadius, City } from '@/types'
import { searchByKeyword } from '@/utils/amap'

const { Text } = Typography

interface LocationPanelProps {
  points: LocationPoint[]
  onAddPoint: (point: LocationPoint) => void
  onRemovePoint: (id: string) => void
  onClearAll: () => void
  onSearch: (type: SearchType, keyword?: string, radius?: SearchRadius) => void
  isSearching: boolean
  searchRadius?: SearchRadius
  onSearchRadiusChange?: (radius: SearchRadius)=> void
  currentCity?: City | null
}

// 注意：请根据你的阿里图标库中的实际图标类名替换下面的 icon-xxx
// 图标类名格式通常是 icon-xxx，你可以在阿里图标库的项目中查看具体的类名
const searchTypeConfig = [
  { type: '餐厅' as SearchType, icon: <Icon type="icon-canyin" />, color: '#ff6b6b', bgColor: '#fff0f0' },
  { type: '咖啡厅' as SearchType, icon: <Icon type="icon-kafeiting" />, color: '#845ef7', bgColor: '#f3f0ff' },
  { type: '奶茶店' as SearchType, icon: <Icon type="icon-zhenzhunaicha" />, color: '#20c997', bgColor: '#e6fcf5' },
  { type: '商场' as SearchType, icon: <Icon type="icon-shangchang1" />, color: '#20c997', bgColor: '#e6fcf5' },
  { type: '酒吧' as SearchType, icon: <Icon type="icon-jiubajiulang" />, color: '#fd7e14', bgColor: '#fff4e6' },
  { type: '酒店' as SearchType, icon: <Icon type="icon-jiudian" />, color: '#20c997', bgColor: '#e6fcf5' },
  { type: '医院' as SearchType, icon: <Icon type="icon-yiyuan" />, color: '#20c997', bgColor: '#e6fcf5' },
]

const radiusOptions = [
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '2km', value: 2000 },
  { label: '3km', value: 3000 },
]

const getLocationLabel = (index: number) => {
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  return labels[index] || '?'
}

export default function LocationPanel({
  points,
  onAddPoint,
  onRemovePoint,
  onClearAll,
  onSearch,
  isSearching,
  searchRadius = 1000,
  onSearchRadiusChange,
  currentCity,
}: LocationPanelProps) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [customKeyword, setCustomKeyword] = useState('')
  const [activeSearchType, setActiveSearchType] = useState<SearchType | null>(null)

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

  const handleSearch = async (value: string) => {
    if (!value.trim()) return
    const results = await searchByKeyword(value, currentCity?.name)
    setSearchResults(results)
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
        <Text type="secondary" className="search-hint">
          或在地图上点击添加
        </Text>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 已添加地点 */}
      <div className="panel-section">
        <div className="section-header">
          <Space>
            <Text strong>已添加</Text>
            <Badge count={points.length} style={{ backgroundColor: '#667eea' }} />
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
          <List
            className="locations-list"
            dataSource={points}
            renderItem={(point, index) => (
              <List.Item
                className="location-item"
                actions={[
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onRemovePoint(point.id)}
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div className="location-badge">
                      {getLocationLabel(index)}
                    </div>
                  }
                  title={point.name}
                  description={point.address || `${point.lng.toFixed(4)}, ${point.lat.toFixed(4)}`}
                />
              </List.Item>
            )}
          />
        )}
      </div>

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
    </div>
  )
}
