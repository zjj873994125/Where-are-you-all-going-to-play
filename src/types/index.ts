export interface LocationPoint {
  id: string
  name: string
  address?: string
  lng: number
  lat: number
}

export interface MidPoint extends LocationPoint {}

export interface POI {
  id: string
  name: string
  address: string
  lng: number
  lat: number
  distance?: number
  rating?: number
  type?: string
}

export interface POIDetail extends POI {
  tel?: string              // 电话
  photos?: { url: string }[] // 图片数组
  openingHours?: string     // 营业时间
  website?: string          // 网站
  cityname?: string         // 城市
  adname?: string           // 区域
  businessArea?: string     // 商圈
}

export interface City {
  name: string
  adcode: string
  center?: {
    lng: number
    lat: number
  }
}

export type SearchType = '餐厅' | '咖啡厅' | '奶茶店' | '商场' | '酒吧' | '酒店' | '医院' | 'custom'

export type SearchRadius = 500 | 1000 | 2000 | 3000

export type NavMode = 'drive' | 'walk' | 'bus'
