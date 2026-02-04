import { useState } from 'react'
import { POIDetail } from '@/types'

interface POIDetailCardProps {
  detail: POIDetail | null
  isLoading: boolean
  onClose?: () => void
}

type BusinessStatus = 'open' | 'closed' | 'unknown'

const WEEKDAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
}

function parseMinute(text: string): number | null {
  const match = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function parseTimeRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  const regex = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g
  let match: RegExpExecArray | null = null

  while ((match = regex.exec(text)) !== null) {
    const start = parseMinute(match[1])
    const end = parseMinute(match[2])
    if (start !== null && end !== null) {
      ranges.push({ start, end })
    }
  }

  return ranges
}

function parseWeekdaySet(text: string): Set<number> | null {
  if (/每天|每日/.test(text)) {
    return new Set([1, 2, 3, 4, 5, 6, 7])
  }
  if (/工作日/.test(text)) {
    return new Set([1, 2, 3, 4, 5])
  }
  if (/周末/.test(text)) {
    return new Set([6, 7])
  }

  const rangeMatch = text.match(/周([一二三四五六日天])\s*[至到-]\s*周?([一二三四五六日天])/)
  if (rangeMatch) {
    const start = WEEKDAY_MAP[rangeMatch[1]]
    const end = WEEKDAY_MAP[rangeMatch[2]]
    if (start && end) {
      const set = new Set<number>()
      if (start <= end) {
        for (let i = start; i <= end; i += 1) set.add(i)
      } else {
        for (let i = start; i <= 7; i += 1) set.add(i)
        for (let i = 1; i <= end; i += 1) set.add(i)
      }
      return set
    }
  }

  const singles = [...text.matchAll(/周([一二三四五六日天])/g)]
  if (singles.length > 0) {
    const set = new Set<number>()
    singles.forEach((item) => {
      const day = WEEKDAY_MAP[item[1]]
      if (day) set.add(day)
    })
    return set.size > 0 ? set : null
  }

  return null
}

function isWithinTimeRange(nowMinute: number, start: number, end: number): boolean {
  if (start === end) return true
  if (start < end) return nowMinute >= start && nowMinute < end
  return nowMinute >= start || nowMinute < end // 跨天营业（如 22:00-02:00）
}

function getBusinessStatus(detail: POIDetail): BusinessStatus {
  const source = detail.openTimeDescription || detail.openTimeRange || detail.openingHours || ''
  if (!source.trim()) return 'unknown'

  const now = new Date()
  const today = now.getDay() === 0 ? 7 : now.getDay()
  const nowMinute = now.getHours() * 60 + now.getMinutes()

  const segments = source
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  let parsedAnyRange = false

  for (const segment of segments) {
    const timeRanges = parseTimeRanges(segment)
    if (timeRanges.length === 0) continue
    parsedAnyRange = true

    const weekdaySet = parseWeekdaySet(segment) || new Set([1, 2, 3, 4, 5, 6, 7])
    if (!weekdaySet.has(today)) continue

    if (timeRanges.some((range) => isWithinTimeRange(nowMinute, range.start, range.end))) {
      return 'open'
    }
  }

  return parsedAnyRange ? 'closed' : 'unknown'
}

function formatCost(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) return null
  return `¥${cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(1)}/人`
}

export default function POIDetailCard({ detail, isLoading, onClose }: POIDetailCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose?.()
  }

  if (isLoading) {
    return (
      <div className="poi-detail-card" onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className="detail-card-close" onClick={handleClose}>✕</button>
        )}
        <div className="detail-card-loading">
          <div className="loading-spinner-small"></div>
          <span>加载详情...</span>
        </div>
      </div>
    )
  }

  if (!detail) return null

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (detail?.photos && detail.photos.length > 0) {
      setCurrentPhotoIndex((prev) =>
        prev === 0 ? detail.photos!.length - 1 : prev - 1
      )
    }
  }

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (detail?.photos && detail.photos.length > 0) {
      setCurrentPhotoIndex((prev) =>
        prev === detail.photos!.length - 1 ? 0 : prev + 1
      )
    }
  }

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (detail?.tel) {
      window.location.href = `tel:${detail.tel}`
    }
  }

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (detail) {
      const url = `https://uri.amap.com/marker?position=${detail.lng},${detail.lat}&name=${encodeURIComponent(detail.name)}`
      window.open(url, '_blank')
    }
  }

  const formatType = (type?: string) => {
    if (!type) return ''
    return type.split(';')[0].split('|')[0]
  }

  const businessStatus = getBusinessStatus(detail)
  const costText = formatCost(detail.averageCost)
  const openTimeMainText = detail.openTimeDescription || detail.openTimeRange || detail.openingHours
  const openTimeSubText =
    detail.openTimeDescription &&
    detail.openTimeRange &&
    !detail.openTimeDescription.includes(detail.openTimeRange)
      ? detail.openTimeRange
      : ''

  return (
    <div className="poi-detail-card" onClick={(e) => e.stopPropagation()}>
      {/* 关闭按钮 */}
      {onClose && (
        <button className="detail-card-close" onClick={handleClose}>✕</button>
      )}
      {/* 图片 */}
      {detail.photos && detail.photos.length > 0 && (
        <div className="detail-card-photos">
          <img
            src={detail.photos[currentPhotoIndex].url}
            alt={detail.name}
            className="detail-card-photo"
          />
          {detail.photos.length > 1 && (
            <>
              <button className="photo-nav-small photo-prev-small" onClick={handlePrevPhoto}>‹</button>
              <button className="photo-nav-small photo-next-small" onClick={handleNextPhoto}>›</button>
              <div className="photo-count">{currentPhotoIndex + 1}/{detail.photos.length}</div>
            </>
          )}
        </div>
      )}

      {/* 内容 */}
      <div className="detail-card-content">
        {/* 名称和评分 */}
        <div className="detail-card-header">
          <span className="detail-card-name">{detail.name}</span>
        </div>

        {/* 类型 */}
        {formatType(detail.type) && (
          <div className="detail-card-type">{formatType(detail.type)}</div>
        )}

        {/* 核心信息标签 */}
        <div className="detail-card-meta">
          <span className={`detail-meta-badge status-${businessStatus}`}>
            {businessStatus === 'open' ? '营业中' : businessStatus === 'closed' ? '休息中' : '营业状态未知'}
          </span>
          {detail.rating && <span className="detail-meta-badge">★ {detail.rating.toFixed(1)}</span>}
          {costText && <span className="detail-meta-badge">{costText}</span>}
        </div>

        {/* 信息列表 */}
        <div className="detail-card-info">
          <div className="detail-info-row">
            <span className="detail-info-icon">📍</span>
            <span className="detail-info-text">{detail.address}</span>
          </div>
          {costText && (
            <div className="detail-info-row">
              <span className="detail-info-icon">💰</span>
              <span className="detail-info-text">人均 {costText}</span>
            </div>
          )}
          {detail.tel && (
            <div className="detail-info-row clickable" onClick={handleCall}>
              <span className="detail-info-icon">📞</span>
              <span className="detail-info-text detail-info-link">{detail.tel}</span>
            </div>
          )}
          {openTimeMainText && (
            <div className="detail-info-row">
              <span className="detail-info-icon">🕐</span>
              <span className="detail-info-text">
                {openTimeMainText}
                {openTimeSubText && <span className="detail-info-subtext">{openTimeSubText}</span>}
              </span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="detail-card-actions">
          {detail.tel && (
            <button className="detail-action-btn detail-call-btn" onClick={handleCall}>
              📞 电话
            </button>
          )}
          <button className="detail-action-btn detail-nav-btn" onClick={handleNavigate}>
            🧭 导航
          </button>
        </div>
      </div>
    </div>
  )
}
