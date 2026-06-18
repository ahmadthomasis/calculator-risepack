import { useAuth } from '../lib/AuthContext'

const roleLabel = { sales:'Sales', estimator:'Estimator', manager:'Manager' }
const C = {
  dark:   '#2C1810',
  orange: '#E8760A',
  brown:  '#5C3D2E',
  cream:  '#FDF6EC',
  border: '#E8D5BC',
}

export default function Layout({ children, title }) {
  const { profile, signOut } = useAuth()

  return (
    <div style={{ minHeight:'100vh', background:'#F5EFE6' }}>
      <nav style={{
        background: C.dark,
        borderBottom:`3px solid ${C.orange}`,
        padding:'0 24px',
        display:'flex', alignItems:'center',
        justifyContent:'space-between', height:58
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {/* Logo text */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>Rise</span>
            <span style={{ fontSize:22, fontWeight:800, color:C.orange, letterSpacing:'-0.5px' }}>pack</span>
          </div>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.2)' }} />
          <span style={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>Calculator</span>
          {title && (
            <>
              <span style={{ color:'rgba(255,255,255,0.3)' }}>›</span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>{title}</span>
            </>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {profile && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{
                padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                background: C.orange, color:'#fff'
              }}>{roleLabel[profile.role]}</span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.85)' }}>{profile.full_name}</span>
            </div>
          )}
          <button onClick={signOut} style={{
            padding:'6px 14px', fontSize:13,
            border:'1px solid rgba(255,255,255,0.25)',
            borderRadius:8, cursor:'pointer',
            background:'rgba(255,255,255,0.08)',
            color:'rgba(255,255,255,0.8)'
          }}>Keluar</button>
        </div>
      </nav>
      <main style={{ padding:24 }}>
        {children}
      </main>
    </div>
  )
}
