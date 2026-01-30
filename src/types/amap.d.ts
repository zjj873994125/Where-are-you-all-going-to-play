declare global {
  interface Window {
    AMap: {
      Map: new (container: string | HTMLElement, options: {
        zoom?: number
        center?: [number, number]
        mapStyle?: string
        viewMode?: '2D' | '3D'
      }) => {
        destroy(): void
        setFitView(): void
        on(event: string, callback: (e: any) => void): void
        off(event: string, callback?: (e: any) => void): void
        setCenter(center: [number, number]): void
        setZoom(zoom: number): void
      }
      Marker: new (options: {
        position: [number, number]
        title?: string
        icon?: any
        label?: {
          content: string
          direction?: string
        }
      }) => {
        setMap(map: any): void
      }
      Icon: new (options: {
        image: string
        size: any
        imageSize: any
      }) => any
      Size: new (width: number, height: number) => any
    }
  }
}

export {}
