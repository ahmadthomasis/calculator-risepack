import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const PSTATUS_LABEL = { pending:'Menunggu Validasi', approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }
const PSTATUS_COLOR = { pending:'#d97706', approved:'#16a34a', hold:'#d97706', cancelled:'#dc2626' }

const s = {
  card: { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:24 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', padding:'10px 12px', fontSize:12, color:'#6b7280', borderBottom:'2px solid #f3f4f6', fontWeight:500 },
  td: { padding:'12px', fontSize:13, color:'#374151', borderBottom:'1px solid #f9fafb', verticalAlign:'top' },
  badge: (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500, background:c+'18', color:c }),
  btnPrimary: { padding:'7px 16px', background:'#2563eb', color:'#fff', border:'none', borderRadius:7, fontSize:13, cursor:'pointer', fontWeight:500 },
  metricCard: { background:'#f9fafb', borderRadius:10, padding:16, flex:1 },
}

export default function PurchasingQueue() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState([])
  const [filter, setFilter] = useState('pending')
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    fetchQuotations()
    const channel = supabase
      .channel('purchasing-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
        fetchQuotations()
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchQuotations() {
    // purchasing_status not null berarti pernah dikirim ke purchasing (pending/approved/hold/cancelled)
    const { data } = await supabase
      .from('quotations')
      .select('*, requests(request_number, customer_name, product_type)')
      .not('purchasing_status', 'is', null)
      .eq('is_draft', false)
      .order('sent_to_purchasing_at', { ascending: false })
    setQuotations(data || [])
  }

  const filtered = filter === 'all' ? quotations : quotations.filter(q => q.purchasing_status === filter)
  const counts = { all: quotations.length, pending: 0, approved: 0, hold: 0, cancelled: 0 }
  quotations.forEach(q => { if (counts[q.purchasing_status] !== undefined) counts[q.purchasing_status]++ })

  function elapsed(ts) {
    if (!ts) return '—'
    const mins = Math.floor((Date.now() - new Date(ts)) / 60000)
    if (mins < 60) return `${mins}m lalu`
    if (mins < 1440) return `${Math.floor(mins/60)}j lalu`
    return `${Math.floor(mins/1440)}h lalu`
  }

  return (
    <Layout title="Antrian Purchasing">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <span style={{
          display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: pulse ? '#16a34a' : '#d1d5db',
          transition:'background 0.3s'
        }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>Live — update otomatis saat ada quotation dikirim</span>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[['pending','Menunggu Validasi'],['approved','Disetujui'],['hold','Hold'],['cancelled','Cancelled'],['all','Semua']].map(([val,label]) => (
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
              <th style={s.th}>No. Request</th>
              <th style={s.th}>Customer / Produk</th>
              <th style={s.th}>Qty</th>
              <th style={s.th}>Harga Estimator</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Dikirim</th>
              <th style={s.th}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...s.td, color:'#9ca3af', textAlign:'center', padding:40 }}>
                Tidak ada quotation
              </td></tr>
            )}
            {filtered.map(q => (
              <tr key={q.id}>
                <td style={s.td}><div style={{ fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>{q.requests?.request_number}</div></td>
                <td style={s.td}>
                  <div style={{ fontWeight:500 }}>{q.customer_name}</div>
                  <div style={{ fontSize:12, color:'#9ca3af' }}>{q.product_type}</div>
                </td>
                <td style={s.td}>{(q.quantity || 0).toLocaleString('id-ID')}</td>
                <td style={s.td}><div style={{ fontWeight:500 }}>Rp {(q.selling_price || 0).toLocaleString('id-ID')}</div></td>
                <td style={s.td}><span style={s.badge(PSTATUS_COLOR[q.purchasing_status])}>{PSTATUS_LABEL[q.purchasing_status]}</span></td>
                <td style={s.td}><div style={{ fontSize:12, color:'#9ca3af' }}>{elapsed(q.sent_to_purchasing_at)}</div></td>
                <td style={s.td}>
                  <button style={s.btnPrimary} onClick={() => navigate(`/purchasing/${q.id}`)}>
                    {q.purchasing_status === 'pending' ? 'Validasi' : 'Lihat'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
