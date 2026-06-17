import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

const s = {
  wrap:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f2f5' },
  card:  { background:'#fff', borderRadius:12, padding:'40px 36px', width:360, boxShadow:'0 2px 16px rgba(0,0,0,0.1)' },
  logo:  { textAlign:'center', marginBottom:28 },
  title: { fontSize:22, fontWeight:600, color:'#1a1a1a', marginBottom:4 },
  sub:   { fontSize:13, color:'#888' },
  label: { display:'block', fontSize:13, fontWeight:500, color:'#444', marginBottom:6, marginTop:18 },
  input: { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:14, outline:'none' },
  btn:   { width:'100%', marginTop:24, padding:'11px', background:'#2563eb', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:500, cursor:'pointer' },
  err:   { marginTop:14, padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontSize:13 },
}

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
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={{ fontSize:32, marginBottom:8 }}>📦</div>
          <div style={s.title}>Risepack Calculator</div>
          <div style={s.sub}>Sistem kalkulasi harga packaging</div>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="nama@risepack.com" required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          {error && <div style={s.err}>{error}</div>}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
