import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const fmt = n => (n || 0).toLocaleString('id-ID')
const idr = n => 'Rp ' + fmt(Math.round(n || 0))

const DEAL_LABEL = { quoted:'Belum Diisi', deal:'Deal ✅', no_deal:'No Deal ❌', followup:'Followup 🔄' }
const DEAL_COLOR = { quoted:'#9ca3af', deal:'#16a34a', no_deal:'#dc2626', followup:'#d97706' }
const LAST_SEEN_KEY = 'risepack_manager_deal_last_seen'

function StatCard({ label, value, sub, color='#2563eb' }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'20px 24px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:13, color:'#374151', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

export default function ManagerDashboard() {
  const [requests,   setRequests]   = useState([])
  const [quotations, setQuotations] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [range,      setRange]      = useState('30')
  const [lastSeen]   = useState(() => localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString())

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { loadData() }, [range])

  useEffect(() => {
    const channel = supabase
      .channel('manager-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [range])

  async function loadData() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - parseInt(range))

    const [{ data: reqs }, { data: quots }] = await Promise.all([
      supabase.from('requests').select('*, profiles!requests_sales_id_fkey(full_name)').gte('submitted_at', since.toISOString()),
      supabase.from('quotations').select('*, requests(customer_name, product_type, quantity, submitted_at)').gte('created_at', since.toISOString()).eq('is_active', true).eq('is_draft', false),
    ])
    setRequests(reqs || [])
    setQuotations(quots || [])
    setLoading(false)
  }

  // ── analytics ─────────────────────────────────────────────
  const totalReq    = requests.length
  const done        = requests.filter(r => r.status === 'done').length
  const pending     = requests.filter(r => r.status === 'pending').length
  const inProgress  = requests.filter(r => r.status === 'in_progress').length
  const dealCount   = quotations.filter(q => q.deal_status === 'deal').length
  const dealRate    = totalReq > 0 ? Math.round((dealCount / totalReq) * 100) : 0
  const totalNilai  = quotations.filter(q => q.deal_status === 'deal').reduce((s, q) => s + (q.selling_price || 0), 0)
  const avgResponse = requests.filter(r => r.completed_at && r.submitted_at).reduce((sum, r) => {
    return sum + (new Date(r.completed_at) - new Date(r.submitted_at)) / 3600000
  }, 0) / (done || 1)

  // Breakdown by product type
  const byProduct = {}
  requests.forEach(r => {
    byProduct[r.product_type] = (byProduct[r.product_type] || 0) + 1
  })
  const productRows = Object.entries(byProduct).sort((a, b) => b[1] - a[1])

  // Breakdown by sales
  const bySales = {}
  requests.forEach(r => {
    const name = r.profiles?.full_name || 'Unknown'
    bySales[name] = (bySales[name] || 0) + 1
  })
  const salesRows = Object.entries(bySales).sort((a, b) => b[1] - a[1])

  return (
    <Layout title="Dashboard Manager">
      <style>{`
        @keyframes pulseDotMgr {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ fontSize:16, fontWeight:600, color:'#1a1a1a' }}>Ringkasan</div>
        <select value={range} onChange={e => setRange(e.target.value)}
          style={{ padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, background:'#fff' }}>
          <option value="7">7 hari terakhir</option>
          <option value="30">30 hari terakhir</option>
          <option value="90">90 hari terakhir</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Memuat data...</div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:16, marginBottom:24 }}>
            <StatCard label="Total Request" value={totalReq} />
            <StatCard label="Menunggu" value={pending} color="#f59e0b" />
            <StatCard label="Dikerjakan" value={inProgress} color="#2563eb" />
            <StatCard label="Selesai" value={done} color="#16a34a" />
            <StatCard label="Deal Rate" value={`${dealRate}%`} color="#7c3aed" sub={`${dealCount} dari ${totalReq}`} />
            <StatCard label="Nilai Deal" value={idr(totalNilai)} color="#16a34a" />
            <StatCard label="Avg Response" value={`${avgResponse.toFixed(1)}j`} color="#374151" sub="waktu estimasi" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            {/* By product */}
            <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Request per Produk</div>
              {productRows.map(([name, count]) => (
                <div key={name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                    <span style={{ color:'#374151' }}>{name}</span>
                    <span style={{ fontWeight:500 }}>{count}</span>
                  </div>
                  <div style={{ height:6, background:'#f3f4f6', borderRadius:3 }}>
                    <div style={{ height:6, background:'#2563eb', borderRadius:3, width:`${(count/totalReq)*100}%`, transition:'width 0.5s' }} />
                  </div>
                </div>
              ))}
              {productRows.length === 0 && <div style={{ color:'#9ca3af', fontSize:13 }}>Belum ada data</div>}
            </div>

            {/* By sales */}
            <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Request per Sales</div>
              {salesRows.map(([name, count]) => (
                <div key={name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                    <span style={{ color:'#374151' }}>{name}</span>
                    <span style={{ fontWeight:500 }}>{count}</span>
                  </div>
                  <div style={{ height:6, background:'#f3f4f6', borderRadius:3 }}>
                    <div style={{ height:6, background:'#7c3aed', borderRadius:3, width:`${(count/totalReq)*100}%`, transition:'width 0.5s' }} />
                  </div>
                </div>
              ))}
              {salesRows.length === 0 && <div style={{ color:'#9ca3af', fontSize:13 }}>Belum ada data</div>}
            </div>
          </div>

          {/* Recent quotations */}
          <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Quotation Terbaru</div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Customer','Produk','Qty','Harga Jual','Per Unit','Status','Tanggal'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:12, color:'#9ca3af', fontWeight:500, borderBottom:'2px solid #f3f4f6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 && (
                  <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Belum ada quotation</td></tr>
                )}
                {quotations.slice(0, 20).map(q => (
                  <tr key={q.id}>
                    <td style={{ padding:'10px', fontSize:13 }}>{q.requests?.customer_name}</td>
                    <td style={{ padding:'10px', fontSize:13 }}>{q.requests?.product_type}</td>
                    <td style={{ padding:'10px', fontSize:13 }}>{fmt(q.requests?.quantity)}</td>
                    <td style={{ padding:'10px', fontSize:13, fontWeight:500 }}>{idr(q.selling_price)}</td>
                    <td style={{ padding:'10px', fontSize:13 }}>{idr(q.price_per_unit)}</td>
                    <td style={{ padding:'10px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {q.deal_status !== 'quoted' && q.updated_at && new Date(q.updated_at) > new Date(lastSeen) && (
                          <span style={{
                            width:7, height:7, borderRadius:'50%', background:'#dc2626', flexShrink:0,
                            animation:'pulseDotMgr 1.4s ease-in-out infinite',
                          }} />
                        )}
                        <select value={q.deal_status} onChange={async e => {
                          await supabase.from('quotations').update({ deal_status: e.target.value, updated_at: new Date().toISOString() }).eq('id', q.id)
                          loadData()
                        }} style={{ padding:'4px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, background:'#fff', color: DEAL_COLOR[q.deal_status] }}>
                          <option value="quoted">Belum Diisi</option>
                          <option value="deal">Deal ✅</option>
                          <option value="no_deal">No Deal ❌</option>
                          <option value="followup">Followup 🔄</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ padding:'10px', fontSize:12, color:'#9ca3af' }}>
                      {new Date(q.created_at).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  )
}


