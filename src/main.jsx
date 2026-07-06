import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import DirectoryHarga from './pages/DirectoryHarga'
import ProdevList from './pages/prodev/ProdevList'
import ProdevForm from './pages/prodev/ProdevForm'
import ProdevQueue from './pages/prodev/ProdevQueue'
import TemplateLibrary from './pages/prodev/TemplateLibrary'

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
          {/* Menu Prodev hanya untuk sales yang ditandai sebagai innersales */}
          {profile.is_innersales && (
            <>
              <Route path="/prodev" element={<ProdevList />} />
              <Route path="/prodev/new/:formType" element={<ProdevForm />} />
              <Route path="/prodev/edit/:id" element={<ProdevForm />} />
              <Route path="/prodev/templates" element={<TemplateLibrary />} />
            </>
          )}
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/directory" element={<DirectoryHarga />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
      {profile.role === 'prodev' && (
        <>
          <Route path="/" element={<ProdevQueue />} />
          <Route path="/prodev/templates" element={<TemplateLibrary />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/directory" element={<DirectoryHarga />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
      {profile.role === 'sample_maker' && (
        <>
          <Route path="/" element={<ProdevQueue />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/directory" element={<DirectoryHarga />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
      {profile.role === 'estimator' && (
        <>
          <Route path="/" element={<EstimatorQueue />} />
          <Route path="/calculator/:requestId" element={<Calculator />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/pricing-dataset" element={<PricingDataset />} />
          <Route path="/directory" element={<DirectoryHarga />} />
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
          <Route path="/directory" element={<DirectoryHarga />} />
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
          <Route path="/prodev-queue" element={<ProdevQueue />} />
          <Route path="/prodev" element={<ProdevList />} />
          <Route path="/prodev/templates" element={<TemplateLibrary />} />
          <Route path="/calculator/:requestId" element={<Calculator />} />
          <Route path="/potong-kertas" element={<PotongKertas />} />
          <Route path="/pricing-dataset" element={<PricingDataset />} />
          <Route path="/directory" element={<DirectoryHarga />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <RoleRouter />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)




