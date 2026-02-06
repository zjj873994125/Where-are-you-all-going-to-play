import { Suspense, lazy } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AnimatedSwitch from './components/AnimatedSwitch'
import './RouterApp.css'

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
  const isTrip = location.pathname.startsWith('/trip')

  const handleSwitchChange = (checked: boolean) => {
    if (checked) {
      navigate('/trip')
    } else {
      navigate({ pathname: '/', search })
    }
  }

  return (
    <div className="route-nav">
      <AnimatedSwitch
        checked={isTrip}
        onChange={handleSwitchChange}
        className="route-nav-switch"
        leftLabel="中点"
        rightLabel="行程"
        ariaLabel="切换页面：中点 / 行程"
        offTrackGradient="linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
        onTrackGradient="linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)"
        focusRingColor="rgba(125, 211, 252, 0.35)"
      />
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
