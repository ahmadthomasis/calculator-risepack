import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

// Mapping section key -> nilai pendek di CHECK constraint purchasing_comparisons
const SECTION_DB_MAP = {
  material_cost: 'material', cetak_cost: 'cetak', emboss_laminasi: 'emboss',
  material_proses: 'mat_proses', finishing_wo: 'finishing', additional_cost: 'additional',
}
// Reverse: nilai pendek DB -> section key (untuk load comparisons dari DB)
const DB_TO_KEY_MAP = Object.fromEntries(Object.entries(SECTION_DB_MAP).map(([k,v]) => [v,k]))

const fmt = n => Math.round(Number(n) || 0).toLocaleString('id-ID')
const idr = n => 'Rp ' + fmt(n)

// ── Definisi kolom per section ────────────────────────────────────────────
// Nama field (r.xxx) HARUS cocok dengan yang tersimpan di database,
// bukan nama kolom tabel. Sumber kebenaran: fungsi new*() di Calculator.jsx.
// Material  : id, nama, material, gsm, plano, plano_w, plano_h, harga_kg,
//             luas_permukaan, mata, plano_get, insheet, quantity,
//             harga_lembar, harga_per_pcs, subtotal
// Cetak     : id, nama, mesin, warna, quantity, luas_permukaan, insheet,
//             harga_per_lembar, subtotal
// Emboss    : id, nama, proses, quantity, luas_permukaan, insheet,
//             harga_per_cm2, subtotal
// Mat Proses: id, nama, proses, harga_satuan, quantity, luas_permukaan,
//             subtotal
// Finishing : id, nama, proses, spesifik, harga_satuan, subtotal
// Additional: id, nama, proses, keterangan, luas_permukaan, gramasi,
//             panjang_lem, quantity, harga, subtotal
const SECTION_COLS = {
  material_cost: [
    { label:'Nama',         align:'left',   render: r => r.nama || '—' },
    { label:'Material',     align:'left',   render: r => r.material || '—' },
    { label:'GSM',          align:'center', render: r => r.gsm || '—' },
    { label:'Plano',        align:'center', render: r => r.plano || '—' },
    { label:'Luas Perm.',   align:'center', render: r => r.luas_permukaan || '—' },
    { label:'Mata',         align:'center', render: r => r.mata ?? '—' },
    { label:'Plano Get',    align:'center', render: r => r.plano_get || '—' },
    { label:'Qty',          align:'right',  render: r => fmt(r.quantity) },
    { label:'Insheet',      align:'right',  render: r => fmt(r.insheet) },
    { label:'Harga/Lembar', align:'right',  render: r => idr(r.harga_lembar) },
    { label:'Harga/pcs',    align:'right',  render: r => idr(r.harga_per_pcs), priceField:'harga_per_pcs' },
    { label:'Diskon%',      align:'center', render: r => r.diskon ? `${r.diskon}%` : '0%' },
    { label:'Subtotal',     align:'right',  render: r => idr(r.subtotal) },
  ],
  cetak_cost: [
    { label:'Nama',           align:'left',   render: r => r.nama || '—' },
    { label:'Mesin',          align:'center', render: r => r.mesin || '—' },
    { label:'Warna',          align:'center', render: r => r.warna || '—' },
    { label:'Qty',            align:'right',  render: r => fmt(r.quantity) },
    { label:'Insheet',        align:'right',  render: r => fmt(r.insheet) },
    { label:'Luas Perm.',     align:'center', render: r => r.luas_permukaan || '—' },
    { label:'Harga/pcs',      align:'right',  render: r => idr(r.harga_per_pcs), priceField:'harga_per_pcs' },
    { label:'Diskon%',        align:'center', render: r => r.diskon ? `${r.diskon}%` : '0%' },
    { label:'Subtotal (×qty)',align:'right',  render: r => idr(r.subtotal) },
  ],
  emboss_laminasi: [
    { label:'Proses',       align:'left',   render: r => r.proses || '—' },
    { label:'Luas Perm.',   align:'center', render: r => r.luas_permukaan || '—' },
    { label:'Mata',         align:'center', render: r => r.mata || '—' },
    { label:'Qty',          align:'right',  render: r => fmt(r.quantity) },
    { label:'Harga/cm²',   align:'right',  render: r => `Rp ${(r.harga_per_cm2 || 0).toLocaleString('id-ID', { minimumFractionDigits:2, maximumFractionDigits:4 })}` },
    { label:'Harga/pcs',   align:'right',  render: r => idr(r.harga_per_pcs), priceField:'harga_per_pcs' },
    { label:'Diskon%',      align:'center', render: r => r.diskon ? `${r.diskon}%` : '0%' },
    { label:'Subtotal',     align:'right',  render: r => idr(r.subtotal) },
  ],
  material_proses: [
    { label:'Proses',       align:'left',   render: r => r.proses || '—' },
    { label:'Qty',          align:'right',  render: r => fmt(r.quantity) },
    { label:'Harga Satuan', align:'right',  render: r => idr(r.harga_satuan), priceField:'harga_satuan' },
    { label:'Diskon%',      align:'center', render: r => r.diskon ? `${r.diskon}%` : '0%' },
    { label:'Subtotal',     align:'right',  render: r => idr(r.subtotal) },
  ],
  finishing_wo: [
    { label:'Proses',       align:'left',   render: r => r.proses || '—' },
    { label:'Spesifik',     align:'left',   render: r => r.spesifik || '—' },
    { label:'Harga/pcs',   align:'right',  render: r => idr(r.harga_satuan), priceField:'harga_satuan' },
    { label:'Diskon%',      align:'center', render: r => r.diskon ? `${r.diskon}%` : '0%' },
    { label:'Subtotal (×qty)',align:'right',render: r => idr(r.subtotal) },
  ],
  additional_cost: [
    { label:'Nama',         align:'left',   render: r => r.nama || '—' },
    { label:'Proses',       align:'center', render: r => r.proses || '—' },
    { label:'Detail',       align:'left',   render: r => r.keterangan || '—' },
    { label:'Qty',          align:'right',  render: r => fmt(r.quantity) },
    { label:'Harga/pcs',   align:'right',  render: r => idr(r.harga), priceField:'harga' },
    { label:'Diskon%',      align:'center', render: r => r.diskon ? `${r.diskon}%` : '0%' },
    { label:'Subtotal',     align:'right',  render: r => idr(r.subtotal) },
  ],
}

// Kolom tambahan di sisi kanan (area Purchasing, dipisah garis biru)
const PURCH_COLS = [
  { label: 'Harga/pcs (Purchasing)', width: 130 },
  { label: 'Selisih', width: 70 },
]

const SECTIONS = [
  { key:'material_cost',   dbSection:'material',  label:'1. Material Cost' },
  { key:'cetak_cost',      dbSection:'cetak',     label:'2. Cetak Cost' },
  { key:'emboss_laminasi', dbSection:'emboss',    label:'3. Emboss / Laminasi' },
  { key:'material_proses', dbSection:'mat_proses',label:'4. Material Proses' },
  { key:'finishing_wo',    dbSection:'finishing', label:'5. Finishing WO' },
  { key:'additional_cost', dbSection:'additional',label:'6. Additional Cost' },
]

const STATUS_COLOR = { pending:'#854F0B', approved:'#3B6D11', hold:'#185FA5', cancelled:'#A32D2D' }
const STATUS_BG    = { pending:'#FAEEDA', approved:'#EAF3DE', hold:'#E6F1FB', cancelled:'#FCEBEB' }
const STATUS_LABEL = { pending:'Menunggu', approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }

export default function PurchasingReview() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [quotation,   setQuotation]   = useState(null)
  const [request,     setRequest]     = useState(null)
  const [comparisons, setComparisons] = useState({})
  const [notes,       setNotes]       = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [savingDraft,  setSavingDraft]  = useState(false)
  const [draftSaved,   setDraftSaved]   = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [dbAdditional,setDbAdditional]= useState([])

  useEffect(() => { loadAll() }, [quotationId])

  // Auto-refresh setiap 30 detik agar purchasing lain bisa lihat update terbaru
  useEffect(() => {
    const interval = setInterval(() => { loadAll() }, 30000)
    return () => clearInterval(interval)
  }, [quotationId])

  async function loadAll() {
    setLoading(true)
    let { data: q } = await supabase.from('quotations').select('*').eq('id', quotationId).maybeSingle()
    if (!q) { setLoading(false); return }

    // Kalau quotation ini sudah tidak aktif (estimator simpan ulang),
    // cari versi terbaru yang is_active=true untuk request+qty yang sama
    if (!q.is_active) {
      const { data: latest } = await supabase.from('quotations')
        .select('*')
        .eq('request_id', q.request_id)
        .eq('quantity', q.quantity)
        .eq('is_active', true)
        .eq('is_draft', false)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latest) q = latest
    }
    const { data: req } = await supabase.from('requests').select('*').eq('id', q.request_id).maybeSingle()
    const { data: comps } = await supabase.from('purchasing_comparisons').select('*').eq('quotation_id', quotationId)
    const { data: addlMaster } = await supabase.from('raw_materials').select('id,name,price,rate_per_kg,rate_a,rate_b,minimum_charge').eq('category','additional')

    const compMap = {}
    ;(comps || []).forEach(c => {
      const sectionKey = DB_TO_KEY_MAP[c.section] || c.section
      compMap[`${sectionKey}-${c.row_index}`] = c
    })

    setQuotation(q)
    setRequest(req)
    setComparisons(compMap)
    setDbAdditional(addlMaster || [])
    setNotes(q.purchasing_notes || '')
    setRevisionNote(q.revision_note || '')
    setLoading(false)
  }

  function updatePrice(sectionKey, rowIndex, value, estimatorPrice, itemName) {
    const key = `${sectionKey}-${rowIndex}`
    setComparisons(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        purchasing_price: value === '' ? null : Number(value),
        estimator_price: estimatorPrice,
        item_name: itemName,
      }
    }))
  }

  // Helper: hitung harga/pcs additional dari master data (untuk potong & lem samping
  // yang harganya bukan input manual tapi dihitung dari luas/gramasi/panjang)
  function resolveAdditionalHarga(r) {
    const num = v => parseFloat(String(v || '').replace(',', '.')) || 0
    const match = dbAdditional.find(m => m.name === r.proses)
    const qty = num(r.quantity)
    if (r.proses === 'potong' && match) {
      const parts = String(r.luas_permukaan || '').toLowerCase().split('x')
      const P = num(parts[0]), L = num(parts[1])
      const gramasi = num(r.gramasi)
      const total_kg = (P * L * gramasi) / 10000
      const biaya_total = total_kg * (match.rate_per_kg || 0)
      const subtotal_raw = Math.max(biaya_total, match.minimum_charge || 0)
      return qty > 0 ? subtotal_raw / qty : 0
    }
    if (r.proses === 'lem samping' && match) {
      const panjang = num(r.panjang_lem)
      const harga_per_pcs_calc = (panjang * (match.rate_a || 0)) + (match.rate_b || 0)
      const subtotal_calc = harga_per_pcs_calc * qty
      const subtotal_raw = Math.max(subtotal_calc, match.minimum_charge || 0)
      return qty > 0 ? subtotal_raw / qty : 0
    }
    // Proses manual: pakai harga yang tersimpan
    return num(r.harga)
  }

  // Hitung total harga purchasing per section (hanya baris yang sudah diisi)
  function sectionPurchTotal(sectionKey) {
    const rows = quotation?.[sectionKey]
    if (!Array.isArray(rows)) return null
    let total = 0, hasAny = false
    rows.forEach((_, i) => {
      const c = comparisons[`${sectionKey}-${i}`]
      if (c?.purchasing_price != null) {
        total += Number(c.purchasing_price)
        hasAny = true
      }
    })
    return hasAny ? total : null
  }

  // Total selisih kasar dari semua baris yang diisi (untuk header card summary)
  const filledComparisons = Object.values(comparisons).filter(c => c.purchasing_price != null && c.purchasing_price !== '')
  const hasAtLeastOnePrice = filledComparisons.length > 0
  const totalDiff = filledComparisons.reduce((sum, c) => sum + (Number(c.purchasing_price) - Number(c.estimator_price || 0)), 0)

  async function saveComparisons() {
    const rows = Object.entries(comparisons)
      .filter(([, c]) => c.purchasing_price != null && c.purchasing_price !== '')
      .map(([key, c]) => {
        const lastDash = key.lastIndexOf('-')
        const sectionKey = key.slice(0, lastDash)
        const rowIndex = Number(key.slice(lastDash + 1))
        return {
          quotation_id: quotationId,
          section: SECTION_DB_MAP[sectionKey] || sectionKey,
          row_index: rowIndex,
          item_name: c.item_name || null,
          estimator_price: c.estimator_price ?? null,
          purchasing_price: c.purchasing_price,
          updated_at: new Date().toISOString(),
        }
      })
    if (rows.length === 0) return true
    await supabase.from('purchasing_comparisons').delete().eq('quotation_id', quotationId)
    const { error } = await supabase.from('purchasing_comparisons').insert(rows)
    if (error) {
      console.error('Gagal simpan comparisons:', error)
      alert('Gagal menyimpan harga pembanding: ' + error.message)
      return false
    }
    return true
  }

  async function saveDraft() {
    setSavingDraft(true)
    const saved = await saveComparisons()
    if (saved) {
      // Simpan notes + revision request ke quotations
      await supabase.from('quotations').update({
        purchasing_notes: notes || null,
        revision_note: revisionNote || null,
        needs_revision: revisionNote ? true : false,
      }).eq('id', quotation.id)
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2500)
    }
    setSavingDraft(false)
  }

  async function decide(status) {
    if (!hasAtLeastOnePrice || !profile) return
    setSaving(true)
    const saved = await saveComparisons()
    if (!saved) { setSaving(false); return }
    const { error } = await supabase.from('quotations').update({
      purchasing_status: status,
      purchasing_notes: notes || null,
      purchasing_reviewed_at: new Date().toISOString(),
      purchasing_reviewed_by: profile.id,
    }).eq('id', quotationId)
    setSaving(false)
    if (error) { console.error('Gagal update status purchasing:', error); alert('Gagal menyimpan keputusan: ' + error.message); return }
    navigate('/purchasing')
  }

  if (loading) return <Layout title="Validasi"><div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Memuat…</div></Layout>
  if (!quotation) return <Layout title="Validasi"><div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Quotation tidak ditemukan.</div></Layout>

  const thEst = {
    padding:'7px 10px', fontSize:11, color:'#9ca3af', fontWeight:500,
    borderBottom:`0.5px solid ${C.border}`, background:'#fafaf9',
    textAlign:'center', whiteSpace:'nowrap',
  }
  const thPurch = {
    padding:'7px 10px', fontSize:11, fontWeight:500, whiteSpace:'nowrap',
    background:'#E6F1FB', color:'#0C447C', textAlign:'center',
    borderBottom:'2px solid #378ADD', borderLeft:'2px solid #378ADD',
  }
  const tdEst = {
    padding:'8px 10px', fontSize:12, color:C.dark,
    borderBottom:`0.5px solid ${C.border}`, whiteSpace:'nowrap',
  }
  const tdPurch = {
    padding:'8px 10px', fontSize:12,
    borderBottom:`0.5px solid ${C.border}`,
    background:'rgba(230,241,251,0.2)',
    borderLeft:'2px solid #378ADD',
    textAlign:'center',
  }

  return (
    <Layout title={`Validasi — ${request?.request_number || ''}`}>
      <button onClick={() => navigate('/purchasing')} style={{
        marginBottom:20, padding:'7px 14px', background:'transparent',
        border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13,
        fontWeight:500, cursor:'pointer', color:C.brown,
      }}>← Kembali ke Antrian</button>

      {/* Header Info */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderLeft:`4px solid ${C.orange}`, borderRadius:10, padding:'14px 18px', marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:10, fontSize:13 }}>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Customer</div><div style={{ fontWeight:500 }}>{quotation.customer_name}</div></div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Produk</div><div style={{ fontWeight:500 }}>{quotation.product_type}</div></div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Qty</div><div style={{ fontWeight:500 }}>{fmt(quotation.quantity)}</div></div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Sumber</div>
            {quotation.cost_source === 'vendor' ? (
              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#FAEEDA', color:'#633806' }} title={quotation.vendor_name || ''}>
                Vendor{quotation.vendor_name ? `: ${quotation.vendor_name}` : ''}
              </span>
            ) : (
              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#f1efe8', color:'#5f5e5a' }}>Internal</span>
            )}
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Harga Estimator</div>
            <div style={{ fontWeight:500 }}>{idr(quotation.selling_price)}</div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>≈ {idr(quotation.price_per_unit)} /pcs</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Selisih harga terisi</div>
            <div style={{ fontWeight:500, color: !hasAtLeastOnePrice ? '#9ca3af' : totalDiff > 0 ? '#A32D2D' : totalDiff < 0 ? '#3b6d11' : C.dark }}>
              {hasAtLeastOnePrice ? `${totalDiff > 0 ? '+' : ''}Rp ${fmt(totalDiff)}` : '—'}
            </div>
          </div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Dikirim</div><div style={{ fontWeight:500 }}>{quotation.sent_to_purchasing_at ? new Date(quotation.sent_to_purchasing_at).toLocaleDateString('id-ID') : '—'}</div></div>
        </div>
        {hasAtLeastOnePrice && (
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
            * Jumlah selisih harga satuan dari item yang sudah dibandingkan — bukan total harga jual, hanya indikator kasar arah selisih.
          </div>
        )}
      </div>

      {/* ── 6 SECTION TABEL DETAIL ── */}
      {SECTIONS.map(sec => {
        const rawRows = quotation[sec.key]
        if (!Array.isArray(rawRows) || rawRows.length === 0) return null

        // Untuk additional_cost: enrich setiap row dengan harga yang dihitung ulang
        // dari master data (potong & lem samping harganya computed, bukan input manual)
        const rows = sec.key === 'additional_cost'
          ? rawRows.map(r => ({ ...r, harga: resolveAdditionalHarga(r) }))
          : rawRows

        const cols = SECTION_COLS[sec.key] || []
        const priceCol = cols.find(c => c.isPrice)

        // Hitung subtotal estimator per section
        const estTotal = rows.reduce((sum, r) => sum + (Number(r.subtotal) || 0), 0)

        // Hitung rata-rata harga/pcs estimator per section
        const priceField = (SECTION_COLS[sec.key] || []).find(c => c.priceField)?.priceField
        const estPrices = rows.map(r => sec.key === 'additional_cost' ? resolveAdditionalHarga(r) : (Number(r[priceField]) || 0)).filter(v => v > 0)
        const estAvgPpc = estPrices.length > 0 ? estPrices.reduce((a,b) => a+b, 0) / estPrices.length : 0

        // Hitung rata-rata harga/pcs purchasing per section
        const filledPurchRows = rows.map((_, i) => comparisons[`${sec.key}-${i}`]).filter(c => c?.purchasing_price != null && c.purchasing_price !== '')
        const purchAvgPpc = filledPurchRows.length > 0 ? filledPurchRows.reduce((s, c) => s + Number(c.purchasing_price), 0) / filledPurchRows.length : null

        // Hitung subtotal purchasing yang sudah diisi per section
        const purchTotal = sectionPurchTotal(sec.key)
        const sectionDiffPct = (purchAvgPpc != null && estAvgPpc > 0)
          ? Math.round(((purchAvgPpc - estAvgPpc) / estAvgPpc) * 100)
          : null

        return (
          <div key={sec.key} style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:10, overflow:'hidden', marginBottom:16 }}>
            {/* Section header dengan summary selisih */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`0.5px solid ${C.border}`, background:'#fafaf9' }}>
              <span style={{ fontSize:13, fontWeight:500, color:C.dark }}>{sec.label}</span>
              <div style={{ display:'flex', gap:12, alignItems:'center', fontSize:12, flexWrap:'wrap' }}>
                <span style={{ color:'#9ca3af' }}>
                  Estimator: <span style={{ color:'#3B6D11', fontWeight:500 }}>{idr(estTotal)}</span>
                  {estAvgPpc > 0 && <span style={{ color:'#9ca3af', fontWeight:400 }}> · avg {idr(Math.round(estAvgPpc))}/pcs</span>}
                </span>
                {purchTotal != null ? (
                  <>
                    <span style={{ color:'#9ca3af' }}>
                      Purchasing: <span style={{ color:'#185FA5', fontWeight:500 }}>{idr(purchTotal)}</span>
                      {purchAvgPpc != null && <span style={{ color:'#9ca3af', fontWeight:400 }}> · avg {idr(Math.round(purchAvgPpc))}/pcs</span>}
                    </span>
                    {sectionDiffPct != null && (
                      <span style={{
                        padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                        background: sectionDiffPct < 0 ? '#EAF3DE' : sectionDiffPct > 0 ? '#FCEBEB' : '#f1efe8',
                        color: sectionDiffPct < 0 ? '#3B6D11' : sectionDiffPct > 0 ? '#A32D2D' : '#5f5e5a',
                      }}>
                        {sectionDiffPct > 0 ? '+' : ''}{sectionDiffPct}%
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color:'#9ca3af', fontStyle:'italic' }}>purchasing belum diisi</span>
                )}
              </div>
            </div>

            {/* Tabel dengan scroll horizontal (kolom banyak) */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', whiteSpace:'nowrap' }}>
                <thead>
                  <tr>
                    {/* Kolom data estimator */}
                    {cols.map((col, ci) => (
                      <th key={ci} style={{ ...thEst, textAlign: col.align }}>{col.label}</th>
                    ))}
                    {/* Kolom purchasing — garis pembatas biru */}
                    <th style={{ ...thPurch }}>
                      Harga/pcs<br />
                      <span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(Purchasing)</span>
                    </th>
                    <th style={{ ...thPurch, borderLeft:'none' }}>Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const key = `${sec.key}-${i}`
                    const comp = comparisons[key] || {}
                    const purchPrice = comp.purchasing_price
                    // Bandingkan vs kolom priceField (harga per pcs/satuan) dari estimator
                    const priceCol = cols.find(c => c.priceField)
                    // Untuk additional_cost, harga potong/lem samping dihitung ulang
                    // dari master data karena field harga di DB lama mungkin 0
                    const estPriceRaw = sec.key === 'additional_cost'
                      ? resolveAdditionalHarga(row)
                      : (priceCol ? (Number(row[priceCol.priceField]) || 0) : 0)
                    const diffPct = (purchPrice != null && Number(estPriceRaw) > 0)
                      ? Math.round(((purchPrice - Number(estPriceRaw)) / Number(estPriceRaw)) * 100)
                      : null

                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf9' }}>
                        {/* Kolom data estimator */}
                        {cols.map((col, ci) => (
                          <td key={ci} style={{ ...tdEst, textAlign: col.align }}>
                            {col.render(row)}
                          </td>
                        ))}
                        {/* Input harga purchasing */}
                        <td style={tdPurch}>
                          <input
                            type="number"
                            style={{
                              width:90, padding:'5px 8px', border:`1px solid ${purchPrice != null ? '#378ADD' : C.border}`,
                              borderRadius:6, fontSize:12, textAlign:'right',
                              background:'#fff', color:C.dark, outline:'none',
                            }}
                            placeholder="belum diisi"
                            value={purchPrice ?? ''}
                            onChange={e => updatePrice(
                              sec.key, i, e.target.value,
                              Number(estPriceRaw) || 0,
                              cols[0]?.render(row) || `Row ${i+1}`
                            )}
                          />
                        </td>
                        {/* Selisih % */}
                        <td style={{ ...tdPurch, borderLeft:'none', fontWeight:500, color: diffPct == null ? '#d1d5db' : diffPct > 0 ? '#A32D2D' : diffPct < 0 ? '#3b6d11' : C.dark }}>
                          {diffPct == null ? '—' : `${diffPct > 0 ? '+' : ''}${diffPct}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* ── Blok Perbandingan Vendor (opsional) ── */}
      {quotation.cost_source === 'vendor' && (
        <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:10, overflow:'hidden', marginBottom:16 }}>
          <div style={{ padding:'10px 14px', borderBottom:`0.5px solid ${C.border}`, background:'#fafaf9', fontSize:13, fontWeight:500, color:C.dark }}>
            Perbandingan Harga Vendor{quotation.vendor_name ? ` (${quotation.vendor_name})` : ''}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thEst, textAlign:'left' }}>Item</th>
                  <th style={{ ...thEst }}>Harga Vendor (per pcs)</th>
                  <th style={{ ...thPurch }}>Harga Purchasing<br /><span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(per pcs)</span></th>
                  <th style={{ ...thPurch, borderLeft:'none' }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const estPrice = Number(quotation.vendor_price_per_pcs) || 0
                  const key = 'vendor_total-0'
                  const comp = comparisons[key] || {}
                  const purchPrice = comp.purchasing_price
                  const diffPct = (purchPrice != null && estPrice > 0)
                    ? Math.round(((purchPrice - estPrice) / estPrice) * 100) : null
                  return (
                    <tr>
                      <td style={{ ...tdEst, textAlign:'left' }}>Harga per pcs dari vendor</td>
                      <td style={{ ...tdEst, textAlign:'right' }}>{idr(estPrice)}</td>
                      <td style={tdPurch}>
                        <input type="number" style={{ width:90, padding:'5px 8px', border:`1px solid ${purchPrice != null ? '#378ADD' : C.border}`, borderRadius:6, fontSize:12, textAlign:'right', background:'#fff', color:C.dark }} placeholder="belum diisi" value={purchPrice ?? ''}
                          onChange={e => updatePrice('vendor_total', 0, e.target.value, estPrice, 'Harga per pcs dari vendor')} />
                      </td>
                      <td style={{ ...tdPurch, borderLeft:'none', fontWeight:500, color: diffPct == null ? '#d1d5db' : diffPct > 0 ? '#A32D2D' : diffPct < 0 ? '#3b6d11' : C.dark }}>
                        {diffPct == null ? '—' : `${diffPct > 0 ? '+' : ''}${diffPct}%`}
                      </td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validasi minimum */}
      {!hasAtLeastOnePrice && (
        <div style={{ background:'#fffbeb', border:'0.5px solid #f3d98a', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginBottom:18 }}>
          Isi minimal 1 harga pembanding untuk mengaktifkan tombol keputusan di bawah
        </div>
      )}

      {/* Catatan */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:18 }}>
        <label style={{ fontSize:13, color:'#9ca3af', display:'block', marginBottom:6 }}>Catatan (opsional)</label>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Tulis catatan untuk Sales/Manager..."
          style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, resize:'vertical', boxSizing:'border-box', color:C.dark, outline:'none' }}
        />
      </div>

      {/* Box request revisi ke estimator */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:12 }}>
        <label style={{ fontSize:13, color:'#9ca3af', display:'block', marginBottom:6 }}>
          📋 Request Revisi ke Estimator <span style={{ fontSize:11, color:'#d1d5db' }}>(opsional)</span>
        </label>
        <textarea rows={2} value={revisionNote} onChange={e => setRevisionNote(e.target.value)}
          placeholder="Tulis item yang perlu ditambah/direvisi oleh estimator, cth: mohon tambahkan biaya QC Rp 50/pcs..."
          style={{ width:'100%', padding:'9px 12px', border:`1px solid ${revisionNote ? '#f59e0b' : C.border}`, borderRadius:7, fontSize:13, resize:'vertical', boxSizing:'border-box', color:C.dark, outline:'none' }}
        />
        {revisionNote && (
          <div style={{ fontSize:11, color:'#92400e', marginTop:4, background:'#fffbeb', padding:'4px 8px', borderRadius:5 }}>
            ⚠️ Estimator akan mendapat notifikasi untuk merevisi kalkulasi ini
          </div>
        )}
      </div>

      {/* Tombol Simpan Draft — bisa disimpan kapan saja tanpa keputusan final */}
      <div style={{ marginBottom:12 }}>
        <button onClick={saveDraft} disabled={savingDraft || !hasAtLeastOnePrice}
          style={{ width:'100%', padding:12, borderRadius:8, border:`1.5px solid ${hasAtLeastOnePrice ? '#2563eb' : '#d1d5db'}`, fontSize:14, fontWeight:500, cursor: hasAtLeastOnePrice && !savingDraft ? 'pointer' : 'not-allowed', background: hasAtLeastOnePrice ? '#eff6ff' : '#f9fafb', color: hasAtLeastOnePrice ? '#2563eb' : '#9ca3af' }}>
          {savingDraft ? 'Menyimpan...' : draftSaved ? '✓ Tersimpan' : '💾 Simpan Draft (tanpa keputusan akhir)'}
        </button>
        <div style={{ fontSize:11, color:'#9ca3af', textAlign:'center', marginTop:4 }}>
          Gunakan ini untuk simpan progress dan biarkan rekan melanjutkan validasi
        </div>
      </div>

      {/* Tombol keputusan */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <button disabled={!hasAtLeastOnePrice || saving} onClick={() => decide('approved')}
          style={{ padding:14, borderRadius:8, border:'none', fontSize:14, fontWeight:500, cursor: hasAtLeastOnePrice && !saving ? 'pointer' : 'not-allowed', background: hasAtLeastOnePrice ? '#3b6d11' : '#d1d5db', color:'#fff', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Menyimpan...' : 'Disetujui'}
        </button>
        <button disabled={!hasAtLeastOnePrice || saving} onClick={() => decide('hold')}
          style={{ padding:14, borderRadius:8, border:`2px solid ${hasAtLeastOnePrice ? C.orange : '#d1d5db'}`, fontSize:14, fontWeight:500, cursor: hasAtLeastOnePrice && !saving ? 'pointer' : 'not-allowed', background:'#fff', color: hasAtLeastOnePrice ? C.orange : '#d1d5db' }}>
          Hold
        </button>
        <button disabled={!hasAtLeastOnePrice || saving} onClick={() => decide('cancelled')}
          style={{ padding:14, borderRadius:8, border:`2px solid ${hasAtLeastOnePrice ? '#A32D2D' : '#d1d5db'}`, fontSize:14, fontWeight:500, cursor: hasAtLeastOnePrice && !saving ? 'pointer' : 'not-allowed', background:'#fff', color: hasAtLeastOnePrice ? '#A32D2D' : '#d1d5db' }}>
          Cancel
        </button>
      </div>
    </Layout>
  )
}


