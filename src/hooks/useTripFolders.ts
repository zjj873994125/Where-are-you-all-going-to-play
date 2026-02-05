import { useCallback, useEffect, useState } from 'react'
import { LocationPoint } from '@/types'

const STORAGE_KEY = 'meetpoint_trip_folders'

export interface TripFolderPoint extends LocationPoint {}

export interface TripFolder {
  id: string
  name: string
  points: TripFolderPoint[]
  createdTime: number
}

function buildFolder(name: string): TripFolder {
  return {
    id: `trip_folder_${Date.now()}`,
    name: name.trim(),
    points: [],
    createdTime: Date.now(),
  }
}

function buildFolderPoint(point: LocationPoint, suffix: string): TripFolderPoint {
  return {
    ...point,
    id: `trip_folder_point_${Date.now()}_${suffix}`,
  }
}

export function useTripFolders() {
  const [folders, setFolders] = useState<TripFolder[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        setFolders(parsed)
      }
    } catch (error) {
      console.error('读取行程收藏夹失败:', error)
    }
  }, [])

  const saveFolders = useCallback((next: TripFolder[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setFolders(next)
    } catch (error) {
      console.error('保存行程收藏夹失败:', error)
    }
  }, [])

  const addFolder = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    if (folders.some((folder) => folder.name === trimmed)) return false
    const next = [...folders, buildFolder(trimmed)]
    saveFolders(next)
    return true
  }, [folders, saveFolders])

  const removeFolder = useCallback((id: string) => {
    saveFolders(folders.filter((folder) => folder.id !== id))
  }, [folders, saveFolders])

  const renameFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    if (folders.some((folder) => folder.name === trimmed && folder.id !== id)) return false
    const next = folders.map((folder) => (
      folder.id === id ? { ...folder, name: trimmed } : folder
    ))
    saveFolders(next)
    return true
  }, [folders, saveFolders])

  const addPointsToFolder = useCallback((folderId: string, points: LocationPoint[]) => {
    if (points.length === 0) return 0
    let added = 0
    const next = folders.map((folder) => {
      if (folder.id !== folderId) return folder
      const existsSet = new Set(folder.points.map((item) => `${item.lng}_${item.lat}`))
      const merged = [...folder.points]
      points.forEach((point, index) => {
        const key = `${point.lng}_${point.lat}`
        if (existsSet.has(key)) return
        existsSet.add(key)
        merged.push(buildFolderPoint(point, `${index}`))
        added += 1
      })
      return { ...folder, points: merged }
    })
    if (added > 0) {
      saveFolders(next)
    }
    return added
  }, [folders, saveFolders])

  const removePointFromFolder = useCallback((folderId: string, pointId: string) => {
    const next = folders.map((folder) => {
      if (folder.id !== folderId) return folder
      return {
        ...folder,
        points: folder.points.filter((point) => point.id !== pointId),
      }
    })
    saveFolders(next)
  }, [folders, saveFolders])

  return {
    folders,
    addFolder,
    removeFolder,
    renameFolder,
    addPointsToFolder,
    removePointFromFolder,
  }
}
