import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import SalesDashboard from './pages/SalesDashboard'
import EstimatorQueue from './pages/EstimatorQueue'
import Calculator from './pages/Calculator'
import ManagerDashboard from './pages/ManagerDashboard'
import PotongKertas from './pages/PotongKertas'
import PricingDataset from './pages/PricingDataset'
import UserManagement from './pages/UserManagement'
import PurchasingQueue from './pages/PurchasingQueue'
import PurchasingReview from './pages/PurchasingReview'

function RoleRouter() {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#666' }}>
      Memuat...
    </div>
  )

  if (!user) return <LoginPage />

  if (!profile) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#666' }}>
      Memuat profil...
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      {profile.role === 'sales' && (
        <>
          <Route path="/" element={<SalesDashboard />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
      {profile.role === 'estimator' && (
        <>
          <Route path="/" element={<EstimatorQueue />} />
          <Route path="/calculator/:requestId" element={<Calculator />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/pricing-dataset" element={<PricingDataset />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
      {profile.role === 'purchasing' && (
        <>
          <Route path="/" element={<Navigate to="/purchasing" replace />} />
          <Route path="/purchasing" element={<PurchasingQueue />} />
          <Route path="/purchasing/:quotationId" element={<PurchasingReview />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/pricing-dataset" element={<PricingDataset />} />
          <Route path="*" element={<Navigate to="/purchasing" replace />} />
        </>
      )}
      {profile.role === 'manager' && (
        <>
          <Route path="/" element={<ManagerDashboard />} />
          <Route path="/sales" element={<SalesDashboard />} />
          <Route path="/estimator" element={<EstimatorQueue />} />
          <Route path="/purchasing" element={<PurchasingQueue />} />
          <Route path="/purchasing/:quotationId" element={<PurchasingReview />} />
          <Route path="/calculator/:requestId" element={<Calculator />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/pricing-dataset" element={<PricingDataset />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/calculator-risepack">
      <AuthProvider>
        <RoleRouter />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)



