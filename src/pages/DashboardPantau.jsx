import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const fmt = n => (n || 0).toLocaleString('id-ID')
const idr = n => 'Rp ' + fmt(Math.round(n || 0))

const COL_ERP = '#FEF9C3'      // kuning - dari ERP
const COL_HPP = '#DBEAFE'      // biru - HPP Sales (estimator)
const COL_COGS = '#FDEBD3'     // krem - COGS Proyeksi (purchasing)

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
  const [onlyGap, setOnlyGap] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      // Basis data = SEMUA order "Deal" di ERP (bukan cuma yang sudah diisi
      // di Calculator Risepack) - biar yang belum diisi kelihatan sebagai gap,
      // bukan malah hilang dari daftar.
      let erpRows = []
      for (let from = 0; ; from += 1000) {
        const { data, error: eErr } = await supabase
          .from('erp_orders').select('*')
          .eq('status_deal', 'Deal')
          .range(from, from + 999)
        if (eErr) throw eErr
        erpRows = erpRows.concat(data || [])
        if (!data || data.length < 1000) break
      }
      const erpBySko = Object.fromEntries(erpRows.map(r => [r.sko, r]))

      const { data: quotations, error: qErr } = await supabase
        .from('quotations')
        .select('id,request_id,kode_order,quantity,customer_name,product_type,total_cost,cost_source,vendor_price_per_pcs,deal_price_source,material_cost,cetak_cost,emboss_laminasi,material_proses,finishing_wo,additional_cost')
        .eq('deal_status', 'deal')
        .not('kode_order', 'is', null)
        .eq('is_active', true)
        .eq('is_draft', false)
      if (qErr) throw qErr

      const ids = (quotations || []).map(q => q.id)
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
      ;(quotations || []).forEach(q => {
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

      // Union: semua Kode Order dari ERP (Deal) + semua Kode Order yang sudah
      // diisi di Calculator Risepack (jaga-jaga kalau belum sempat ke-sync ERP).
      const allKeys = new Set([...Object.keys(erpBySko), ...Object.keys(grouped)])

      const result = [...allKeys].map(key => {
        const erp = erpBySko[key] || null
        const g = grouped[key] || null
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
          hppSales: g?.hppSales || 0,
          cogsProyeksi: g?.cogsProyeksi || 0,
          isVendor: g?.isVendor || false,
          erpFound: !!erp,
          quotationFound: !!g,
        }
      })

      // Filter: cuma yang sudah FAW (tgl_faw sudah terisi di ERP).
      const withFaw = result.filter(r => !!r.tgl_faw)

      // Sort by tanggal Order (terbaru dulu). Yang tidak punya tgl_order
      // ditaruh paling akhir.
      withFaw.sort((a, b) => {
        if (!a.tgl_order && !b.tgl_order) return 0
        if (!a.tgl_order) return 1
        if (!b.tgl_order) return -1
        return a.tgl_order < b.tgl_order ? 1 : a.tgl_order > b.tgl_order ? -1 : 0
      })
      setRows(withFaw)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!(r.kode_order || '').toLowerCase().includes(q) && !(r.nama_spk || '').toLowerCase().includes(q) && !(r.nama_produk || '').toLowerCase().includes(q)) return false
      }
      if (onlyGap) {
        const noHpp = !r.quotationFound
        const notValidated = r.quotationFound && !r.isVendor && r.cogsProyeksi === r.hppSales
        if (!noHpp && !notValidated) return false
      }
      return true
    })
  }, [rows, search, onlyGap])

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

        <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
          <input
            placeholder="Cari Kode Order, customer, atau produk..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:1, padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:'none' }}
          />
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:C.brown, cursor:'pointer', whiteSpace:'nowrap' }}>
            <input type="checkbox" checked={onlyGap} onChange={e => setOnlyGap(e.target.checked)} />
            Tampilkan yang belum lengkap saja
          </label>
          <button onClick={fetchAll} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:C.orange, color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            🔄 Refresh
          </button>
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
                    const noHpp = !r.quotationFound
                    const notValidated = r.quotationFound && !r.isVendor && r.cogsProyeksi === r.hppSales
                    return (
                      <tr key={r.kode_order}>
                        <td style={{ ...s.td, color: r.pic ? C.dark : '#d1d5db' }}>{r.pic || '—'}</td>
                        <td style={{ ...s.td, fontFamily:'monospace', fontSize:12 }}>{r.kode_order}</td>
                        <td style={s.td}>{r.nama_spk || '—'}</td>
                        <td style={s.td}>{r.nama_produk || '—'}</td>
                        <td style={{ ...s.td, textAlign:'right' }}>{fmt(r.jumlah_produk)}</td>
                        <td style={{ ...s.td, color: r.jenis_bahan ? C.dark : '#d1d5db' }}>{r.jenis_bahan || '—'}</td>
                        <td style={{ ...s.td, color: r.tgl_order ? C.dark : '#d1d5db' }}>{r.tgl_order ? new Date(r.tgl_order).toLocaleDateString('id-ID') : '—'}</td>
                        <td style={{ ...s.td, color: r.tgl_faw ? C.dark : '#d1d5db' }}>{r.tgl_faw ? new Date(r.tgl_faw).toLocaleDateString('id-ID') : '—'}</td>
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
                          ) : noHpp ? (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#fef2f2', color:'#dc2626' }}>⚠️ Belum diisi Estimator</span>
                          ) : r.isVendor ? (
                            <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500, background:'#f1efe8', color:'#5f5e5a' }}>Vendor</span>
                          ) : notValidated ? (
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
