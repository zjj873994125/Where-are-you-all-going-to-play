import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Select } from 'antd'
import MidPointPage from './App'
import TripPlanPage from './pages/TripPlanPage'

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
      <Select
        size="small"
        value={location.pathname.startsWith('/trip') ? '/trip' : '/'}
        onChange={handleChange}
        options={[
          { value: '/', label: '中点选址' },
          { value: '/trip', label: '行程规划' },
        ]}
      />
    </div>
  )
}

export default function RouterApp() {
  return (
    <HashRouter>
      <RouteNav />
      <Routes>
        <Route path="/" element={<MidPointPage />} />
        <Route path="/trip" element={<TripPlanPage />} />
      </Routes>
    </HashRouter>
  )
}
