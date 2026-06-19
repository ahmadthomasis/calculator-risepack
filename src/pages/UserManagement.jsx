import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:    { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', border:`1px solid ${C.border}`, marginBottom:20 },
  input:   { padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', color:C.dark, width:'100%', boxSizing:'border-box' },
  select:  { padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', background:'#fff', color:C.dark, width:'100%', boxSizing:'border-box' },
  label:   { fontSize:12, color:'#9ca3af', fontWeight:500, marginBottom:6, display:'block' },
  th:      { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:600, textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:      { padding:'10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, verticalAlign:'middle' },
  btn:     { padding:'9px 18px', background:C.orange, color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhost:{ padding:'5px 10px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', color:C.brown },
  btnDanger:{ padding:'5px 10px', background:'#fff', border:'1px solid #fecaca', borderRadius:6, fontSize:12, cursor:'pointer', color:'#dc2626' },
}

const roleLabel = { sales:'Sales', estimator:'Estimator', manager:'Manager' }
const FUNCTIONS_URL = 'https://ycwacahngbletmqafwac.supabase.co/functions/v1'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name } | null

  const [form, setForm] = useState({ full_name:'', email:'', password:'', role:'sales' })

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const callFunction = async (path, body) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
    return data
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await callFunction('manage-user', { action: 'list' })
      setUsers(data.users || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await callFunction('create-user', form)
      showToast('success', `User ${form.full_name} berhasil dibuat`)
      setForm({ full_name:'', email:'', password:'', role:'sales' })
      setShowForm(false)
      fetchUsers()
    } catch (e) {
      showToast('error', e.message)
    }
    setSubmitting(false)
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await callFunction('manage-user', { action:'update_role', target_user_id:userId, new_role:newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role:newRole } : u))
      showToast('success', 'Role diperbarui')
    } catch (e) {
      showToast('error', e.message)
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await callFunction('manage-user', { action: user.banned ? 'reactivate' : 'deactivate', target_user_id:user.id })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: !u.banned } : u))
      showToast('success', user.banned ? 'User diaktifkan kembali' : 'User dinonaktifkan')
    } catch (e) {
      showToast('error', e.message)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await callFunction('manage-user', { action:'delete_permanent', target_user_id:confirmDelete.id })
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.id))
      showToast('success', `User ${confirmDelete.name} dihapus permanen`)
    } catch (e) {
      showToast('error', e.message)
    }
    setConfirmDelete(null)
  }

  return (
    <Layout title="User Management">
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:4 }}>User Management</h2>
            <p style={{ fontSize:13, color:'#9ca3af' }}>Kelola akun tim — tambah, ubah role, nonaktifkan, atau hapus.</p>
          </div>
          <button style={s.btn} onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Batal' : '+ Tambah User'}
          </button>
        </div>

        {toast && (
          <div style={{
            padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:13, fontWeight:500,
            background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: toast.type === 'error' ? '#dc2626' : '#16a34a',
            border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#86efac'}`,
          }}>
            {toast.msg}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} style={s.card}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div>
                <label style={s.label}>Nama Lengkap</label>
                <input style={s.input} required value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name:e.target.value }))} placeholder="cth. Budi Santoso" />
              </div>
              <div>
                <label style={s.label}>Role</label>
                <select style={s.select} value={form.role}
                  onChange={e => setForm(f => ({ ...f, role:e.target.value }))}>
                  <option value="sales">Sales</option>
                  <option value="estimator">Estimator</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input style={s.input} required type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email:e.target.value }))} placeholder="nama@risepack.id" />
              </div>
              <div>
                <label style={s.label}>Password</label>
                <input style={s.input} required type="password" minLength={6} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password:e.target.value }))} placeholder="Min. 6 karakter" />
              </div>
            </div>
            <button type="submit" style={{ ...s.btn, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Buat User'}
            </button>
          </form>
        )}

        <div style={{ ...s.card, padding:0, overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Memuat daftar user...</div>
          ) : error ? (
            <div style={{ padding:40, textAlign:'center', color:'#dc2626' }}>
              Gagal memuat: {error}
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:8 }}>
                Pastikan Edge Function "manage-user" sudah ter-deploy.
              </div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={s.th}>Nama</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Status</th>
                  <th style={{ ...s.th, textAlign:'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={s.td}>{u.full_name}</td>
                    <td style={{ ...s.td, color:'#9ca3af' }}>{u.email}</td>
                    <td style={s.td}>
                      <select
                        style={{ ...s.select, width:'auto', padding:'5px 8px', fontSize:12 }}
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="sales">Sales</option>
                        <option value="estimator">Estimator</option>
                        <option value="manager">Manager</option>
                      </select>
                    </td>
                    <td style={s.td}>
                      <span style={{
                        padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600,
                        background: u.banned ? '#fef2f2' : '#f0fdf4',
                        color: u.banned ? '#dc2626' : '#16a34a',
                      }}>{u.banned ? 'Nonaktif' : 'Aktif'}</span>
                    </td>
                    <td style={{ ...s.td, textAlign:'right' }}>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button style={s.btnGhost} onClick={() => handleToggleActive(u)}>
                          {u.banned ? 'Aktifkan' : 'Nonaktifkan'}
                        </button>
                        <button style={s.btnDanger} onClick={() => setConfirmDelete({ id:u.id, name:u.full_name })}>
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(44,24,16,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50,
        }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:380, width:'90%' }}>
            <h3 style={{ fontSize:16, fontWeight:700, color:C.dark, marginBottom:10 }}>Hapus user permanen?</h3>
            <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, marginBottom:20 }}>
              <b>{confirmDelete.name}</b> akan dihapus permanen beserta akses login-nya. Tindakan ini tidak bisa
              dibatalkan. Pertimbangkan "Nonaktifkan" jika hanya ingin mencabut akses sementara.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDelete(null)}>Batal</button>
              <button
                style={{ ...s.btnDanger, background:'#dc2626', color:'#fff', borderColor:'#dc2626', padding:'8px 16px' }}
                onClick={handleDelete}
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
