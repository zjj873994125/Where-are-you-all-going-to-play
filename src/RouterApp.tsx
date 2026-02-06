import { Suspense, lazy } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const MidPointPage = lazy(() => import('./App'))
const TripPlanPage = lazy(() => import('./pages/TripPlanPage'))

function RouteLoadingFallback() {
  return (
    <div className="route-loading-overlay" role="status" aria-live="polite" aria-label="页面加载中">
      <div className="route-loading-panel">
        <div className="route-loading-mark" aria-hidden="true">
          <span className="route-loading-ring" />
          <span className="route-loading-dot" />
        </div>
        <div className="route-loading-text">
          <div className="route-loading-title">正在载入页面</div>
          <div className="route-loading-subtitle">地图与行程模块初始化中</div>
        </div>
        <div className="route-loading-track" aria-hidden="true">
          <span className="route-loading-bar" />
        </div>
      </div>
    </div>
  )
}

function RouteNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = location.pathname === '/' ? location.search : ''

  const handleChange = (value: string) => {
    if (value === '/') {
      navigate({ pathname: '/', search })
    } else {
      navigate('/trip')
    }
  }

  return (
    <div className="route-nav">
      <select
        className="route-nav-select"
        value={location.pathname.startsWith('/trip') ? '/trip' : '/'}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="/">中点选址</option>
        <option value="/trip">行程规划</option>
      </select>
    </div>
  )
}

export default function RouterApp() {
  return (
    <HashRouter>
      <RouteNav />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<MidPointPage />} />
          <Route path="/trip" element={<TripPlanPage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
