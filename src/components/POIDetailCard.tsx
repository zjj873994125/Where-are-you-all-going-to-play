import { useState } from 'react'
import { POIDetail } from '@/types'

interface POIDetailCardProps {
  detail: POIDetail | null
  isLoading: boolean
  onClose?: () => void
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
          {detail.rating && (
            <span className="detail-card-rating">★ {detail.rating}</span>
          )}
        </div>

        {/* 类型 */}
        {formatType(detail.type) && (
          <div className="detail-card-type">{formatType(detail.type)}</div>
        )}

        {/* 信息列表 */}
        <div className="detail-card-info">
          <div className="detail-info-row">
            <span className="detail-info-icon">📍</span>
            <span className="detail-info-text">{detail.address}</span>
          </div>
          {detail.tel && (
            <div className="detail-info-row clickable" onClick={handleCall}>
              <span className="detail-info-icon">📞</span>
              <span className="detail-info-text detail-info-link">{detail.tel}</span>
            </div>
          )}
          {detail.openingHours && (
            <div className="detail-info-row">
              <span className="detail-info-icon">🕐</span>
              <span className="detail-info-text">{detail.openingHours}</span>
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
