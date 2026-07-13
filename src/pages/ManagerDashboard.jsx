import { useState, useEffect, useMemo } from 'react'
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
  const [tableSearch, setTableSearch] = useState('')
  const [tableDealFilter, setTableDealFilter] = useState('')
  const [tablePurchFilter, setTablePurchFilter] = useState('')
  const [tableSort, setTableSort] = useState('date_desc')
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, request_id, customer, produk }

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

  // tableQuotations: untuk tabel saja, dengan search + filter deal + filter purchasing + sort
  const tableQuotations = useMemo(() => {
    let list = [...filteredQuotations]
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      list = list.filter(x =>
        x.requests?.customer_name?.toLowerCase().includes(q) ||
        x.requests?.product_type?.toLowerCase().includes(q)
      )
    }
    if (tableDealFilter) list = list.filter(x => x.deal_status === tableDealFilter)
    if (tablePurchFilter === 'none') list = list.filter(x => !x.purchasing_status)
    else if (tablePurchFilter) list = list.filter(x => x.purchasing_status === tablePurchFilter)
    list.sort((a, b) => {
      if (tableSort === 'harga_desc')   return (b.selling_price || 0) - (a.selling_price || 0)
      if (tableSort === 'harga_asc')    return (a.selling_price || 0) - (b.selling_price || 0)
      if (tableSort === 'perunit_desc') return (b.price_per_unit || 0) - (a.price_per_unit || 0)
      if (tableSort === 'perunit_asc')  return (a.price_per_unit || 0) - (b.price_per_unit || 0)
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    })
    return list
  }, [filteredQuotations, tableSearch, tableDealFilter, tablePurchFilter, tableSort])

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

  async function handleDeleteQuotation(item) {
    // 1. Hapus purchasing_comparisons dulu (FK constraint)
    await supabase.from('purchasing_comparisons').delete().eq('quotation_id', item.id)
    // 2. Hapus SEMUA quotation yang terkait dengan request ini (semua qty, semua versi)
    await supabase.from('quotations').delete().eq('request_id', item.request_id)
    // 3. Hapus request-nya juga agar hilang dari semua view (estimator, sales, dll)
    const { error } = await supabase.from('requests').delete().eq('id', item.request_id)
    if (error) { alert('Gagal hapus request: ' + error.message); return }
    setConfirmDelete(null)
    loadData()
  }

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
            {/* By product — top 5, compact */}
            <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>Request per Produk</span>
                <span style={{ fontSize:11, color:'#9ca3af' }}>Top {Math.min(5, productRows.length)} dari {productRows.length}</span>
              </div>
              {productRows.slice(0, 5).map(([name, count]) => (
                <div key={name} style={{ marginBottom:7 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                    <span style={{ color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{name}</span>
                    <span style={{ fontWeight:600, color:'#2563eb', flexShrink:0 }}>{count}</span>
                  </div>
                  <div style={{ height:4, background:'#f3f4f6', borderRadius:2 }}>
                    <div style={{ height:4, background:'#2563eb', borderRadius:2, width:`${(count/productRows[0][1])*100}%`, transition:'width 0.5s' }} />
                  </div>
                </div>
              ))}
              {productRows.length === 0 && <div style={{ color:'#9ca3af', fontSize:12 }}>Belum ada data</div>}
              {productRows.length > 5 && (
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>+{productRows.length - 5} produk lainnya</div>
              )}
            </div>

            {/* By sales — compact */}
            <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>Request per Sales</span>
                <span style={{ fontSize:11, color:'#9ca3af' }}>{salesRows.length} sales</span>
              </div>
              {salesRows.map(([name, count]) => (
                <div key={name} style={{ marginBottom:7 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                    <span style={{ color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{name}</span>
                    <span style={{ fontWeight:600, color:'#7c3aed', flexShrink:0 }}>{count}</span>
                  </div>
                  <div style={{ height:4, background:'#f3f4f6', borderRadius:2 }}>
                    <div style={{ height:4, background:'#7c3aed', borderRadius:2, width:`${salesRows[0] ? (count/salesRows[0][1])*100 : 0}%`, transition:'width 0.5s' }} />
                  </div>
                </div>
              ))}
              {salesRows.length === 0 && <div style={{ color:'#9ca3af', fontSize:12 }}>Belum ada data</div>}
            </div>
          </div>

          {/* Recent quotations */}
          <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>Quotation Terbaru</div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>
                {tableQuotations.length}/{quotations.length} total
              </div>
            </div>
            {/* Search + Filter tabel */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <input
                placeholder="Cari customer atau produk..."
                value={tableSearch} onChange={e => setTableSearch(e.target.value)}
                style={{ flex:1, minWidth:160, height:32, padding:'0 10px', fontSize:12, borderRadius:6, border:'1px solid #e5e7eb', outline:'none' }}
              />
              <select value={tableDealFilter} onChange={e => setTableDealFilter(e.target.value)}
                style={{ height:32, padding:'0 8px', fontSize:12, borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', outline:'none' }}>
                <option value="">Semua Status</option>
                <option value="quoted">Quoted</option>
                <option value="followup">Followup</option>
                <option value="deal">Deal</option>
                <option value="cancel">Cancel</option>
              </select>
              <select value={tablePurchFilter} onChange={e => setTablePurchFilter(e.target.value)}
                style={{ height:32, padding:'0 8px', fontSize:12, borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', outline:'none' }}>
                <option value="">Semua Purchasing</option>
                <option value="none">Belum dikirim</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="hold">Hold</option>
              </select>
              <select value={tableSort} onChange={e => setTableSort(e.target.value)}
                style={{ height:32, padding:'0 8px', fontSize:12, borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', outline:'none' }}>
                <option value="date_desc">Terbaru</option>
                <option value="harga_desc">Harga Jual ↓</option>
                <option value="harga_asc">Harga Jual ↑</option>
                <option value="perunit_desc">Per Unit ↓</option>
                <option value="perunit_asc">Per Unit ↑</option>
              </select>
            </div>
            <div style={{ maxHeight:520, overflowY:'auto', border:'1px solid #f3f4f6', borderRadius:8 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Customer','Produk','Qty','Harga Jual','Per Unit','Status','Sumber','Sales','Purchasing','Tanggal',''].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:12, color:'#9ca3af', fontWeight:500, borderBottom:'2px solid #f3f4f6', position:'sticky', top:0, background:'#fff', zIndex:1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableQuotations.length === 0 && (
                    <tr><td colSpan={10} style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Tidak ada quotation yang cocok</td></tr>
                )}
                {tableQuotations.map(q => (
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
                    <td style={{ padding:'10px', fontSize:12, color:'#374151' }}>
                      {q.requests?.profiles?.full_name || '—'}
                    </td>
                    <td style={{ padding:'10px' }}>
                      {!q.purchasing_status ? (
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
                    <td style={{ padding:'10px' }}>
                      <button
                        onClick={() => setConfirmDelete({
                          id: q.id,
                          request_id: q.requests?.id,
                          customer: q.requests?.customer_name,
                          produk: q.requests?.product_type,
                        })}
                        style={{ background:'none', border:'1px solid #fecaca', borderRadius:6, padding:'3px 8px', fontSize:11, color:'#dc2626', cursor:'pointer' }}
                        title="Hapus quotation ini"
                      >Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {/* Modal konfirmasi hapus */}
      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:400, width:'90%', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:18, marginBottom:8 }}>🗑️</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#111', marginBottom:8 }}>Hapus Quotation?</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:6 }}>
              Kamu akan menghapus quotation milik:
            </div>
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#dc2626' }}>{confirmDelete.customer} — {confirmDelete.produk}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                Semua data quotation + perbandingan harga purchasing akan terhapus permanen.
              </div>
            </div>
            <div style={{ fontSize:12, color:'#dc2626', marginBottom:20, fontWeight:500 }}>
              ⚠️ Aksi ini tidak bisa dibatalkan.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding:'8px 16px', borderRadius:7, border:'1px solid #e5e7eb', background:'#fff', fontSize:13, cursor:'pointer' }}>
                Batal
              </button>
              <button onClick={() => handleDeleteQuotation(confirmDelete)}
                style={{ padding:'8px 16px', borderRadius:7, border:'none', background:'#dc2626', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}




