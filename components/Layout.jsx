import { useAuth } from '../lib/AuthContext'

const roleLabel = { sales: 'Sales', estimator: 'Estimator', manager: 'Manager' }
const roleColor = { sales: '#2563eb', estimator: '#16a34a', manager: '#7c3aed' }

export default function Layout({ children, title }) {
  const { profile, signOut } = useAuth()

  return (
    <div style={{ minHeight:'100vh', background:'#f5f6fa' }}>
      <nav style={{
        background:'#fff', borderBottom:'1px solid #e5e7eb',
        padding:'0 24px', display:'flex', alignItems:'center',
        justifyContent:'space-between', height:56
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>📦</span>
          <span style={{ fontWeight:600, color:'#1a1a1a', fontSize:16 }}>Risepack Calculator</span>
          {title && (
            <>
              <span style={{ color:'#d1d5db' }}>›</span>
              <span style={{ color:'#6b7280', fontSize:14 }}>{title}</span>
            </>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {profile && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{
                padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:500,
                background: roleColor[profile.role] + '15',
                color: roleColor[profile.role]
              }}>{roleLabel[profile.role]}</span>
              <span style={{ fontSize:13, color:'#374151' }}>{profile.full_name}</span>
            </div>
          )}
          <button onClick={signOut} style={{
            padding:'6px 14px', fontSize:13, border:'1px solid #e5e7eb',
            borderRadius:8, cursor:'pointer', background:'#fff', color:'#6b7280'
          }}>Keluar</button>
        </div>
      </nav>
      <main style={{ padding:24 }}>
        {children}
      </main>
    </div>
  )
}
