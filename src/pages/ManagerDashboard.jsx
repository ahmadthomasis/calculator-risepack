import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const fmt = n => (n || 0).toLocaleString('id-ID')
const idr = n => 'Rp ' + fmt(Math.round(n || 0))
// Format ringkas untuk angka besar: 1.2Jt, 1.5M, dst.
// Di bawah 1 juta tetap tampil apa adanya (tidak ada satuan yang pas untuk itu).
const idrCompact = n => {
  const v = Math.round(n || 0)
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return 'Rp ' + (v / 1_000_000_000).toFixed(abs % 1_000_000_000 === 0 ? 0 : 1) + 'M'
  if (abs >= 1_000_000) return 'Rp ' + (v / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1) + 'Jt'
  return idr(v)
}

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
  const todayStr = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgoStr = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })()
  const [startDate,  setStartDate]  = useState(thirtyDaysAgoStr)
  const [endDate,    setEndDate]    = useState(todayStr)
  const [lastSeen]   = useState(() => localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString())
  const [salesFilter, setSalesFilter] = useState('all')

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { loadData() }, [startDate, endDate])

  useEffect(() => {
    const channel = supabase
      .channel('manager-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [startDate, endDate])

  async function loadData() {
    setLoading(true)
    // endDate inklusif sampai akhir hari (23:59:59), supaya request yang masuk
    // di hari endDate ikut tercakup, bukan cuma sampai jam 00:00.
    const endInclusive = new Date(endDate); endInclusive.setHours(23, 59, 59, 999)
    const startInclusive = new Date(startDate); startInclusive.setHours(0, 0, 0, 0)

    const [{ data: reqs }, { data: quots }] = await Promise.all([
      supabase.from('requests').select('*, profiles!requests_sales_id_fkey(full_name)')
        .gte('submitted_at', startInclusive.toISOString()).lte('submitted_at', endInclusive.toISOString()),
      supabase.from('quotations').select('*, requests(id, customer_name, product_type, quantity, submitted_at, sales_id, profiles!requests_sales_id_fkey(full_name))')
        .gte('created_at', startInclusive.toISOString()).lte('created_at', endInclusive.toISOString())
        .eq('is_active', true).eq('is_draft', false),
    ])
    setRequests(reqs || [])
    setQuotations(quots || [])
    setLoading(false)
  }


  // ── analytics ─────────────────────────────────────────────
  // Daftar sales unik (dari semua requests, untuk dropdown)
  const salesList = [...new Set(requests.map(r => r.profiles?.full_name).filter(Boolean))].sort()

  // Filter requests & quotations berdasarkan sales yang dipilih
  const filteredRequests = salesFilter === 'all'
    ? requests
    : requests.filter(r => r.profiles?.full_name === salesFilter)
  const filteredQuotations = salesFilter === 'all'
    ? quotations
    : quotations.filter(q => q.requests?.profiles?.full_name === salesFilter)

  // Semua stats pakai filteredRequests & filteredQuotations
  const totalReq    = filteredRequests.length
  const done        = filteredRequests.filter(r => r.status === 'done').length
  const pending     = filteredRequests.filter(r => r.status === 'pending').length
  const inProgress  = filteredRequests.filter(r => r.status === 'in_progress').length
  const dealCount   = filteredQuotations.filter(q => q.deal_status === 'deal').length
  const dealRate    = totalReq > 0 ? Math.round((dealCount / totalReq) * 100) : 0
  const totalNilai  = filteredQuotations.filter(q => q.deal_status === 'deal').reduce((s, q) => s + (q.selling_price || 0), 0)
  const completedReqs = filteredRequests.filter(r => r.completed_at && r.submitted_at)
  const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
  const sameDayReqs   = completedReqs.filter(r => isSameDay(r.submitted_at, r.completed_at))
  const crossDayReqs  = completedReqs.filter(r => !isSameDay(r.submitted_at, r.completed_at))
  const avgHours = (list) => list.length === 0 ? 0 :
    list.reduce((sum, r) => sum + (new Date(r.completed_at) - new Date(r.submitted_at)) / 3600000, 0) / list.length
  const avgResponse = avgHours(completedReqs)

  // Breakdown by product type (dari filteredRequests)
  const byProduct = {}
  filteredRequests.forEach(r => {
    byProduct[r.product_type] = (byProduct[r.product_type] || 0) + 1
  })
  const productRows = Object.entries(byProduct).sort((a, b) => b[1] - a[1])

  // Breakdown by sales (dari filteredRequests)
  const bySales = {}
  filteredRequests.forEach(r => {
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div style={{ fontSize:16, fontWeight:600, color:'#1a1a1a' }}>Ringkasan</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {[[7,'7 hari'],[30,'30 hari'],[90,'90 hari']].map(([days, label]) => (
            <button key={days} onClick={() => {
              const e = new Date(); const s = new Date(); s.setDate(s.getDate() - days)
              setStartDate(s.toISOString().slice(0,10)); setEndDate(e.toISOString().slice(0,10))
            }} style={{ padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:12, background:'#fff', color:'#6b7280', cursor:'pointer' }}>
              {label}
            </button>
          ))}
          <span style={{ color:'#d1d5db' }}>|</span>
          <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, background:'#fff' }} />
          <span style={{ fontSize:13, color:'#9ca3af' }}>—</span>
          <input type="date" value={endDate} min={startDate} max={todayStr} onChange={e => setEndDate(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, background:'#fff' }} />
          <span style={{ color:'#d1d5db' }}>|</span>
          <select
            value={salesFilter}
            onChange={e => setSalesFilter(e.target.value)}
            style={{ padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:12, background:'#fff', color: salesFilter === 'all' ? '#6b7280' : '#1d4ed8', cursor:'pointer', outline:'none', fontWeight: salesFilter === 'all' ? 400 : 600 }}
          >
            <option value="all">Semua Sales</option>
            {salesList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
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
            <StatCard label="Nilai Deal" value={idrCompact(totalNilai)} color="#16a34a" sub={idr(totalNilai)} />
            <StatCard label="Avg Response" value={`${avgResponse.toFixed(1)}j`} color="#374151"
              sub={`${sameDayReqs.length} same-day, ${crossDayReqs.length} lintas hari`} />
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
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>Quotation Terbaru</div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>
                {filteredQuotations.length}{salesFilter !== 'all' ? `/${quotations.length}` : ''} total — scroll untuk lihat semua
              </div>
            </div>
            <div style={{ maxHeight:520, overflowY:'auto', border:'1px solid #f3f4f6', borderRadius:8 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Customer','Produk','Qty','Harga Jual','Per Unit','Status','Sumber','Purchasing','Tanggal'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:12, color:'#9ca3af', fontWeight:500, borderBottom:'2px solid #f3f4f6', position:'sticky', top:0, background:'#fff', zIndex:1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.length === 0 && (
                    <tr><td colSpan={9} style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>{salesFilter !== 'all' ? `Tidak ada quotation dari ${salesFilter}` : 'Belum ada quotation'}</td></tr>
                )}
                {filteredQuotations.map(q => (
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
                    <td style={{ padding:'10px' }}>
                      {q.cost_source === 'vendor' ? (
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#FAEEDA', color:'#633806' }} title={q.vendor_name || ''}>
                          Vendor{q.vendor_name ? `: ${q.vendor_name}` : ''}
                        </span>
                      ) : (
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#f1efe8', color:'#5f5e5a' }}>Internal</span>
                      )}
                    </td>
                    <td style={{ padding:'10px' }}>
                      {!q.purchasing_status ? (
                        q.deal_status === 'deal' ? (
                          <button
                            onClick={async () => {
                              const { error } = await supabase.from('quotations').update({
                                purchasing_status: 'pending',
                                sent_to_purchasing_at: new Date().toISOString(),
                              }).eq('id', q.id)
                              if (error) { console.error('Gagal kirim ke purchasing:', error); alert('Gagal mengirim ke Purchasing: ' + error.message); return }
                              loadData()
                            }}
                            style={{ padding:'5px 10px', background:'#fff', border:'1px solid #2563eb', color:'#2563eb', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer' }}
                          >Kirim ke Purchasing</button>
                        ) : <span style={{ fontSize:12, color:'#d1d5db' }}>—</span>
                      ) : (
                        <span style={{
                          padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                          background: { pending:'#d9770618', approved:'#16a34a18', hold:'#d9770618', cancelled:'#dc262618' }[q.purchasing_status],
                          color: { pending:'#d97706', approved:'#16a34a', hold:'#d97706', cancelled:'#dc2626' }[q.purchasing_status],
                        }}>
                          {{ pending:'Menunggu', approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }[q.purchasing_status]}
                        </span>
                      )}
                    </td>
                    <td style={{ padding:'10px', fontSize:12, color:'#9ca3af' }}>
                      {new Date(q.created_at).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}



