import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError('Email atau password salah.')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg, ${C.dark} 0%, #4A2820 100%)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:380 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginBottom:8 }}>
            <span style={{ fontSize:40, fontWeight:900, color:'#fff', letterSpacing:'-1px' }}>Rise</span>
            <span style={{ fontSize:40, fontWeight:900, color:C.orange, letterSpacing:'-1px' }}>pack</span>
          </div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', letterSpacing:'2px', textTransform:'uppercase' }}>
            Price Calculator
          </div>
        </div>

        {/* Card */}
        <div style={{ background:'#fff', borderRadius:16, padding:'36px 32px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize:18, fontWeight:600, color:C.dark, marginBottom:4 }}>Masuk ke Akun</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginBottom:24 }}>Sistem kalkulasi harga packaging</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:C.brown, marginBottom:6 }}>Email</label>
              <input style={{
                width:'100%', padding:'10px 12px',
                border:`1.5px solid ${C.border}`, borderRadius:8,
                fontSize:14, outline:'none', boxSizing:'border-box', color:C.dark
              }} type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="nama@risepack.id" required />
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:C.brown, marginBottom:6 }}>Password</label>
              <input style={{
                width:'100%', padding:'10px 12px',
                border:`1.5px solid ${C.border}`, borderRadius:8,
                fontSize:14, outline:'none', boxSizing:'border-box', color:C.dark
              }} type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {error && (
              <div style={{ margin:'12px 0', padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontSize:13 }}>
                {error}
              </div>
            )}

            <button style={{
              width:'100%', marginTop:20, padding:'12px',
              background: loading ? '#ccc' : C.orange,
              color:'#fff', border:'none', borderRadius:8,
              fontSize:15, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer',
              transition:'background 0.2s'
            }} type="submit" disabled={loading}>
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'rgba(255,255,255,0.3)' }}>
          © 2026 Risepack · Sistem Internal
        </div>
      </div>
    </div>
  )
}
