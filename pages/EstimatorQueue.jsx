import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const STATUS_LABEL = { pending:'Menunggu', in_progress:'Dikerjakan', done:'Selesai', cancelled:'Dibatalkan' }
const STATUS_COLOR = { pending:'#f59e0b', in_progress:'#2563eb', done:'#16a34a', cancelled:'#9ca3af' }

const s = {
  card: { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:24 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', padding:'10px 12px', fontSize:12, color:'#6b7280', borderBottom:'2px solid #f3f4f6', fontWeight:500 },
  td: { padding:'12px', fontSize:13, color:'#374151', borderBottom:'1px solid #f9fafb', verticalAlign:'top' },
  badge: (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500, background:c+'18', color:c }),
  btnPrimary: { padding:'7px 16px', background:'#2563eb', color:'#fff', border:'none', borderRadius:7, fontSize:13, cursor:'pointer', fontWeight:500 },
  btnGray: { padding:'7px 16px', background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', borderRadius:7, fontSize:13, cursor:'pointer' },
}

export default function EstimatorQueue() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [filter, setFilter]     = useState('all')
  const [pulse, setPulse]       = useState(false)

  useEffect(() => {
    fetchRequests()
    // Realtime subscription
    const channel = supabase
      .channel('requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests()
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchRequests() {
    const { data } = await supabase
      .from('requests')
      .select('*, profiles!requests_sales_id_fkey(full_name)')
      .order('priority', { ascending: false })
      .order('submitted_at', { ascending: true })
    setRequests(data || [])
  }

  async function startRequest(id) {
    await supabase.from('requests').update({ status:'in_progress', started_at: new Date().toISOString() }).eq('id', id)
    navigate(`/calculator/${id}`)
  }

  async function cancelRequest(id) {
    if (!confirm('Batalkan request ini?')) return
    await supabase.from('requests').update({ status:'cancelled' }).eq('id', id)
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const counts   = { all: requests.length, pending: 0, in_progress: 0, done: 0 }
  requests.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++ })

  function elapsed(submitted) {
    const mins = Math.floor((Date.now() - new Date(submitted)) / 60000)
    if (mins < 60) return `${mins}m lalu`
    if (mins < 1440) return `${Math.floor(mins/60)}j lalu`
    return `${Math.floor(mins/1440)}h lalu`
  }

  return (
    <Layout title="Antrian Estimasi">
      {/* Realtime indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <span style={{
          display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: pulse ? '#16a34a' : '#d1d5db',
          transition:'background 0.3s'
        }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>Live — update otomatis saat request masuk</span>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[['all','Semua'],['pending','Menunggu'],['in_progress','Dikerjakan'],['done','Selesai']].map(([val,label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding:'6px 16px', borderRadius:20, fontSize:13, cursor:'pointer', fontWeight:500,
            background: filter===val ? '#2563eb' : '#fff',
            color: filter===val ? '#fff' : '#6b7280',
            border: filter===val ? '1px solid #2563eb' : '1px solid #e5e7eb'
          }}>{label} <span style={{ opacity:0.7 }}>({counts[val] ?? 0})</span></button>
        ))}
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Request</th>
              <th style={s.th}>Customer</th>
              <th style={s.th}>Spesifikasi</th>
              <th style={s.th}>Qty</th>
              <th style={s.th}>Sales</th>
              <th style={s.th}>Waktu</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...s.td, color:'#9ca3af', textAlign:'center', padding:40 }}>
                Tidak ada request
              </td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} style={{ background: r.priority==='urgent' ? '#fff7ed' : 'transparent' }}>
                <td style={s.td}>
                  <div style={{ fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>{r.request_number}</div>
                  {r.priority==='urgent' && <div style={{ color:'#dc2626', fontSize:11, fontWeight:600, marginTop:2 }}>🔴 URGENT</div>}
                </td>
                <td style={s.td}><div style={{ fontWeight:500 }}>{r.customer_name}</div><div style={{ fontSize:12, color:'#9ca3af' }}>{r.product_type}</div></td>
                <td style={s.td}>
                  <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>
                    {r.product_size && <div>📐 {r.product_size}</div>}
                    {r.material_spec && <div>📄 {r.material_spec}</div>}
                    {r.print_spec && <div>🖨️ {r.print_spec}</div>}
                    {r.finishing_spec && <div>✂️ {r.finishing_spec}</div>}
                    {r.notes && <div style={{ color:'#9ca3af', fontStyle:'italic' }}>💬 {r.notes}</div>}
                  </div>
                </td>
                <td style={s.td}>{r.quantity?.toLocaleString('id-ID')}</td>
                <td style={s.td}>{r.profiles?.full_name}</td>
                <td style={s.td}><div style={{ fontSize:12, color:'#9ca3af' }}>{elapsed(r.submitted_at)}</div></td>
                <td style={s.td}><span style={s.badge(STATUS_COLOR[r.status])}>{STATUS_LABEL[r.status]}</span></td>
                <td style={s.td}>
                  <div style={{ display:'flex', gap:8, flexDirection:'column' }}>
                    {(r.status === 'pending' || r.status === 'in_progress') && (
                      <button style={s.btnPrimary} onClick={() => startRequest(r.id)}>
                        {r.status === 'pending' ? 'Mulai Hitung' : 'Lanjut Hitung'}
                      </button>
                    )}
                    {r.status === 'pending' && (
                      <button style={s.btnGray} onClick={() => cancelRequest(r.id)}>Batalkan</button>
                    )}
                    {r.status === 'done' && (
                      <button style={s.btnGray} onClick={() => navigate(`/calculator/${r.id}`)}>Lihat</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
