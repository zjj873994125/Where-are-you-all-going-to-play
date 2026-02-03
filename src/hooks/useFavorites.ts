import { useState, useEffect, useCallback } from 'react'
import { LocationPoint } from '@/types'

const STORAGE_KEY = 'meetpoint_favorites'

// 收藏的地点类型（增加收藏时间）
export interface FavoritePoint extends LocationPoint {
  favoriteTime: number
}

/**
 * 收藏地点管理 hook
 * 使用 localStorage 持久化存储
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoritePoint[]>([])

  // 初始化时从 localStorage 读取
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setFavorites(parsed)
        }
      }
    } catch (e) {
      console.error('读取收藏数据失败:', e)
    }
  }, [])

  // 保存到 localStorage
  const saveFavorites = useCallback((newFavorites: FavoritePoint[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites))
      setFavorites(newFavorites)
    } catch (e) {
      console.error('保存收藏数据失败:', e)
    }
  }, [])

  // 添加收藏
  const addFavorite = useCallback((point: LocationPoint) => {
    // 检查是否已存在（根据经纬度判断）
    const exists = favorites.some(
      (f) => f.lng === point.lng && f.lat === point.lat
    )
    if (exists) return false

    const favoritePoint: FavoritePoint = {
      ...point,
      id: `fav_${Date.now()}`, // 使用新 ID 避免冲突
      favoriteTime: Date.now(),
    }
    saveFavorites([favoritePoint, ...favorites])
    return true
  }, [favorites, saveFavorites])

  // 移除收藏
  const removeFavorite = useCallback((id: string) => {
    const newFavorites = favorites.filter((f) => f.id !== id)
    saveFavorites(newFavorites)
  }, [favorites, saveFavorites])

  // 检查某个地点是否已收藏
  const isFavorite = useCallback((point: LocationPoint) => {
    return favorites.some(
      (f) => f.lng === point.lng && f.lat === point.lat
    )
  }, [favorites])

  // 清空所有收藏
  const clearFavorites = useCallback(() => {
    saveFavorites([])
  }, [saveFavorites])

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    clearFavorites,
  }
}
