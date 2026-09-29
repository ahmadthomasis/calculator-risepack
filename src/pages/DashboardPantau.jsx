import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const fmt = n => (n || 0).toLocaleString('id-ID')
const idr = n => 'Rp ' + fmt(Math.round(n || 0))
// Format tanggal "1 Jun 2026" (bukan "1/6/2026")
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : null

const COL_ERP = '#FEF9C3'      // kuning - dari ERP
const COL_HPP = '#DBEAFE'      // biru - HPP Sales (estimator)
const COL_COGS = '#FDEBD3'     // krem - COGS Proyeksi (purchasing)

// Order dengan Tanggal FAW sebelum tanggal ini tidak perlu dipantau lagi -
// dibuang dari query supaya data yang ditarik & ditabelkan lebih ringan.
const FAW_CUTOFF = '2026-09-20'

// Status Pengisian: gap yang perlu dikejar. Kosong (tidak ada yang dicentang) = tampilkan semua.
const PENGISIAN_OPTIONS = [
  { key:'no_estimator', label:'Belum diisi Estimator' },
  { key:'no_purchasing', label:'Belum divalidasi Purchasing' },
]
// Status Pengerjaan: sumber harga deal-nya. Kosong = tampilkan semua.
const PENGERJAAN_OPTIONS = [
  { key:'vendor', label:'Vendor' },
  { key:'workshop', label:'Workshop' },
]

const s = {
  th: { padding:'8px 10px', fontSize:11, fontWeight:600, textAlign:'left', whiteSpace:'nowrap', borderBottom:`1px solid ${C.border}` },
  td: { padding:'8px 10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, whiteSpace:'nowrap' },
}

// Total harga purchasing dengan fallback ke subtotal estimator (item yang
// belum divalidasi purchasing) - sama persis dengan logika di PurchasingReview.jsx
function purchasingTotalWithFallback(quotation, compMap) {
  const SECTIONS = ['material_cost', 'cetak_cost', 'emboss_laminasi', 'material_proses', 'finishing_wo', 'additional_cost']
  let total = 0
  SECTIONS.forEach(secKey => {
    const rows = Array.isArray(quotation[secKey]) ? quotation[secKey] : []
    rows.forEach((row, i) => {
      const comp = compMap[`${quotation.id}|${secKey}|${i}`]
      const qty = Number(row.quantity || quotation.quantity || 0)
      if (comp?.purchasing_price != null) total += Number(comp.purchasing_price) * qty
      else total += Number(row.subtotal || 0)
    })
  })
  return total
}

export default function DashboardPantau() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [pengisianFilter, setPengisianFilter] = useState(() => new Set())
  const [pengerjaanFilter, setPengerjaanFilter] = useState(() => new Set())
  const [picFilter, setPicFilter] = useState('all')
  const [tglOrderFrom, setTglOrderFrom] = useState('')
  const [tglOrderTo, setTglOrderTo] = useState('')
  const [tglFawFrom, setTglFawFrom] = useState('')
  const [tglFawTo, setTglFawTo] = useState('')

  function toggleInSet(setter, key) {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      // Basis data = SEMUA order "Deal" di ERP dengan Tanggal FAW >= FAW_CUTOFF
      // (bukan cuma yang sudah diisi di Calculator Risepack) - biar yang belum
      // diisi kelihatan sebagai gap, bukan malah hilang dari daftar. Order FAW
      // lama dibuang di level query biar data yang ditarik lebih ringan.
      let erpRows = []
      for (let from = 0; ; from += 1000) {
        const { data, error: eErr } = await supabase
          .from('erp_orders').select('*')
          .eq('status_deal', 'Deal')
          .gte('tgl_faw', FAW_CUTOFF)
          .range(from, from + 999)
        if (eErr) throw eErr
        erpRows = erpRows.concat(data || [])
        if (!data || data.length < 1000) break
      }
      const erpBySko = Object.fromEntries(erpRows.map(r => [r.sko, r]))
      const skoList = Object.keys(erpBySko)

      // Cuma tarik quotations buat Kode Order yang lolos filter FAW di atas.
      let quotations = []
      for (let i = 0; i < skoList.length; i += 50) {
        const chunk = skoList.slice(i, i + 50)
        if (chunk.length === 0) continue
        const { data, error: qErr } = await supabase
          .from('quotations')
          .select('id,request_id,kode_order,quantity,customer_name,product_type,total_cost,cost_source,vendor_price_per_pcs,deal_price_source,material_cost,cetak_cost,emboss_laminasi,material_proses,finishing_wo,additional_cost')
          .in('kode_order', chunk)
          .eq('deal_status', 'deal')
          .eq('is_active', true)
          .eq('is_draft', false)
        if (qErr) throw qErr
        quotations = quotations.concat(data || [])
      }

      const ids = quotations.map(q => q.id)
      let comparisons = []
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50)
        if (chunk.length === 0) continue
        const { data, error: cErr } = await supabase.from('purchasing_comparisons').select('*').in('quotation_id', chunk)
        if (cErr) throw cErr
        comparisons = comparisons.concat(data || [])
      }
      const compMap = {}
      comparisons.forEach(c => { compMap[`${c.quotation_id}|${c.section}|${c.row_index}`] = c })

      // Gabung per Kode Order (bisa lebih dari 1 quotation per kode order kalau
      // sales tambah produk lain di request yang sama).
      const grouped = {}
      quotations.forEach(q => {
        const key = q.kode_order
        if (!grouped[key]) grouped[key] = { kode_order: key, quotations: [], hppSales: 0, cogsProyeksi: 0 }
        const isVendor = q.deal_price_source === 'vendor'
        const vendorTotal = (Number(q.vendor_price_per_pcs) || 0) * (Number(q.quantity) || 0)
        const hpp = isVendor ? vendorTotal : (Number(q.total_cost) || 0)
        const cogs = isVendor ? vendorTotal : purchasingTotalWithFallback(q, compMap)
        grouped[key].quotations.push(q)
        grouped[key].hppSales += hpp
        grouped[key].cogsProyeksi += cogs
        grouped[key].isVendor = grouped[key].isVendor || isVendor
      })

      const result = skoList.map(key => {
        const erp = erpBySko[key] || null
        const g = grouped[key] || null
        const isVendor = g?.isVendor || false
        const hppSales = g?.hppSales || 0
        const cogsProyeksi = g?.cogsProyeksi || 0
        const noHpp = !g
        const notValidated = !!g && !isVendor && cogsProyeksi === hppSales
        const status = noHpp ? 'no_estimator' : isVendor ? 'vendor' : notValidated ? 'no_purchasing' : 'complete'
        // Pengerjaan: Vendor kalau sumber harga deal-nya vendor, selain itu
        // Workshop (termasuk yang belum diisi Estimator - defaultnya internal).
        const pengerjaan = isVendor ? 'vendor' : 'workshop'
        return {
          kode_order: key,
          pic: erp?.sales_name || null,
          nama_spk: erp?.nama_customer || g?.quotations[0]?.customer_name || null,
          nama_produk: erp?.nama_produk || g?.quotations.map(q => q.product_type).join(', ') || null,
          jumlah_produk: erp?.jumlah_produk ?? (g ? g.quotations.reduce((s, q) => s + (Number(q.quantity) || 0), 0) : null),
          tgl_order: erp?.tgl_order || null,
          tgl_faw: erp?.tgl_faw || null,
          jenis_bahan: erp?.jenis_bahan || null,
          modal_sales: erp?.modal_sales ?? null,
          hppSales,
          cogsProyeksi,
          isVendor,
          erpFound: !!erp,
          quotationFound: !!g,
          status,
          isNoEstimator: noHpp,
          isNoPurchasing: notValidated,
          pengerjaan,
        }
      })

      // Sort by tanggal Order (terbaru dulu). Yang tidak punya tgl_order
      // ditaruh paling akhir.
      result.sort((a, b) => {
        if (!a.tgl_order && !b.tgl_order) return 0
        if (!a.tgl_order) return 1
        if (!b.tgl_order) return -1
        return a.tgl_order < b.tgl_order ? 1 : a.tgl_order > b.tgl_order ? -1 : 0
      })
      setRows(result)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const picOptions = useMemo(() => {
    return [...new Set(rows.map(r => r.pic).filter(Boolean))].sort()
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!(r.kode_order || '').toLowerCase().includes(q) && !(r.nama_spk || '').toLowerCase().includes(q) && !(r.nama_produk || '').toLowerCase().includes(q)) return false
      }
      if (pengisianFilter.size > 0) {
        const match = (pengisianFilter.has('no_estimator') && r.isNoEstimator) || (pengisianFilter.has('no_purchasing') && r.isNoPurchasing)
        if (!match) return false
      }
      if (pengerjaanFilter.size > 0 && !pengerjaanFilter.has(r.pengerjaan)) return false
      if (picFilter !== 'all' && r.pic !== picFilter) return false
      if (tglOrderFrom && (!r.tgl_order || r.tgl_order < tglOrderFrom)) return false
      if (tglOrderTo && (!r.tgl_order || r.tgl_order > tglOrderTo)) return false
      if (tglFawFrom && (!r.tgl_faw || r.tgl_faw < tglFawFrom)) return false
      if (tglFawTo && (!r.tgl_faw || r.tgl_faw > tglFawTo)) return false
      return true
    })
  }, [rows, search, pengisianFilter, pengerjaanFilter, picFilter, tglOrderFrom, tglOrderTo, tglFawFrom, tglFawTo])

  return (
    <Layout title="Dashboard Pantau">
      <div style={{ maxWidth:1300, margin:'0 auto' }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:4 }}>Dashboard Pantau</h2>
          <p style={{ fontSize:13, color:'#9ca3af' }}>
            Konsumen Deal + Kode Order — data ERP (kuning) digabung dengan Total HPP Sales (biru, dari Estimator)
            dan Total COGS Proyeksi (krem, dari Purchasing). Dipakai buat cek mana yang belum diisi.
          </p>
        </div>

        <div style={{ display:'flex', gap:12, marginBottom:12, alignItems:'center' }}>
          <input
            placeholder="Cari Kode Order, customer, atau produk..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:1, padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:'none' }}
          />
          <button onClick={fetchAll} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:C.orange, color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
            🔄 Refresh
          </button>
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'flex-end', marginBottom:16, padding:'12px 14px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:10 }}>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Status Pengisian</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {PENGISIAN_OPTIONS.map(opt => (
                <label key={opt.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, color:C.brown, cursor:'pointer', whiteSpace:'nowrap' }}>
                  <input type="checkbox" checked={pengisianFilter.has(opt.key)} onChange={() => toggleInSet(setPengisianFilter, opt.key)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Status Pengerjaan</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {PENGERJAAN_OPTIONS.map(opt => (
                <label key={opt.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, color:C.brown, cursor:'pointer', whiteSpace:'nowrap' }}>
                  <input type="checkbox" checked={pengerjaanFilter.has(opt.key)} onChange={() => toggleInSet(setPengerjaanFilter, opt.key)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>PIC</div>
            <select value={picFilter} onChange={e => setPicFilter(e.target.value)}
              style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:'none', background:'#fff' }}>
              <option value="all">Semua PIC</option>
              {picOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Tanggal Order</div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="date" value={tglOrderFrom} onChange={e => setTglOrderFrom(e.target.value)}
                style={{ padding:'6px 8px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12.5, outline:'none' }} />
              <span style={{ color:'#9ca3af', fontSize:12 }}>s/d</span>
              <input type="date" value={tglOrderTo} onChange={e => setTglOrderTo(e.target.value)}
                style={{ padding:'6px 8px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12.5, outline:'none' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Tanggal FAW</div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="date" value={tglFawFrom} onChange={e => setTglFawFrom(e.target.value)}
                style={{ padding:'6px 8px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12.5, outline:'none' }} />
              <span style={{ color:'#9ca3af', fontSize:12 }}>s/d</span>
              <input type="date" value={tglFawTo} onChange={e => setTglFawTo(e.target.value)}
                style={{ padding:'6px 8px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12.5, outline:'none' }} />
            </div>
          </div>
          {(picFilter !== 'all' || tglOrderFrom || tglOrderTo || tglFawFrom || tglFawTo || pengisianFilter.size > 0 || pengerjaanFilter.size > 0) && (
            <button
              onClick={() => { setPicFilter('all'); setTglOrderFrom(''); setTglOrderTo(''); setTglFawFrom(''); setTglFawTo(''); setPengisianFilter(new Set()); setPengerjaanFilter(new Set()) }}
              style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.brown, fontSize:12, cursor:'pointer' }}>
              ✕ Reset Filter
            </button>
          )}
        </div>

        <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Memuat data...</div>
          ) : error ? (
            <div style={{ padding:40, textAlign:'center', color:'#dc2626' }}>Gagal memuat: {error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Tidak ada data yang cocok.</div>
          ) : (
            <div style={{ maxHeight:640, overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>PIC</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>Kode Order</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>Nama SPK</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>Nama Produk</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1, textAlign:'right' }}>Jumlah Produk</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>Jenis Bahan</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>Tanggal Order</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1 }}>Tanggal FAW</th>
                    <th style={{ ...s.th, background:COL_ERP, position:'sticky', top:0, zIndex:1, textAlign:'right' }}>Modal Sales</th>
                    <th style={{ ...s.th, background:COL_HPP, position:'sticky', top:0, zIndex:1, textAlign:'right' }}>Total HPP Sales/Estimator</th>
                    <th style={{ ...s.th, background:COL_COGS, position:'sticky', top:0, zIndex:1, textAlign:'right' }}>Total COGS Proyeksi</th>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const noHpp = r.status === 'no_estimator'
                    return (
                      <tr key={r.kode_order}>
                        <td style={{ ...s.td, color: r.pic ? C.dark : '#d1d5db' }}>{r.pic || '—'}</td>
                        <td style={{ ...s.td, fontFamily:'monospace', fontSize:12 }}>{r.kode_order}</td>
                        <td style={s.td}>{r.nama_spk || '—'}</td>
                        <td style={s.td}>{r.nama_produk || '—'}</td>
                        <td style={{ ...s.td, textAlign:'right' }}>{fmt(r.jumlah_produk)}</td>
                        <td style={{ ...s.td, color: r.jenis_bahan ? C.dark : '#d1d5db' }}>{r.jenis_bahan || '—'}</td>
                        <td style={{ ...s.td, color: r.tgl_order ? C.dark : '#d1d5db' }}>{fmtDate(r.tgl_order) || '—'}</td>
                        <td style={{ ...s.td, color: r.tgl_faw ? C.dark : '#d1d5db' }}>{fmtDate(r.tgl_faw) || '—'}</td>
                        <td style={{ ...s.td, textAlign:'right', color: r.modal_sales != null ? C.dark : '#d1d5db' }}>{r.modal_sales != null ? idr(r.modal_sales) : '—'}</td>
                        <td style={{ ...s.td, textAlign:'right', fontWeight:500, color: noHpp ? '#dc2626' : C.dark }}>
                          {noHpp ? 'Belum diisi' : idr(r.hppSales)}
                        </td>
                        <td style={{ ...s.td, textAlign:'right', fontWeight:500, color: noHpp ? '#dc2626' : r.isVendor ? '#9ca3af' : C.dark }}>
                          {noHpp ? 'Belum diisi' : r.isVendor ? <span title="Deal pakai harga vendor, COGS Proyeksi = HPP Sales">{idr(r.cogsProyeksi)}</span> : idr(r.cogsProyeksi)}
                        </td>
                        <td style={s.td}>
                          {!r.erpFound ? (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#fef2f2', color:'#dc2626' }}>Data ERP belum ada</span>
                          ) : r.status === 'no_estimator' ? (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#fef2f2', color:'#dc2626' }}>⚠️ Belum diisi Estimator</span>
                          ) : r.status === 'vendor' ? (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#f1efe8', color:'#5f5e5a' }}>Vendor</span>
                          ) : r.status === 'no_purchasing' ? (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#fffbeb', color:'#92400e' }}>⚠️ Belum divalidasi Purchasing</span>
                          ) : (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#EAF3DE', color:'#3B6D11' }}>✓ Lengkap</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize:12, color:'#9ca3af', marginTop:12 }}>
          Menampilkan {filtered.length} dari {rows.length} Kode Order (status Deal).
        </p>
      </div>
    </Layout>
  )
}
