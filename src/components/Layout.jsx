import { useAuth } from '../lib/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

const roleLabel = { sales:'Sales', estimator:'Estimator', manager:'Manager', purchasing:'Purchasing', prodev:'Prodev' }
const C = {
  dark:   '#2C1810',
  orange: '#E8760A',
  brown:  '#5C3D2E',
  cream:  '#FDF6EC',
  border: '#E8D5BC',
}

const managerTabs = [
  { path: '/',             label: 'Manager' },
  { path: '/sales',        label: 'Sales' },
  { path: '/estimator',    label: 'Estimator' },
  { path: '/purchasing',   label: 'Purchasing' },
  { path: '/prodev-queue', label: 'Prodev' },
]

const HomeIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
  </svg>
)

const CutIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <line x1="8.5" y1="7.5" x2="20" y2="19" />
    <line x1="20" y1="5" x2="11.5" y2="13.5" />
    <line x1="8" y1="16.5" x2="9.5" y2="15" />
  </svg>
)

const UserIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const TagIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42L12 2Z" />
    <circle cx="7" cy="7" r="1.5" fill={active ? '#fff' : 'rgba(255,255,255,0.55)'} stroke="none" />
  </svg>
)

const BookIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const BoxIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
  </svg>
)

const sidebarItems = [
  { path: '/potong-kertas', label: 'Potong Kertas', Icon: CutIcon },
  { path: '/directory', label: 'Direktori', Icon: BookIcon },
]

const masterDataItems = [
  { path: '/user-management', label: 'User Mgmt', Icon: UserIcon },
  { path: '/pricing-dataset', label: 'Pricing', Icon: TagIcon },
]

export default function Layout({ children, title, beforeNavigate }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isHomeActive = location.pathname === '/'

  // Bungkus navigate(): kalau halaman saat ini (mis. Calculator) kasih beforeNavigate,
  // jalankan dulu (mis. auto-save draft) dan TUNGGU selesai, baru benar-benar pindah.
  // Ini menjamin urutan: simpan dulu, baru navigasi — tidak bergantung pada cleanup
  // function useEffect yang tidak bisa di-await dan rawan race condition.
  async function goTo(path) {
    if (beforeNavigate) {
      try { await beforeNavigate() } catch (e) { console.error('beforeNavigate gagal:', e) }
    }
    navigate(path)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5EFE6', display:'flex' }}>

      {/* ── Sidebar kiri ───────────────────────────────────── */}
      <aside style={{
        width:84,
        background: C.dark,
        borderRight:`3px solid ${C.orange}`,
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        flexShrink:0,
        paddingTop:18,
        paddingBottom:18,
        gap:6,
      }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', gap:6 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:18 }}>
          <span style={{ fontSize:16, fontWeight:800, color:'#fff', letterSpacing:'-0.5px', lineHeight:1.1 }}>Rise</span>
          <span style={{ fontSize:16, fontWeight:800, color:C.orange, letterSpacing:'-0.5px', lineHeight:1.1 }}>pack</span>
        </div>

        <button
          onClick={() => goTo('/')}
          style={{
            width:64, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer',
            background: isHomeActive ? C.orange : 'transparent',
            transition:'background 0.15s',
          }}
        >
          <HomeIcon active={isHomeActive} />
          <span style={{ fontSize:10.5, fontWeight:600, color: isHomeActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>Home</span>
        </button>

        {[
          // Menu Prodev: hanya untuk sales yang ditandai innersales
          ...(profile?.role === 'sales' && profile?.is_innersales
            ? [{ path:'/prodev', label:'Prodev', Icon: BoxIcon }] : []),
          ...sidebarItems,
        ].map(item => {
          const active = item.path === '/prodev'
            ? location.pathname.startsWith('/prodev')
            : location.pathname === item.path
          const { Icon } = item
          return (
            <button
              key={item.path}
              onClick={() => goTo(item.path)}
              style={{
                width:64, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer',
                background: active ? C.orange : 'transparent',
                transition:'background 0.15s',
              }}
            >
              <Icon active={active} />
              <span style={{ fontSize:10.5, fontWeight:600, color: active ? '#fff' : 'rgba(255,255,255,0.55)', textAlign:'center', lineHeight:1.2 }}>{item.label}</span>
            </button>
          )
        })}
        </div>

        {(['manager','estimator','purchasing'].includes(profile?.role)) && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', gap:6, marginTop:'auto', paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:2 }}>
              Master Data
            </span>
            {masterDataItems.filter(item => {
              if (item.path === '/user-management') return profile?.role === 'manager'
              return true
            }).map(item => {
              const active = location.pathname === item.path
              const { Icon } = item
              return (
                <button
                  key={item.path}
                  onClick={() => goTo(item.path)}
                  style={{
                    width:64, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer',
                    background: active ? C.orange : 'transparent',
                    transition:'background 0.15s',
                  }}
                >
                  <Icon active={active} />
                  <span style={{ fontSize:10, fontWeight:600, color: active ? '#fff' : 'rgba(255,255,255,0.55)', textAlign:'center', lineHeight:1.2 }}>{item.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </aside>

      {/* ── Area kanan: topbar + konten ───────────────────── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
        <nav style={{
          background: C.dark,
          borderBottom:`3px solid ${C.orange}`,
          padding:'0 24px',
          display:'flex', alignItems:'center',
          justifyContent:'space-between', height:58,
          flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>Calculator</span>
            {title && (
              <>
                <span style={{ color:'rgba(255,255,255,0.3)' }}>›</span>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>{title}</span>
              </>
            )}
          </div>

          {profile?.role === 'manager' && (
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              {managerTabs.map(tab => {
                const active = location.pathname === tab.path
                return (
                  <button
                    key={tab.path}
                    onClick={() => goTo(tab.path)}
                    style={{
                      padding:'6px 14px',
                      fontSize:13,
                      fontWeight:600,
                      borderRadius:8,
                      border:'1px solid rgba(255,255,255,0.18)',
                      cursor:'pointer',
                      background: active ? C.orange : 'rgba(255,255,255,0.06)',
                      color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                      transition:'background 0.15s'
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}

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
        <main style={{ padding:24, flex:1, minWidth:0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}




