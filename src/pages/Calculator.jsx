import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import SalinOrderLama from '../components/SalinOrderLama'

const fmt  = n => (n || 0).toLocaleString('id-ID')
const num  = v => parseFloat(v) || 0
const idr  = n => 'Rp ' + fmt(Math.round(n))

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const PLANO_OPTIONS = ['79x109','65x100','90x120','90x100','77x66','75x100','70x100','120x200','custom']
const WARNA_OPTIONS = ['1 warna','2 warna','4 warna','4 warna + 1 spesial','5 warna']
const ADDITIONAL_PROSES = ['transport','film','potong','BBL','packing','jendela mika','mika','lem samping']

const s = {
  card:   { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  sTitle: { fontSize:15, fontWeight:600, color:C.dark, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' },
  input:  { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', color:C.dark, textAlign:'center' },
  select: { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', background:'#fff', width:'100%', boxSizing:'border-box', color:C.dark, textAlign:'center' },
  th:     { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:500, textAlign:'center', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:     { padding:'5px 5px', verticalAlign:'middle', textAlign:'center', display:'table-cell' },
  calc:   { padding:'7px 10px', background:C.cream, border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, color:C.dark, textAlign:'center', minWidth:80 },
  calcGreen: { padding:'7px 10px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:6, fontSize:13, color:'#16a34a', fontWeight:600, textAlign:'center', minWidth:90 },
  addBtn: { padding:'6px 14px', background:'#fff7ed', color:C.orange, border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:500 },
  delBtn: { padding:'4px 8px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, fontSize:11, cursor:'pointer' },
  saveBtn:{ padding:'12px 28px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer' },
}

// ── Row factories ─────────────────────────────────────────────
// ── Tabel P11 Corrugated (harga Rp/m², sudah include PPN 11%) ─────────────
const P11_SUBSTANCES = ['M125','K125','K150','K200','K275','WK150','WK200']
const P11_FLUTES = ['E Flute','B Flute','C Flute','DW']

const P11_TABLE = {
  // [substance_outer, substance_mid, substance_inner]: { 'E Flute': x, 'B Flute': x, ... }
  'M125-M125-M125': { 'E Flute':4524, 'B Flute':4322, 'C Flute':4420, 'DW':7318 },
  'K125-M125-M125': { 'E Flute':4652, 'B Flute':4450, 'C Flute':4549, 'DW':7446 },
  'K125-M125-K125': { 'E Flute':4780, 'B Flute':4578, 'C Flute':4677, 'DW':7575 },
  'K150-M125-M125': { 'E Flute':4875, 'B Flute':4673, 'C Flute':4772, 'DW':7669 },
  'K150-M125-K125': { 'E Flute':5003, 'B Flute':4801, 'C Flute':4900, 'DW':7798 },
  'K150-M125-K150': { 'E Flute':5226, 'B Flute':5024, 'C Flute':5123, 'DW':8020 },
  'K200-M125-M125': { 'E Flute':5518, 'B Flute':5316, 'C Flute':5418, 'DW':8427 },
  'K200-M125-K125': { 'E Flute':5651, 'B Flute':5449, 'C Flute':5551, 'DW':8560 },
  'K200-M125-K150': { 'E Flute':5882, 'B Flute':5680, 'C Flute':5783, 'DW':8792 },
  'K200-M125-K200': { 'E Flute':6345, 'B Flute':6143, 'C Flute':6245, 'DW':9254 },
  'K275-M125-M125': { 'E Flute':6789, 'B Flute':6587, 'C Flute':6694, 'DW':9814 },
  'K275-M125-K125': { 'E Flute':6928, 'B Flute':6727, 'C Flute':6833, 'DW':9953 },
  'K275-M125-K150': { 'E Flute':7168, 'B Flute':6966, 'C Flute':7073, 'DW':10193 },
  'K275-M125-K200': { 'E Flute':7648, 'B Flute':7446, 'C Flute':7552, 'DW':10673 },
  'K275-M125-K275': { 'E Flute':9027, 'B Flute':8826, 'C Flute':8936, 'DW':12168 },
  'WK150-M125-M125': { 'E Flute':5402, 'B Flute':5200, 'C Flute':5302, 'DW':8311 },
  'WK150-M125-K125': { 'E Flute':5535, 'B Flute':5333, 'C Flute':5436, 'DW':8445 },
  'WK150-M125-K150': { 'E Flute':5767, 'B Flute':5565, 'C Flute':5667, 'DW':8676 },
  'WK150-M125-K200': { 'E Flute':6229, 'B Flute':6027, 'C Flute':6130, 'DW':9139 },
  'WK150-M125-WK150': { 'E Flute':6552, 'B Flute':6350, 'C Flute':6460, 'DW':9692 },
  'WK150-M125-K275': { 'E Flute':7528, 'B Flute':7326, 'C Flute':7432, 'DW':10553 },
  'WK200-M125-M125': { 'E Flute':5980, 'B Flute':5778, 'C Flute':5881, 'DW':8890 },
  'WK200-M125-K125': { 'E Flute':6114, 'B Flute':5912, 'C Flute':6014, 'DW':9023 },
  'WK200-M125-K150': { 'E Flute':6345, 'B Flute':6143, 'C Flute':6245, 'DW':9254 },
  'WK200-M125-K200': { 'E Flute':6808, 'B Flute':6607, 'C Flute':6708, 'DW':9718 },
  'WK200-M125-K275': { 'E Flute':8128, 'B Flute':7926, 'C Flute':8032, 'DW':11153 },
  'WK200-M125-WK150': { 'E Flute':7173, 'B Flute':6971, 'C Flute':7081, 'DW':10313 },
  'WK200-M125-WK200': { 'E Flute':7794, 'B Flute':7592, 'C Flute':7702, 'DW':10985 },
}

function getP11Price(outer, flute) {
  // Key: outer-M125-outer (karena mid selalu M125 di tabel)
  const key = `${outer}-M125-${outer}`
  const row = P11_TABLE[key]
  return row ? (row[flute] || 0) : 0
}

function lookupP11(substance_key, flute) {
  const row = P11_TABLE[substance_key]
  return row ? (row[flute] || 0) : 0
}

const newMaterial  = () => ({ id:Date.now(), nama:'', material:'', gsm:'', plano:'79x109', plano_w:'', plano_h:'', harga_kg:0, luas_permukaan:'', mata:1, plano_get:'', insheet:'', quantity:0, harga_lembar:0, harga_per_pcs:0, is_corrugated:false, corr_substance:'K150-M125-K150', corr_flute:'B Flute', corr_p_mm:'', corr_l_mm:'' })
const newCetak     = () => ({ id:Date.now(), nama:'', mesin:'SM 74', warna:'4 warna', quantity:0, luas_permukaan:'', insheet:0, harga_per_lembar:0 })
const newEmboss    = () => ({ id:Date.now(), nama:'', proses:'Laminasi Doff', quantity:0, luas_permukaan:'', insheet:0, harga_per_cm2:0, mata:0 })
const newMatProses = () => ({ id:Date.now(), nama:'', proses:'', harga_satuan:0, quantity:1, luas_permukaan:'' })
const newFinishing = () => ({ id:Date.now(), nama:'', proses:'', spesifik:'', harga_satuan:0 })
// ── Pencocokan ulang harga purchasing saat estimator simpan ulang ─────────
//
// Tabel purchasing_comparisons menyimpan harga purchasing per (section,
// row_index). row_index = POSISI baris, bukan identitas item. Jadi kalau
// estimator menambah/menghapus item, posisi bergeser dan harga purchasing
// nempel ke item lain. Ini TIDAK menimbulkan error -- cuma angka yang salah.
//
// Supaya tidak bergantung pada posisi, setiap baris lama dicocokkan ke baris
// baru lewat tiga lapis, dari yang paling kuat:
//   1. row.id    -- id internal baris, ikut tersimpan di JSONB dan tetap sama
//                   selama estimator tidak menghapus lalu membuat baris baru.
//   2. tanda tangan isi -- gabungan kolom pengenal per section (nama,
//                   material, mesin, proses, ...), dinormalkan.
//   3. tidak cocok -> harga purchasing untuk baris itu DIBUANG. Lebih baik
//                   purchasing mengisi ulang satu baris daripada diam-diam
//                   memakai harga item lain.
const CMP_PRIMARY_FIELD = {
  material: 'nama', cetak: 'nama', emboss: 'proses',
  mat_proses: 'proses', finishing: 'proses', additional: 'nama',
}

function cmpRowSignature(section, r) {
  if (!r) return ''
  const p = v => String(v ?? '').trim().toLowerCase()
  const parts =
    section === 'material'   ? [p(r.nama), p(r.material), p(r.gsm), p(r.plano)] :
    section === 'cetak'      ? [p(r.nama), p(r.mesin), p(r.warna)] :
    section === 'emboss'     ? [p(r.nama), p(r.proses)] :
    section === 'mat_proses' ? [p(r.nama), p(r.proses)] :
    section === 'finishing'  ? [p(r.nama), p(r.proses), p(r.spesifik)] :
    section === 'additional' ? [p(r.nama), p(r.proses), p(r.keterangan)] :
    []
  // Kalau semua kolom pengenal kosong, tanda tangannya dianggap tidak ada
  // supaya baris kosong tidak saling cocok sembarangan.
  return parts.some(x => x !== '') ? parts.join('|') : ''
}

// Hasil: Map oldRowIndex -> newRowIndex. Satu baris baru hanya boleh dipakai
// satu kali, jadi item kembar tidak menumpuk di satu baris.
function cmpBuildIndexMap(section, oldRows, newRows) {
  const map = new Map()
  const usedNew = new Set()
  const pass = keyOf => {
    oldRows.forEach((oldRow, oi) => {
      if (map.has(oi)) return
      const key = keyOf(oldRow)
      if (!key) return
      for (let ni = 0; ni < newRows.length; ni++) {
        if (usedNew.has(ni)) continue
        if (keyOf(newRows[ni]) === key) { map.set(oi, ni); usedNew.add(ni); break }
      }
    })
  }
  pass(r => (r && r.id != null && r.id !== '') ? `id:${r.id}` : '')
  pass(r => cmpRowSignature(section, r))
  return map
}

export function remapComparisons(oldComps, oldQuot, newRowsBySection, newQuotationId) {
  const oldRowsBySection = {
    material:   oldQuot?.material_cost,
    cetak:      oldQuot?.cetak_cost,
    emboss:     oldQuot?.emboss_laminasi,
    mat_proses: oldQuot?.material_proses,
    finishing:  oldQuot?.finishing_wo,
    additional: oldQuot?.additional_cost,
  }

  const maps = {}
  Object.keys(oldRowsBySection).forEach(section => {
    const oldRows = oldRowsBySection[section]
    const newRows = newRowsBySection[section]
    if (!Array.isArray(oldRows) || !Array.isArray(newRows)) { maps[section] = null; return }
    maps[section] = cmpBuildIndexMap(section, oldRows, newRows)
  })

  const kept = []
  const dropped = []
  oldComps.forEach(({ id: _id, quotation_id: _qid, ...rest }) => {
    const map = maps[rest.section]
    // maps[section] === null berarti kita tidak punya data baris lama/baru
    // untuk section itu. Daripada membuang harga purchasing, pertahankan
    // posisi apa adanya seperti perilaku lama.
    const newIndex = map ? map.get(rest.row_index) : rest.row_index
    if (newIndex == null) {
      dropped.push({ section: rest.section, row_index: rest.row_index, item_name: rest.item_name })
      return
    }
    const newRow = (newRowsBySection[rest.section] || [])[newIndex]
    const primary = newRow ? newRow[CMP_PRIMARY_FIELD[rest.section] || 'nama'] : null
    kept.push({
      ...rest,
      quotation_id: newQuotationId,
      row_index: newIndex,
      // Nama item disegarkan dari baris yang baru supaya laporan purchasing
      // tidak menampilkan nama lama kalau estimator sempat menggantinya.
      item_name: (primary && String(primary).trim()) ? String(primary).trim() : rest.item_name,
    })
  })
  return { kept, dropped }
}

const newAdditional= () => ({ id:Date.now(), nama:'', proses:'', keterangan:'', luas_permukaan:'', gramasi:'', panjang_lem:'', quantity:0, harga:0 })

export default function Calculator() {
  const { requestId } = useParams()
  const { profile }   = useAuth()
  // Path kembali ke antrian estimator: manager pakai /estimator, estimator pakai /
  const queuePath = profile?.role === 'manager' ? '/estimator' : '/'
  const navigate      = useNavigate()

  const [request,  setRequest]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [margin,   setMargin]   = useState(15)
  const [dbMaterials, setDbMaterials] = useState([])
  const [dbMesin,     setDbMesin]     = useState([])
  const [dbEmboss,    setDbEmboss]    = useState([])
  const [dbMatProses, setDbMatProses] = useState([])
  const [dbFinishing, setDbFinishing] = useState([])
  const [dbFinishingSplit, setDbFinishingSplit] = useState({}) // proses -> { pct_upah, pct_bahan, pct_mesin }
  const [dbAdditional,setDbAdditional]= useState([])
  const [purchasingData, setPurchasingData] = useState(null)  // { status, comparisons[] } dari validasi purchasing

  const [material,   setMaterial]   = useState([])
  const [cetak,      setCetak]      = useState([])
  const [emboss,     setEmboss]     = useState([])
  const [matProses,  setMatProses]  = useState([])
  const [finishing,  setFinishing]  = useState([])
  const [additional, setAdditional] = useState([])

  // ── Pembanding harga vendor (opsional, TIDAK menggantikan hitung manual) ──
  const [hasVendorComparison, setHasVendorComparison] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [vendorPricePerPcs, setVendorPricePerPcs] = useState('')
  const [vendorNameSuggestions, setVendorNameSuggestions] = useState([])

  // ── Multi-quantity ──────────────────────────────────────────
  const [qtyList, setQtyList]         = useState([])   // daftar semua qty diminta sales, misal [200000, 400000]
  const [activeQty, setActiveQty]     = useState(null) // qty yang sedang dikerjakan estimator
  const [savedQtys, setSavedQtys]     = useState([])   // qty yang sudah punya quotation tersimpan
  const qtyCache = useRef({}).current                   // cache state per-qty di memori (tidak re-render saat diisi)

  // Snapshot state terkini, dipakai di cleanup function useEffect supaya
  // tidak baca closure basi (cleanup tidak re-register tiap keystroke)
  const latestRef = useRef({})
  useEffect(() => {
    latestRef.current = {
      requestId, profile, request, activeQty, savedQtys, qtyList,
      material, cetak, emboss, matProses, finishing, additional, margin,
      hasVendorComparison, vendorName, vendorPricePerPcs,
    }
  })

  const normGsm = (rows) => (rows || []).map(r => ({
    ...r,
    gsm: String(r.gsm || '').toLowerCase().replace('gsm','').trim()
  }))

  // ── Auto-save draft (dipanggil manual saat pindah qty, dan otomatis saat unmount) ──
  // PENTING: sengaja cuma 1 network call (INSERT langsung, tanpa cek existing dulu),
  // karena ini dipanggil dari cleanup function saat user pindah halaman — kalau ada
  // 2 call berantai (SELECT lalu INSERT/UPDATE), call kedua sering tidak sempat
  // terkirim sebelum browser pindah ke komponen halaman berikutnya.
  // Konsekuensi: bisa numpuk beberapa baris draft duplikat. Itu ditangani saat
  // loadAll() — ambil draft TERBARU saja, lalu hapus duplikat yang lebih lama.
  async function saveDraftFor(qty, state) {
    if (qty == null || !state.requestId || !state.profile) return
    // CATATAN: draft DISIMPAN walaupun qty sudah punya quotation final.
    // Ini supaya revisi yang belum di-klik "Simpan" tidak hilang saat pindah menu.
    // Saat load, draft yang lebih BARU dari final akan diterapkan sebagai revisi;
    // draft yang lebih lama dianggap basi dan dibersihkan.
    //
    // Untuk mencegah numpuk draft: hapus dulu draft lama untuk qty+request+estimator
    // ini sebelum insert draft baru, jadi selalu ada maksimal 1 draft per qty.
    await supabase.from('quotations').delete()
      .eq('request_id', state.requestId).eq('estimator_id', state.profile.id)
      .eq('quantity', qty).eq('is_draft', true)

    // Jangan simpan draft kosong (tidak ada isian sama sekali di 6 section).
    // Vendor cuma data pembanding tambahan, tidak menggantikan isian 6 section,
    // jadi tidak relevan dipakai sebagai penentu kosong/tidaknya draft.
    const isEmpty = ['material','cetak','emboss','matProses','finishing','additional']
      .every(k => !Array.isArray(state[k]) || state[k].length === 0)
    if (isEmpty) return

    try {
      const { error } = await supabase.from('quotations').insert({
        request_id: state.requestId, estimator_id: state.profile.id, quantity: qty,
        customer_name: state.request?.customer_name || '', product_type: state.request?.product_type || '',
        is_draft: true, is_active: false, deal_status: 'quoted',
        material_cost: state.material, cetak_cost: state.cetak, emboss_laminasi: state.emboss,
        material_proses: state.matProses,
        finishing_wo: state.finishing,
        additional_cost: state.additional,
        margin_percent: num(state.margin), updated_at: new Date().toISOString(),
        cost_source: state.hasVendorComparison ? 'vendor' : 'internal',
        vendor_name: state.hasVendorComparison ? (state.vendorName || null) : null,
        vendor_price_per_pcs: state.hasVendorComparison ? (num(state.vendorPricePerPcs) || null) : null,
        // Draft belum final, jadi kalkulasi total belum relevan — isi 0 sebagai
        // default aman untuk berjaga-jaga kalau ada NOT NULL constraint di kolom ini.
        subtotal_material: 0, subtotal_cetak: 0, subtotal_emboss: 0,
        subtotal_matproses: 0, subtotal_finishing: 0, subtotal_additional: 0,
        total_cost: 0, selling_price: 0, price_per_unit: 0,
      })
      // PENTING: supabase-js TIDAK throw untuk error HTTP/database (mis. constraint
      // violation) — error dikembalikan sebagai field `error`, bukan exception.
      // Tanpa baris ini, kegagalan insert (mis. NOT NULL constraint) akan diam-diam
      // gagal tanpa pernah terlihat di console.
      if (error) console.error('Gagal auto-save draft (Supabase error):', error)
    } catch (e) {
      // Auto-save draft tidak boleh mengganggu alur utama kalau gagal (mis. offline).
      // Paling buruk: draft tidak tersimpan, kembali ke perilaku lama.
      console.error('Gagal auto-save draft (exception):', e)
    }
  }

  // Modal "Salin dari Kode Order lama" (repeat order).
  const [salinOpen, setSalinOpen] = useState(false)
  const [salinInfo, setSalinInfo] = useState(null)

  useEffect(() => { loadAll() }, [requestId])

  // Salin keenam array baris biaya dari perhitungan order lama.
  //
  // SALIN = SALIN APA ADANYA, qty termasuk. Keputusan pemilik, 14 Okt 2026.
  //
  // Dua versi sebelumnya salah arah, dan sejarahnya ditulis di sini supaya
  // tidak diulang:
  //
  //   v1 mengosongkan qty dan insheet (meniru cloneRows() untuk salin
  //      antar-qty). Akibatnya harga per pcs material -- yang butuh
  //      quantity > 0 DAN insheet > 0, lihat calcMaterial -- jadi 0 semua,
  //      kolom Harga/pcs "—" dan Subtotal Rp 0. Di layar terlihat seperti
  //      salinannya gagal, dan estimator tetap mengisi ulang qty 25 baris.
  //
  //   v2 menskalakan qty mengikuti perbandingan volume order. Angkanya
  //      langsung terisi, tapi hasilnya tidak bisa ditebak pengguna: baris
  //      yang qty-nya tidak sebanding volume (mis. borongan qty 1) ikut
  //      dikalikan, dan orang yang menekan "salin" tidak mengharapkan
  //      angkanya berubah sendiri.
  //
  // Sekarang: semua kolom dibawa persis seperti order lama, termasuk quantity
  // dan insheet. Yang terlihat di order lama itulah yang didapat. Penyesuaian
  // qty ke volume order ini tersedia sebagai SATU TOMBOL terpisah
  // (sesuaikanQtySalinan) -- jadi perubahan angka selalu hasil tindakan
  // pengguna, bukan tebakan aplikasi.
  //
  // `id` tiap baris diperbarui supaya baris hasil salinan punya identitas
  // sendiri. Tanpa itu, pencocokan harga purchasing saat simpan ulang bisa
  // mengira baris ini adalah baris milik order lama.
  function salinDariOrderLama(q) {
    const qtyLama = num(q.quantity)
    const siap = rows => (Array.isArray(rows) ? rows : []).map((r, i) => ({
      ...r,
      id: Date.now() + i + Math.random(),
    }))
    setMaterial(siap(q.material_cost))
    setCetak(siap(q.cetak_cost))
    setEmboss(siap(q.emboss_laminasi))
    setMatProses(siap(q.material_proses))
    setFinishing(siap(q.finishing_wo))
    setAdditional(siap(q.additional_cost))
    setSalinInfo({
      kode: q.kode_order || q.customer_name || 'order lama',
      jumlah: ['material_cost','cetak_cost','emboss_laminasi','material_proses','finishing_wo','additional_cost']
        .reduce((n, c) => n + (Array.isArray(q[c]) ? q[c].length : 0), 0),
      // Dipakai badge untuk memberi tahu mana dari tiga keadaan yang terjadi:
      // volume sama (salinan identik), volume beda (qty diskalakan), atau qty
      // order lama tidak diketahui (qty dibawa apa adanya).
      qtyLama,
      // Volume order lama vs order ini. Kalau beda, qty hasil salinan mengacu
      // ke volume yang salah sampai estimator menyesuaikannya.
      bedaVolume: !!(qtyLama && activeQty && qtyLama !== activeQty),
      sudahDisesuaikan: false,
    })
  }

  // Menyesuaikan qty seluruh baris dari volume order lama ke volume order ini,
  // dengan perbandingan: qty_baris x (qty_order_ini / qty_order_lama). Jadi
  // baris yang di order lama 1.300 jadi 4.000, dan komponen yang 2.600 (dua
  // buah per box) jadi 8.000 -- hubungan per-unit-nya terjaga.
  //
  // Hanya ditawarkan tepat setelah menyalin, dan hilang setelah dipakai:
  // sesudah estimator mengubah qty sendiri, perbandingan lama tidak sah lagi
  // dan menekannya kedua kali justru merusak angkanya.
  function sesuaikanQtySalinan() {
    const qtyLama = num(salinInfo?.qtyLama)
    if (!qtyLama || !activeQty) return
    const skala = rows => rows.map(r => {
      const v = num(r.quantity)
      if (!v) return r
      return { ...r, quantity: Math.round((v / qtyLama) * activeQty) }
    })
    setMaterial(skala)
    setCetak(skala)
    setEmboss(skala)
    setMatProses(skala)
    setFinishing(skala)
    setAdditional(skala)
    setSalinInfo(p => p && { ...p, sudahDisesuaikan: true, bedaVolume: false })
  }

  // Dipanggil dari Layout (lewat prop beforeNavigate) SEBELUM navigasi benar-benar
  // terjadi, supaya draft pasti selesai tersimpan dulu. Ini menggantikan pendekatan
  // lama (auto-save di cleanup function useEffect saat unmount), yang terbukti TIDAK
  // reliable: cleanup function tidak bisa di-await, jadi browser sering pindah render
  // sebelum request ke Supabase sempat benar-benar terkirim.
  async function handleBeforeNavigate() {
    await saveDraftFor(activeQty, latestRef.current)
  }

  useEffect(() => {
    if (requestId) localStorage.setItem('risepack_last_calculator_request', requestId)
  }, [requestId])

  // ── Pindah tab quantity ─────────────────────────────────────
  // savedQtysOverride: dipakai saat dipanggil tepat setelah handleSave, karena
  // latestRef.current.savedQtys mungkin belum sinkron (useEffect belum jalan ulang).
  async function switchQty(newQty, savedQtysOverride) {
    if (newQty === activeQty) return

    // Simpan state section saat ini ke cache sebelum pindah
    qtyCache[activeQty] = { material, cetak, emboss, matProses, finishing, additional, margin, hasVendorComparison, vendorName, vendorPricePerPcs }
    // Auto-save draft qty yang sedang ditinggalkan. DITUNGGU (await) supaya pasti
    // selesai tersimpan sebelum UI pindah ke tab qty berikutnya.
    await saveDraftFor(activeQty, { ...latestRef.current, savedQtys: savedQtysOverride || latestRef.current.savedQtys })

    if (qtyCache[newQty]) {
      // Qty ini sudah pernah dibuka/tersimpan, load dari cache
      const c = qtyCache[newQty]
      setMaterial(c.material); setCetak(c.cetak); setEmboss(c.emboss)
      setMatProses(c.matProses); setFinishing(c.finishing); setAdditional(c.additional)
      setMargin(c.margin)
      setHasVendorComparison(c.hasVendorComparison || false); setVendorName(c.vendorName || ''); setVendorPricePerPcs(c.vendorPricePerPcs ?? '')
    } else {
      // Qty ini belum pernah dibuka, prefill dari qty pertama (kalau ada),
      // qty & insheet dikosongkan ulang karena nilainya pasti beda untuk qty lain.
      // Sumber perhitungan (Internal/Vendor) SENGAJA tidak ikut di-prefill --
      // tiap qty bisa beda sumber, jadi qty baru selalu mulai dari Internal default,
      // bukan otomatis ikut sumber qty pertama yang bisa menyesatkan.
      const firstQty = qtyList[0]
      const base = qtyCache[firstQty]
      if (base) {
        const cloneRows = (rows) => rows.map(r => ({ ...r, id: Date.now() + Math.random(), quantity: '', insheet: '' }))
        setMaterial(cloneRows(base.material))
        setCetak(cloneRows(base.cetak))
        setEmboss(cloneRows(base.emboss))
        setMatProses(base.matProses.map(r => ({ ...r, id: Date.now() + Math.random(), quantity: 1 })))
        setFinishing(base.finishing.map(r => ({ ...r, id: Date.now() + Math.random() })))
        setAdditional(cloneRows(base.additional))
        setMargin(base.margin)
      } else {
        setMaterial([]); setCetak([]); setEmboss([]); setMatProses([]); setFinishing([]); setAdditional([])
        setMargin(15)
      }
      setHasVendorComparison(false); setVendorName(''); setVendorPricePerPcs('')
    }
    setActiveQty(newQty)
  }

  async function loadAll() {
    setLoading(true)
    const [
      { data: req },
      { data: mats },
      { data: mesin },
      { data: emb },
      { data: mp },
      { data: fin },
      { data: addl },
      { data: finSplit },
    ] = await Promise.all([
      supabase.from('requests').select('*').eq('id', requestId).single(),
      supabase.from('raw_materials').select('*').eq('category','material').order('name'),
      supabase.from('raw_materials').select('id,name,spec,notes,price,harga_mesin,qty_threshold').eq('category','cetak').order('name'),
      supabase.from('raw_materials').select('id,name,spec,notes,unit,price,minimum_charge').eq('category','emboss_laminasi').order('name'),
      supabase.from('raw_materials').select('id,name,spec,notes,price,rate_per_cm').eq('category','material_proses').order('name'),
      supabase.from('raw_materials').select('*').eq('category','finishing_wo').order('name'),
      supabase.from('raw_materials').select('id,name,price,rate_per_kg,rate_a,rate_b,minimum_charge').eq('category','additional').order('name'),
      supabase.from('finishing_wo_split_rules').select('*'),
    ])
    // Load semua quotation aktif untuk request ini (bisa lebih dari 1, satu per qty)
    const { data: quots } = await supabase.from('quotations').select('*')
      .eq('request_id', requestId).eq('is_active', true).eq('is_draft', false)

    // Load data purchasing comparisons untuk quotation aktif (kalau ada)
    // Dipakai untuk panel benchmarking purchasing di Calculator
    const activeQuot = (quots || []).find(q => q.quantity === (
      Array.isArray(req?.quantities) && req.quantities.length > 0
        ? req.quantities[0]
        : req?.quantity
    )) || (quots || [])[0]
    let purchData = null
    if (activeQuot && activeQuot.purchasing_status) {
      const { data: comps } = await supabase
        .from('purchasing_comparisons')
        .select('*')
        .eq('quotation_id', activeQuot.id)
      purchData = {
        status: activeQuot.purchasing_status,
        reviewedAt: activeQuot.purchasing_reviewed_at,
        quotationId: activeQuot.id,
        comparisons: comps || [],
        // Permintaan revisi dari purchasing. Purchasing tidak bisa menambah
        // baris item, jadi kalau ada yang tertinggal mereka hanya bisa
        // meminta estimator memperbaikinya di sini.
        needsRevision: !!activeQuot.needs_revision,
        revisionNote: activeQuot.revision_note || '',
        revisionAt: activeQuot.revision_requested_at,
      }
    }

    // Daftar nama vendor unik yang pernah dipakai (untuk autocomplete), supaya
    // estimator konsisten penulisan nama vendor, bukan ketik bebas tiap kali.
    const { data: vendorRows } = await supabase.from('quotations')
      .select('vendor_name').not('vendor_name', 'is', null)
    const uniqueVendors = [...new Set((vendorRows || []).map(v => v.vendor_name).filter(Boolean))].sort()
    setVendorNameSuggestions(uniqueVendors)

    // Load draft milik estimator yang sedang login untuk request ini (auto-save dari sesi sebelumnya)
    // Urutkan terbaru dulu, supaya kalau ada duplikat (lihat catatan di saveDraftFor),
    // draft yang dipakai adalah yang paling baru.
    const { data: drafts } = profile
      ? await supabase.from('quotations').select('*')
          .eq('request_id', requestId).eq('estimator_id', profile.id).eq('is_draft', true)
          .order('updated_at', { ascending: false })
      : { data: [] }

    // Tentukan daftar qty: dari quantities (array baru) dengan fallback ke quantity (lama, tunggal)
    const qtys = Array.isArray(req?.quantities) && req.quantities.length > 0
      ? req.quantities
      : (req?.quantity ? [req.quantity] : [])

    // Set semua state sekaligus agar tidak ada race condition
    setRequest(req)
    setDbMaterials(mats || [])
    setDbMesin(mesin || [])
    setDbEmboss(emb || [])
    setDbMatProses(mp || [])
    setDbFinishing(fin || [])
    setDbFinishingSplit(Object.fromEntries((finSplit || []).map(r => [r.proses, r])))
    setDbAdditional(addl || [])
    setQtyList(qtys)

    const savedQtyNumbers = (quots || []).map(q => q.quantity)
    setSavedQtys(savedQtyNumbers)

    // Isi cache dari quotation FINAL yang sudah tersimpan (prioritas utama)
    ;(quots || []).forEach(q => {
      qtyCache[q.quantity] = {
        material: normGsm(q.material_cost), cetak: q.cetak_cost || [], emboss: q.emboss_laminasi || [],
        matProses: q.material_proses || [], finishing: q.finishing_wo || [], additional: q.additional_cost || [],
        margin: q.margin_percent || 15,
        hasVendorComparison: q.cost_source === 'vendor',
        vendorName: q.vendor_name || '',
        vendorPricePerPcs: q.vendor_price_per_pcs ?? '',
      }
    })
    // Simpan updated_at dari final quotation per qty (untuk bandingkan dgn draft)
    const finalUpdatedAt = {}
    ;(quots || []).forEach(q => { finalUpdatedAt[q.quantity] = q.updated_at })

    // Terapkan DRAFT sebagai revisi. Aturan:
    // - Qty belum punya final → draft dipakai (auto-save sesi sebelumnya)
    // - Qty sudah punya final → draft dipakai HANYA kalau draft lebih baru dari final
    //   (artinya estimator revisi setelah simpan, lalu pindah menu tanpa klik simpan)
    // - Draft basi (lebih lama dari final, atau duplikat) → dibersihkan
    // Karena drafts sudah terurut terbaru dulu, draft pertama per qty yang dipakai.
    const staleDraftIds = []
    const seenDraftQtys = new Set()
    ;(drafts || []).forEach(d => {
      if (seenDraftQtys.has(d.quantity)) { staleDraftIds.push(d.id); return } // duplikat lebih lama, basi
      const finalTime = finalUpdatedAt[d.quantity]
      // Kalau ada final DAN draft tidak lebih baru → draft basi
      if (finalTime && new Date(d.updated_at) <= new Date(finalTime)) {
        staleDraftIds.push(d.id); return
      }
      seenDraftQtys.add(d.quantity)
      qtyCache[d.quantity] = {
        material: normGsm(d.material_cost), cetak: d.cetak_cost || [], emboss: d.emboss_laminasi || [],
        matProses: d.material_proses || [], finishing: d.finishing_wo || [], additional: d.additional_cost || [],
        margin: d.margin_percent || 15,
        hasVendorComparison: d.cost_source === 'vendor',
        vendorName: d.vendor_name || '',
        vendorPricePerPcs: d.vendor_price_per_pcs ?? '',
      }
    })
    // Bersihkan draft basi di background, tidak perlu ditunggu (tidak mempengaruhi tampilan)
    if (staleDraftIds.length > 0) {
      supabase.from('quotations').delete().in('id', staleDraftIds)
        .then(({ error }) => { if (error) console.error('Gagal bersihkan draft basi:', error) })
    }

    // Mulai dari qty pertama yang belum tersimpan, atau qty pertama kalau semua sudah tersimpan
    const firstUnsaved = qtys.find(q => !savedQtyNumbers.includes(q))
    const startQty = firstUnsaved ?? qtys[0] ?? null
    setActiveQty(startQty)

    if (startQty != null && qtyCache[startQty]) {
      const c = qtyCache[startQty]
      setMaterial(c.material); setCetak(c.cetak); setEmboss(c.emboss)
      setMatProses(c.matProses); setFinishing(c.finishing); setAdditional(c.additional)
      setMargin(c.margin)
      setHasVendorComparison(c.hasVendorComparison || false); setVendorName(c.vendorName || ''); setVendorPricePerPcs(c.vendorPricePerPcs ?? '')
    } else {
      setMaterial([]); setCetak([]); setEmboss([]); setMatProses([]); setFinishing([]); setAdditional([])
      setMargin(15)
      setHasVendorComparison(false); setVendorName(''); setVendorPricePerPcs('')
    }

    setPurchasingData(purchData)
    setLoading(false)
  }

  // ── Lookup harga material dari DB ─────────────────────────
  function lookupMaterialPrice(materialName, plano, gsm) {
    if (!materialName || !plano || !gsm) return 0
    const normalizeGsmLocal = (notes) => (notes || '').toLowerCase().replace('gsm','').trim()
    const normGsm = String(gsm).trim()
    const normName = materialName.toLowerCase().trim()
    const normPlano = String(plano).trim()
    const match = dbMaterials.find(m => {
      const mName = m.name.toLowerCase().trim()
      const mSpec = (m.spec || '').trim()
      const mGsm  = normalizeGsmLocal(m.notes)
      const ok = mName === normName && mSpec === normPlano && mGsm === normGsm
      return ok
    })
    return match ? match.price : 0
  }

  function lookupMesin(mesinName) {
    const match = dbMesin.find(m => m.name === mesinName)
    return match ? {
      per_drug: match.price || 0,
      harga_mesin: match.harga_mesin || 0,
      qty_threshold: match.qty_threshold || 0
    } : { per_drug: 0, harga_mesin: 0, qty_threshold: 0 }
  }

  function lookupEmboss(prosesName) {
    const match = dbEmboss.find(m => m.name === prosesName)
    if (!match) return { harga: 0, minimum_charge: 0, per_lembar: false }
    return {
      harga: match.price || 0,
      minimum_charge: match.minimum_charge || 0,
      // per_lembar = true kalau unit-nya 'lembar' (Emboss SM 52/74, SM 102)
      per_lembar: (match.unit || '').toLowerCase() === 'lembar',
    }
  }

  // ── Get unique values from DB ─────────────────────────────
  const materialNames  = [...new Set(dbMaterials.map(m => m.name))].sort()
  const normalizeGsm   = (notes) => (notes || '').toLowerCase().replace('gsm','').trim()
  const gsmOptions     = (matName) => [...new Set(dbMaterials.filter(m => m.name === matName).map(m => normalizeGsm(m.notes)))].filter(Boolean).sort((a,b)=>+a-+b)
  const planoOptions   = (matName, gsm) => [...new Set(dbMaterials.filter(m => m.name === matName && normalizeGsm(m.notes) === String(gsm).trim()).map(m => m.spec))].sort()
  const mesinNames     = [...new Set(dbMesin.map(m => m.name))].sort()
  const embossNames    = [...new Set(dbEmboss.map(m => m.name))].sort()
  const matProsesNames = [...new Set(dbMatProses.map(m => m.name))].sort()
  const finishingProses= [...new Set(dbFinishing.map(m => m.name))].sort()
  const finishingSpecs = (prosesName) => dbFinishing.filter(m => m.name === prosesName).map(m => m.spec).sort()

  // ── Row updater ───────────────────────────────────────────
  const updater = (setter) => (i, key, val) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))

  // ── Kalkulasi per row ─────────────────────────────────────
  const calcMaterial = useCallback(() => material.map(r => {
    const quantity = num(r.quantity)
    const diskon   = num(r.diskon)

    // ── Mode Corrugated ──────────────────────────────────────
    if (r.is_corrugated) {
      const P_mm = num(r.corr_p_mm)
      const L_mm = num(r.corr_l_mm)
      const harga_m2 = lookupP11(r.corr_substance || 'K150-M125-K150', r.corr_flute || 'B Flute')
      // Rumus: P(mm) × L(mm) / 1.000.000 × harga_m2 × 1.05
      const harga_per_pcs_raw = P_mm > 0 && L_mm > 0
        ? (P_mm * L_mm / 1000000) * harga_m2 * 1.05
        : 0
      const subtotal_raw = harga_per_pcs_raw * quantity
      const subtotal = subtotal_raw * (1 - diskon/100)
      const harga_per_pcs = harga_per_pcs_raw * (1 - diskon/100)
      return { ...r, harga_lembar: harga_m2, harga_per_pcs, subtotal_raw, subtotal }
    }

    // ── Mode Normal (offset) ─────────────────────────────────
    const planoGet = num(r.plano_get)
    const insheet  = num(r.insheet)
    const mata     = num(r.mata) || 1
    const isBusa   = r.material && r.material.toLowerCase().includes('busa')
    let harga
    if (isBusa) {
      const matchBusa = dbMaterials.find(m => m.name === r.material)
      const rate = matchBusa ? (matchBusa.rate_per_cm || matchBusa.price || 0) : 0
      harga = num(r.gsm) * rate
    } else if (r.plano === 'custom' && num(r.plano_w) > 0 && num(r.plano_h) > 0 && num(r.harga_kg) > 0) {
      harga = (num(r.plano_w) * num(r.plano_h) * num(r.gsm) * num(r.harga_kg)) / 20000 / 500
    } else {
      harga = lookupMaterialPrice(r.material, r.plano, r.gsm)
    }
    const harga_per_pcs_raw = (planoGet > 0 && quantity > 0 && insheet > 0)
      ? ((quantity + insheet) / planoGet / mata * harga) / quantity
      : 0
    const subtotal_raw = harga_per_pcs_raw * quantity
    const subtotal = subtotal_raw * (1 - diskon/100)
    const harga_per_pcs = harga_per_pcs_raw * (1 - diskon/100)
    return { ...r, harga_lembar: harga, harga_per_pcs, subtotal_raw, subtotal }
  }), [material, dbMaterials])

  const calcCetak = useCallback(() => cetak.map(r => {
    const qty      = num(r.quantity)
    const insheet  = num(r.insheet)
    const mesin    = lookupMesin(r.mesin)
    // Rumus: kalau qty+insheet < threshold → minimum harga_mesin
    // kalau qty+insheet >= threshold → ((qty+insheet-threshold)*per_drug + harga_mesin) / qty
    const total_biaya = (qty + insheet) >= mesin.qty_threshold
      ? ((qty + insheet - mesin.qty_threshold) * mesin.per_drug + mesin.harga_mesin)
      : mesin.harga_mesin
    const harga_per_pcs_raw = qty > 0 ? total_biaya / qty : 0
    const subtotal_raw = harga_per_pcs_raw * qty
    const diskon = num(r.diskon)
    const subtotal = subtotal_raw * (1 - diskon/100)
    const harga_per_pcs = harga_per_pcs_raw * (1 - diskon/100)
    return { ...r, harga_per_pcs, harga_mesin: mesin.harga_mesin, per_drug: mesin.per_drug, qty_threshold: mesin.qty_threshold, subtotal_raw, subtotal }
  }), [cetak, dbMesin])

  const calcEmboss = useCallback(() => emboss.map(r => {
    const proc    = lookupEmboss(r.proses)
    const qty     = num(r.quantity)
    const insheet = num(r.insheet)
    const diskon  = num(r.diskon)
    let subtotal_raw, harga_per_pcs_raw

    if (proc.per_lembar) {
      // Mode Emboss: harga per lembar / mata
      // Rumus: (harga / mata) × qty, minimum = minimum_charge
      const mata = Math.max(num(r.mata), 1)
      const harga_per_pcs_calc = proc.harga / mata
      const subtotal_calc = harga_per_pcs_calc * qty
      subtotal_raw = Math.max(subtotal_calc, proc.minimum_charge)
      harga_per_pcs_raw = qty > 0 ? subtotal_raw / qty : 0
    } else {
      // Mode Laminasi per cm²: (P × L × harga × (qty+insheet)) / mata / qty
      const parts = String(r.luas_permukaan || '').toLowerCase().split('x')
      const P     = num(parts[0])
      const L     = num(parts[1])
      const mata  = Math.max(num(r.mata), 1)
      const subtotal_calc = (P * L * proc.harga * (qty + insheet)) / mata
      subtotal_raw = Math.max(subtotal_calc, proc.minimum_charge)
      harga_per_pcs_raw = qty > 0 ? subtotal_raw / qty : 0
    }

    const subtotal = subtotal_raw * (1 - diskon/100)
    const harga_per_pcs = harga_per_pcs_raw * (1 - diskon/100)
    return { ...r, harga_per_cm2: proc.harga, minimum_charge: proc.minimum_charge, harga_per_pcs, subtotal_raw, subtotal }
  }), [emboss, dbEmboss])

  const PROSES_LUAS = ['pisau pond', 'klise poly', 'klise emboss']
  const calcMatProses = useCallback(() => matProses.map(r => {
    const match = dbMatProses.find(m => m.name === r.proses)
    const isLuasBased = PROSES_LUAS.includes(r.proses)
    const qty = num(r.quantity)
    let harga_per_pcs, subtotal
    if (isLuasBased && match) {
      const parts = String(r.luas_permukaan || '').toLowerCase().split('x')
      const P = num(parts[0])
      const L = num(parts[1])
      const total_biaya = P * L * (match.rate_per_cm || 0)
      harga_per_pcs = qty > 0 ? total_biaya / qty : 0
      subtotal = total_biaya
    } else {
      harga_per_pcs = match ? match.price : num(r.harga_satuan)
      subtotal = harga_per_pcs * qty
    }
    const subtotal_raw = subtotal
    const diskon = num(r.diskon)
    const subtotal_final = subtotal_raw * (1 - diskon/100)
    const harga_satuan_net = harga_per_pcs * (1 - diskon/100)
    return { ...r, harga_satuan: harga_satuan_net, subtotal_raw, subtotal: subtotal_final }
  }), [matProses, dbMatProses])

  const calcFinishing = useCallback(() => finishing.map(r => {
    const match = dbFinishing.find(m => m.name === r.proses && m.spec === r.spesifik)
    const harga = match ? match.price : num(r.harga_satuan)
    const subtotal_raw = harga * num(request?.quantity || 0)
    const diskon = num(r.diskon)
    const subtotal = subtotal_raw * (1 - diskon/100)
    const harga_satuan_net = harga * (1 - diskon/100)
    // Split otomatis Upah/Bahan Baku/Mesin dari rumus % per proses (diset di Pricing Dataset)
    const split = dbFinishingSplit[r.proses]
    const pct_upah = split ? num(split.pct_upah) : 0
    const pct_bahan = split ? num(split.pct_bahan) : 0
    const pct_mesin = split ? num(split.pct_mesin) : 0
    const upah_amount = harga_satuan_net * pct_upah / 100
    const bahan_amount = harga_satuan_net * pct_bahan / 100
    const mesin_amount = harga_satuan_net * pct_mesin / 100
    return {
      ...r, harga_satuan: harga_satuan_net, subtotal_raw, subtotal,
      pct_upah, pct_bahan, pct_mesin, upah_amount, bahan_amount, mesin_amount,
      segment_upah: split?.segment_upah || null, segment_bahan: split?.segment_bahan || null, segment_mesin: split?.segment_mesin || null,
    }
  }), [finishing, dbFinishing, dbFinishingSplit, request])

  const calcAdditional = useCallback(() => additional.map(r => {
    const match = dbAdditional.find(m => m.name === r.proses)
    const qty = num(r.quantity)
    const diskon = num(r.diskon)
    if (r.proses === 'potong' && match) {
      const parts = String(r.luas_permukaan || '').toLowerCase().split('x')
      const P = num(parts[0])
      const L = num(parts[1])
      const gramasi = num(r.gramasi)
      const total_kg = (P * L * gramasi) / 10000
      const biaya_total = total_kg * (match.rate_per_kg || 0)
      const subtotal_raw = Math.max(biaya_total, match.minimum_charge || 0)
      const harga_per_pcs_raw = qty > 0 ? subtotal_raw / qty : 0
      const subtotal = subtotal_raw * (1 - diskon/100)
      const harga_per_pcs = harga_per_pcs_raw * (1 - diskon/100)
      return { ...r, harga: harga_per_pcs, subtotal_raw, subtotal }
    }
    if (r.proses === 'lem samping' && match) {
      const panjang = num(r.panjang_lem)
      const harga_per_pcs_calc = (panjang * (match.rate_a || 0)) + (match.rate_b || 0)
      const subtotal_calc = harga_per_pcs_calc * qty
      const subtotal_raw = Math.max(subtotal_calc, match.minimum_charge || 0)
      const harga_per_pcs_raw = qty > 0 ? subtotal_raw / qty : 0
      const subtotal = subtotal_raw * (1 - diskon/100)
      const harga_per_pcs = harga_per_pcs_raw * (1 - diskon/100)
      return { ...r, harga: harga_per_pcs, subtotal_raw, subtotal }
    }
    // Proses manual lainnya - harga diisi per pcs, subtotal = harga x qty
    const subtotal_raw = num(r.harga) * qty
    const subtotal = subtotal_raw * (1 - diskon/100)
    const harga_net = num(r.harga) * (1 - diskon/100)
    return { ...r, harga: harga_net, subtotal_raw, subtotal }
  }), [additional, dbAdditional])

  const matCalc  = calcMaterial()
  const cetakCalc= calcCetak()
  const embCalc  = calcEmboss()
  const mpCalc   = calcMatProses()
  const finCalc  = calcFinishing()
  const addCalc  = calcAdditional()
  const sub = {
    material:   matCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    cetak:      cetakCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    emboss:     embCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    matProses:  mpCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    finishing:  finCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    additional: addCalc.reduce((s, r) => s + (r.subtotal||0), 0),
  }
  // Total SELALU dari 6 section (estimator wajib hitung manual). Harga vendor
  // adalah data PEMBANDING tambahan opsional, tidak pernah menggantikan total ini.
  const total   = Object.values(sub).reduce((a, b) => a + b, 0)
  const selling = total * (1 + num(margin) / 100)
  const perUnit = activeQty ? selling / activeQty : 0
  // Harga vendor per pcs × qty, murni untuk ditampilkan sebagai pembanding.
  const vendorTotal = activeQty ? num(vendorPricePerPcs) * activeQty : 0

  async function handleSave() {
    setSaving(true)

    // URUTAN AMAN: INSERT dulu dengan timestamp, baru nonaktifkan semua baris
    // KECUALI yang baru di-INSERT. Kalau INSERT gagal, data lama tetap aman.
    const now = new Date().toISOString()
    const { data: inserted, error } = await supabase.from('quotations').insert({
      request_id: requestId, estimator_id: profile.id,
      customer_name: request.customer_name, product_type: request.product_type, quantity: activeQty,
      material_cost: matCalc, cetak_cost: cetakCalc, emboss_laminasi: embCalc,
      material_proses: mpCalc, finishing_wo: finCalc, additional_cost: addCalc,
      subtotal_material: sub.material, subtotal_cetak: sub.cetak, subtotal_emboss: sub.emboss,
      subtotal_matproses: sub.matProses, subtotal_finishing: sub.finishing, subtotal_additional: sub.additional,
      total_cost: total, margin_percent: num(margin),
      selling_price: Math.round(selling),
      price_per_unit: perUnit, deal_status: 'quoted',
      cost_source: hasVendorComparison ? 'vendor' : 'internal',
      vendor_name: hasVendorComparison ? (vendorName || null) : null,
      vendor_price_per_pcs: hasVendorComparison ? (num(vendorPricePerPcs) || null) : null,
    }).select('id').maybeSingle()

    if (error || !inserted) {
      console.error('Gagal simpan quotation:', error)
      alert('Gagal menyimpan: ' + (error?.message || 'Tidak ada data dikembalikan'))
      setSaving(false)
      return
    }

    // INSERT berhasil — ambil data purchasing dari baris lama sebelum dinonaktifkan
    const { data: oldQuots } = await supabase.from('quotations')
      .select('id, purchasing_status, purchasing_notes, purchasing_reviewed_at, purchasing_reviewed_by, sent_to_purchasing_at, sent_to_purchasing_by, purchasing_projected_at, purchasing_projected_by, needs_revision, revision_note, deal_status, kode_order, deal_price_source, deal_segment_keuangan, material_cost, cetak_cost, emboss_laminasi, material_proses, finishing_wo, additional_cost')
      .eq('request_id', requestId).eq('quantity', activeQty)
      .eq('is_draft', false).eq('is_active', true).neq('id', inserted.id)
      .order('updated_at', { ascending: false }).limit(1)

    const oldQuot = oldQuots?.[0]

    // ── Data milik Sales ikut dibawa ke baris baru ────────────────────────
    //
    // BUG LAMA: INSERT di atas SELALU menulis deal_status 'quoted', dan tidak
    // pernah menulis kode_order / deal_price_source / deal_segment_keuangan.
    // Padahal keempatnya diisi Sales/Manager pada baris LAMA, dan setiap
    // simpan ulang membuat baris aktif yang BARU.
    //
    // Akibatnya setiap kali estimator menyimpan ulang, order yang sudah deal
    // dan sudah ditagging mendadak kembali terlihat "⚠️ Belum ditagging
    // Sales" di Antrian Purchasing dan "Belum Diisi" di dashboard Sales --
    // dan sales harus menagging ulang tanpa tahu kenapa. Sebagian baris
    // "belum ditagging" yang selama ini dikira kelalaian sales sebenarnya
    // berasal dari sini.
    //
    // Dijalankan SEBELUM blok migrasi purchasing di bawah, selagi
    // purchasing_status baris baru masih null.
    if (oldQuot) {
      const bawaan = {}
      // 'quoted' adalah nilai awal, bukan keputusan sales -- tidak perlu dibawa.
      if (oldQuot.deal_status && oldQuot.deal_status !== 'quoted') bawaan.deal_status = oldQuot.deal_status
      if (oldQuot.kode_order)            bawaan.kode_order            = oldQuot.kode_order
      if (oldQuot.deal_price_source)     bawaan.deal_price_source     = oldQuot.deal_price_source
      if (oldQuot.deal_segment_keuangan) bawaan.deal_segment_keuangan = oldQuot.deal_segment_keuangan

      if (Object.keys(bawaan).length > 0) {
        const { data: bawaOk, error: bawaErr } = await supabase.from('quotations')
          .update(bawaan).eq('id', inserted.id).select('id')
        // PostgREST tidak menganggap UPDATE yang ditolak RLS sebagai error --
        // baris yang kena 0 dan aplikasi mengira berhasil. Jadi dicek manual.
        if (bawaErr || !bawaOk || bawaOk.length === 0) {
          console.error('Gagal membawa data Sales ke quotation baru:', bawaErr, bawaan)
          alert('Perhitungan TERSIMPAN, tapi Status Deal / Kode Order dari versi sebelumnya GAGAL dipindahkan.\n\n'
            + (bawaErr?.message || 'Tidak ada baris yang berubah — kemungkinan akun Anda belum punya izin.')
            + '\n\nTolong minta Sales mengisi ulang Kode Order untuk order ini, supaya tidak putus dari data ERP.')
        }
      }
    }

    // Kalau baris lama punya data purchasing, migrate ke baris baru
    if (oldQuot?.purchasing_status) {
      // ── Keputusan purchasing jadi basi begitu perhitungan berubah ──────
      //
      // Keputusan Disetujui / Hold / Cancelled diberikan untuk SATU versi
      // perhitungan. Begitu estimator mengubah angkanya, "Disetujui" itu
      // mengacu ke angka yang sudah tidak ada lagi. Jadi keputusannya
      // direset ke 'pending' (Belum Diputuskan) -- TAPI disertai catatan
      // yang menyebut keputusan apa yang hilang dan kapan, supaya purchasing
      // tahu ini bukan order baru melainkan order yang pernah mereka
      // putuskan lalu berubah.
      //
      // Yang TIDAK direset: purchasing_projected_at. Harga pembanding yang
      // sudah diisi tetap terbawa (dicocokkan per nama item, lihat
      // remapComparisons), jadi order ini bukan "belum diproyeksi" -- cuma
      // item barunya yang kosong, dan itu ditandai badge "Item Kurang".
      //
      // needs_revision sengaja TIDAK ikut dibawa: barisnya baru, nilainya
      // default false. Permintaan revisi selesai karena diperbaiki, bukan
      // karena ada yang menekan "tandai selesai".
      const LABEL_KEPUTUSAN = { approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }
      const keputusanLama = oldQuot.purchasing_status
      const adaKeputusan  = !!LABEL_KEPUTUSAN[keputusanLama]
      const waktuReset    = new Date()

      const catatanReset = !adaKeputusan ? null
        : oldQuot.needs_revision
          ? `Sebelumnya ${LABEL_KEPUTUSAN[keputusanLama]} karena purchasing minta revisi. `
            + `Estimator sudah memperbaiki perhitungan pada `
            + `${waktuReset.toLocaleString('id-ID')} — mohon diperiksa dan diputuskan ulang.`
          : `Sebelumnya ${LABEL_KEPUTUSAN[keputusanLama]} — direset karena estimator `
            + `mengubah perhitungan pada ${waktuReset.toLocaleString('id-ID')}. `
            + `Harga pembanding yang sudah diisi tetap tersimpan.`

      await supabase.from('quotations').update({
        purchasing_status:      adaKeputusan ? 'pending' : oldQuot.purchasing_status,
        purchasing_notes:       oldQuot.purchasing_notes,
        purchasing_reviewed_at: oldQuot.purchasing_reviewed_at,
        purchasing_reviewed_by: oldQuot.purchasing_reviewed_by,
        sent_to_purchasing_at:  oldQuot.sent_to_purchasing_at,
        sent_to_purchasing_by:  oldQuot.sent_to_purchasing_by,
        purchasing_projected_at: oldQuot.purchasing_projected_at,
        purchasing_projected_by: oldQuot.purchasing_projected_by,
        decision_reset_note:    catatanReset,
        decision_reset_at:      adaKeputusan ? waktuReset.toISOString() : null,
        decision_reset_from:    adaKeputusan ? keputusanLama : null,
      }).eq('id', inserted.id)

      // Migrate purchasing_comparisons ke quotation baru.
      //
      // BUG LAMA: baris purchasing disalin apa adanya, jadi row_index-nya
      // ikut terbawa. Padahal row_index itu POSISI baris. Begitu estimator
      // menambah/menghapus satu item di tengah tabel, posisi semua baris di
      // bawahnya bergeser -- dan harga purchasing nempel ke item yang SALAH
      // tanpa ada error apa pun. Sekarang setiap baris purchasing dicocokkan
      // ulang ke item yang sama di quotation baru (lihat remapComparisons).
      const { data: oldComps } = await supabase.from('purchasing_comparisons')
        .select('*').eq('quotation_id', oldQuot.id)
      if (oldComps && oldComps.length > 0) {
        const { kept, dropped } = remapComparisons(oldComps, oldQuot, {
          material: matCalc, cetak: cetakCalc, emboss: embCalc,
          mat_proses: mpCalc, finishing: finCalc, additional: addCalc,
        }, inserted.id)

        if (dropped.length > 0) {
          console.warn('[migrasi purchasing] %d baris harga purchasing dibuang karena itemnya sudah tidak ada di perhitungan baru:', dropped.length, dropped)
        }

        // Pemindahan dijalankan lewat FUNGSI DATABASE, bukan langsung dari
        // sini. Role estimator cuma punya SELECT di purchasing_comparisons
        // (policy "sales estimator read"), jadi insert dari aplikasi SELALU
        // ditolak RLS -- dan sebelum ada pemeriksaan hasil, kegagalan itu
        // tidak pernah terlihat. Akibatnya harga purchasing tertinggal di
        // baris quotation yang sudah mati: diukur 14 Okt 2026, 495 baris
        // nyangkut di 15 quotation mati vs 358 baris di 14 yang aktif.
        //
        // Lihat supabase/purchasing_pindah_harga_migration.sql. Fungsi itu
        // berjalan dengan hak pemilik, menolak dipanggil role lain, hanya mau
        // memindahkan dalam request+qty yang sama, dan melakukan insert serta
        // delete dalam SATU transaksi -- jadi tidak bisa berhenti setengah
        // jalan seperti versi dua langkah sebelumnya.
        const { data: jumlahPindah, error: compErr } = await supabase.rpc(
          'migrate_purchasing_comparisons',
          {
            p_old_quotation: oldQuot.id,
            p_new_quotation: inserted.id,
            // quotation_id tidak ikut dikirim -- tujuannya ditentukan fungsi.
            p_rows: kept.map(({ quotation_id: _qid, ...r }) => r),
          }
        )
        if (compErr) {
          console.error('Gagal memindahkan harga purchasing:', compErr)
          alert('Perhitungan TERSIMPAN, tapi harga pembanding purchasing gagal dipindahkan.\n\n'
            + compErr.message
            + '\n\nHarga lama TIDAK hilang — masih menempel di versi perhitungan sebelumnya. '
            + 'Tolong beri tahu purchasing supaya bisa dicek.')
        } else if (kept.length > 0 && jumlahPindah === 0) {
          console.warn('[migrasi purchasing] fungsi mengembalikan 0 baris padahal ada',
            kept.length, 'baris yang seharusnya pindah')
        }
      }
    }

    // Nonaktifkan semua baris lama KECUALI yang baru di-INSERT
    await supabase.from('quotations').update({ is_active: false })
      .eq('request_id', requestId).eq('quantity', activeQty)
      .eq('is_draft', false).neq('id', inserted.id)

    // Hapus draft (kalau ada) untuk qty ini karena sudah final tersimpan
    await supabase.from('quotations').delete()
      .eq('request_id', requestId).eq('quantity', activeQty)
      .eq('estimator_id', profile.id).eq('is_draft', true)

    qtyCache[activeQty] = { material, cetak, emboss, matProses, finishing, additional, margin, hasVendorComparison, vendorName, vendorPricePerPcs }
    const newSavedQtys = savedQtys.includes(activeQty) ? savedQtys : [...savedQtys, activeQty]
    setSavedQtys(newSavedQtys)

    // Sync latestRef.savedQtys langsung agar handleBeforeNavigate tidak menyimpan
    // draft kosong saat navigate() dipanggil sebelum useEffect sempat jalan
    latestRef.current = { ...latestRef.current, savedQtys: newSavedQtys }

    const allDone = qtyList.every(q => newSavedQtys.includes(q))
    if (allDone) {
      await supabase.from('requests').update({ status:'done', completed_at: new Date().toISOString() }).eq('id', requestId)
      navigate(queuePath)
    } else {
      const nextQty = qtyList.find(q => !newSavedQtys.includes(q))
      if (nextQty != null) switchQty(nextQty, newSavedQtys)
    }
    setSaving(false)
  }

  if (loading) return <Layout title="Kalkulator"><div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>Memuat data...</div></Layout>
  if (!request) return <Layout title="Kalkulator"><div style={{ padding:60, color:'#dc2626' }}>Request tidak ditemukan.</div></Layout>

  return (
    <Layout title={`Kalkulator — ${request.request_number}`} beforeNavigate={handleBeforeNavigate}>
      {/* Tombol kembali */}
      <button
        onClick={async () => { await handleBeforeNavigate(); navigate(queuePath) }}
        style={{
          display:'flex', alignItems:'center', gap:6, marginBottom:16,
          padding:'8px 14px', background:'#fff', border:`1px solid ${C.border}`,
          borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', color:C.brown,
        }}
      >
        ← Kembali ke Antrian
      </button>

      {/* Info header */}
      <div style={{ ...s.card, borderLeft:`4px solid ${C.orange}`, padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12 }}>
          {[['Customer',request.customer_name],['Produk',request.product_type],['Qty Diminta',qtyList.map(fmt).join(' / ')],
            ['Ukuran',request.product_size||'—'],['Luas Permukaan (m²)',request.plano_size||'—'],
            ['Material',request.material_spec||'—'],
            ['Print',request.print_spec||'—'],['Finishing',request.finishing_spec||'—']
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:500, color:C.dark }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, display:'flex', gap:16, flexWrap:'wrap' }}>
          {request.notes && (
            <div style={{ flex:1, minWidth:200, padding:'8px 12px', background:'#fffbeb', borderRadius:6, fontSize:13, color:'#92400e' }}>
              💬 {request.notes}
            </div>
          )}
          {(() => {
            const imgs = Array.isArray(request.reference_images) && request.reference_images.length > 0
              ? request.reference_images
              : (request.reference_image ? [request.reference_image] : [])
            if (imgs.length === 0) return null
            return (
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4, textAlign:'center' }}>🖼️ Gambar Referensi</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {imgs.map((url, i) => (
                    <img key={i} src={url} alt={`ref ${i+1}`}
                      style={{ height:120, width:120, borderRadius:8, border:`1px solid ${C.border}`, cursor:'pointer', objectFit:'cover' }}
                      onClick={() => window.open(url, '_blank')} />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Repeat order: ambil perhitungan order lama, lalu tinggal direview.
          Ditaruh di atas supaya terlihat SEBELUM estimator mulai mengisi
          baris satu per satu dari nol. */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={() => setSalinOpen(true)} style={{
          padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`,
          background:'#fff', fontSize:13, fontWeight:600, color:C.dark, cursor:'pointer',
        }}>📄 Salin dari Kode Order lama</button>
        <span style={{ fontSize:11, color:'#9ca3af' }}>
          Untuk repeat order — isi perhitungan lama disalin, Anda tinggal mengubah yang berbeda.
        </span>
        {salinInfo && !salinInfo.bedaVolume && (
          <span style={{
            fontSize:11.5, fontWeight:600, color:'#3b6d11', background:'#f0fdf4',
            border:'1px solid #bbf7d0', borderRadius:20, padding:'3px 10px',
          }}>
            ✓ {salinInfo.jumlah} baris disalin dari {salinInfo.kode}
            {salinInfo.sudahDisesuaikan
              ? ` — qty sudah disesuaikan ke ${fmt(activeQty)} pcs`
              : salinInfo.qtyLama
                ? ` — volume sama (${fmt(activeQty)} pcs), salinan identik`
                : ''}
          </span>
        )}
      </div>

      {/* Qty hasil salinan masih mengacu ke volume order LAMA. Ini bukan badge
          kecil tapi peringatan selebar halaman, karena diamkan saja berarti
          seluruh HPP dihitung untuk volume yang tidak dipesan customer --
          salah tapi kelihatan wajar. Penyesuaiannya satu tombol, dan hasilnya
          tetap harus diperiksa karena tidak semua baris qty-nya sebanding
          dengan volume order (mis. biaya borongan). */}
      {salinInfo?.bedaVolume && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          marginBottom:16, padding:'12px 16px', borderRadius:10,
          background:'#FFFBEB', border:'1px solid #FCD34D',
        }}>
          <span style={{ fontSize:15, lineHeight:1.4 }}>⚠️</span>
          <div style={{ flex:'1 1 320px', fontSize:12.5, color:'#78350F', lineHeight:1.6 }}>
            <strong>Qty masih ikut order lama.</strong> {salinInfo.jumlah} baris disalin dari{' '}
            {salinInfo.kode} yang volumenya <strong>{fmt(salinInfo.qtyLama)} pcs</strong>, sedangkan
            order ini <strong>{fmt(activeQty)} pcs</strong>. Selama belum disesuaikan, harga per pcs
            dihitung memakai volume yang salah — ongkos insheet terbagi ke jumlah barang yang keliru.
          </div>
          <button onClick={sesuaikanQtySalinan} style={{
            flexShrink:0, padding:'9px 16px', borderRadius:8, border:'none',
            background:'#B45309', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
          }}>Sesuaikan qty ke {fmt(activeQty)} pcs</button>
          <button onClick={() => setSalinInfo(p => p && { ...p, bedaVolume:false })} style={{
            flexShrink:0, padding:'9px 14px', borderRadius:8, background:'#fff',
            border:`1px solid ${C.border}`, fontSize:13, color:'#6b7280', cursor:'pointer',
          }} title="Qty dibiarkan seperti order lama — saya akan mengaturnya sendiri">
            Biar saya atur sendiri
          </button>
        </div>
      )}

      {salinOpen && (
        <SalinOrderLama
          mode="hpp"
          excludeId={purchasingData?.quotationId}
          onPick={salinDariOrderLama}
          onClose={() => setSalinOpen(false)}
        />
      )}

      {/* Tab selector quantity — cuma muncul kalau request punya lebih dari 1 qty */}
      {qtyList.length > 1 && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {qtyList.map(q => {
            const isActive = q === activeQty
            const isSaved  = savedQtys.includes(q)
            return (
              <button
                key={q}
                onClick={() => switchQty(q)}
                style={{
                  padding:'10px 18px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer',
                  border: isActive ? `2px solid ${C.orange}` : `1px solid ${C.border}`,
                  background: isActive ? '#fff7ed' : '#fff',
                  color: isActive ? C.orange : C.dark,
                }}
              >
                {isSaved && <span style={{ color:'#16a34a', marginRight:6 }}>✓</span>}
                {fmt(q)} pcs
              </button>
            )
          })}
        </div>
      )}

      {/* Permintaan revisi dari purchasing. SENGAJA di luar panel benchmarking
          di bawah, karena panel itu hanya tampil kalau sudah ada harga
          pembanding -- sedangkan permintaan revisi justru paling sering muncul
          saat harganya belum lengkap. Hilang sendiri setelah estimator
          menyimpan perhitungan (baris quotation baru, needs_revision false). */}
      {purchasingData?.needsRevision && (
        <div style={{ marginBottom:20, border:'1px solid #FCD34D', borderRadius:10, overflow:'hidden' }}>
          <div style={{ background:'#FFFBEB', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:10 }}>
            <span style={{ fontSize:15, lineHeight:1.4 }}>📋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#92400E', marginBottom:4 }}>
                Purchasing minta revisi
                {purchasingData.revisionAt && (
                  <span style={{ fontWeight:400, fontSize:11, color:'#B45309', marginLeft:8 }}>
                    {new Date(purchasingData.revisionAt).toLocaleString('id-ID')}
                  </span>
                )}
              </div>
              <div style={{ fontSize:13, color:'#78350F', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
                {purchasingData.revisionNote || 'Tidak ada catatan rinci dari purchasing.'}
              </div>
              <div style={{ fontSize:11, color:'#B45309', marginTop:6 }}>
                Perbaiki lalu tekan Simpan — tanda ini hilang sendiri setelah perhitungan disimpan ulang.
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Perbandingan Harga Vendor (opsional, TIDAK menggantikan hitung manual di bawah) */}
      <div style={s.card}>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom: hasVendorComparison ? 14 : 0 }}>
          <input
            type="checkbox"
            checked={hasVendorComparison}
            onChange={e => setHasVendorComparison(e.target.checked)}
            style={{ width:16, height:16, cursor:'pointer' }}
          />
          <span style={{ fontSize:14, fontWeight:600, color:C.dark }}>Ada Perbandingan Harga Vendor?</span>
        </label>
        <div style={{ fontSize:11, color:'#9ca3af', marginTop: hasVendorComparison ? 0 : 6, marginLeft: hasVendorComparison ? 0 : 26 }}>
          Perhitungan manual di bawah tetap wajib diisi. Vendor cuma data pembanding tambahan.
        </div>

        {hasVendorComparison && (
          <>
            <div style={{ marginTop:14, marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#9ca3af', display:'block', marginBottom:4 }}>Nama Vendor</label>
              <input
                list="vendor-name-suggestions"
                style={s.input}
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="cth. CV Mitra Cetak Jaya"
              />
              <datalist id="vendor-name-suggestions">
                {vendorNameSuggestions.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div style={{ background:C.cream, borderRadius:8, padding:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, alignItems:'end' }}>
              <div>
                <label style={{ fontSize:11, color:'#9ca3af', display:'block', marginBottom:4 }}>Harga per pcs (Rp)</label>
                <input
                  type="number"
                  style={{ ...s.input, textAlign:'right' }}
                  value={vendorPricePerPcs}
                  onChange={e => setVendorPricePerPcs(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Qty</div>
                <div style={{ padding:'9px 12px', background:'#f1efe8', borderRadius:7, fontSize:13, textAlign:'right', color:'#5f5e5a' }}>
                  {activeQty ? fmt(activeQty) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Total Modal Vendor</div>
                <div style={{ padding:'9px 12px', background:C.border, borderRadius:7, fontSize:13, textAlign:'right', fontWeight:600, color:C.dark }}>
                  {idr(vendorTotal)}
                </div>
              </div>
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:10 }}>
              Murni sebagai pembanding — tidak mempengaruhi Total Modal & Harga Jual dari hitungan manual di bawah.
            </div>
          </>
        )}
      </div>

      {/* 1. MATERIAL COST */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>1. Material Cost</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.material > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.material)}</span>}
            <button style={s.addBtn} onClick={() => setMaterial(p => [...p, newMaterial()])}>+ Tambah Baris</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead><tr>
              {['Nama','Material','GSM','Plano','Luas Permukaan','Mata','Plano Get','Qty','Insheet','Harga/Lembar','Harga/pcs','Diskon%','Subtotal',''].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {material.length === 0 && <tr><td colSpan={14} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
              {matCalc.map((row, i) => (
                <tr key={row.id}>
                  <td style={s.td}>
                    <input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setMaterial)(i,'nama',e.target.value)} placeholder="cover" />
                    <div style={{ marginTop:3 }}>
                      <label style={{ fontSize:10, color:'#9ca3af', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                        <input type="checkbox" checked={!!row.is_corrugated}
                          onChange={e => updater(setMaterial)(i,'is_corrugated', e.target.checked)}
                          style={{ width:11, height:11 }} />
                        Corrugated
                      </label>
                    </div>
                  </td>
                  <td style={s.td}>
                    {row.is_corrugated ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <select style={{ ...s.select, width:160, fontSize:11 }} value={row.corr_substance || 'K150-M125-K150'}
                          onChange={e => updater(setMaterial)(i,'corr_substance',e.target.value)}>
                          {Object.keys(P11_TABLE).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <select style={{ ...s.select, width:160, fontSize:11 }} value={row.corr_flute || 'B Flute'}
                          onChange={e => updater(setMaterial)(i,'corr_flute',e.target.value)}>
                          {P11_FLUTES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    ) : (
                    <select style={{ ...s.select, width:160 }} value={row.material}
                      onChange={e => {
                        const val = e.target.value
                        const isBusaSel = val.toLowerCase().includes('busa')
                        setMaterial(p => p.map((r,idx) => idx===i ? {...r, material:val, gsm:'', plano: isBusaSel ? '120x200' : '79x109'} : r))
                      }}>
                      <option value="">-- pilih --</option>
                      {materialNames.map(n => <option key={n}>{n}</option>)}
                    </select>
                    )}
                  </td>
                  {/* GSM — corrugated: tampilkan harga/m² dari P11 */}
                  <td style={s.td}>
                    {row.is_corrugated ? (
                      <div style={{ ...s.calc, fontSize:11 }}>{lookupP11(row.corr_substance||'K150-M125-K150', row.corr_flute||'B Flute').toLocaleString('id-ID')}</div>
                    ) : (row.plano === 'custom' || (row.material && row.material.toLowerCase().includes('busa'))) ? (
                      <input style={{ ...s.input, width:80 }} type="number" step="0.1" value={row.gsm} onChange={e => updater(setMaterial)(i,'gsm',e.target.value)} placeholder={row.material && row.material.toLowerCase().includes('busa') ? 'tebal(cm)' : 'GSM'} />
                    ) : (
                      <select style={{ ...s.select, width:80 }} value={row.gsm}
                        onChange={e => {
                          const newGsm = e.target.value
                          const opts = planoOptions(row.material, newGsm)
                          const newPlano = row.plano === 'custom' ? 'custom' : (opts.length > 0 ? opts[0] : '79x109')
                          setMaterial(p => p.map((r,idx) => idx===i ? {...r, gsm:newGsm, plano:newPlano} : r))
                        }}>
                        <option value="">GSM</option>
                        {gsmOptions(row.material).map(g => <option key={g}>{g}</option>)}
                      </select>
                    )}
                  </td>
                  {/* Plano — corrugated: input P(mm) x L(mm) */}
                  <td style={s.td}>
                    {row.is_corrugated ? (
                      <div style={{ display:'flex', gap:3 }}>
                        <input style={{ ...s.input, width:55 }} type="number" value={row.corr_p_mm||''} onChange={e => updater(setMaterial)(i,'corr_p_mm',e.target.value)} placeholder="P(mm)" />
                        <input style={{ ...s.input, width:55 }} type="number" value={row.corr_l_mm||''} onChange={e => updater(setMaterial)(i,'corr_l_mm',e.target.value)} placeholder="L(mm)" />
                      </div>
                    ) : (row.material && row.material.toLowerCase().includes('busa')) ? (
                      <div style={s.calc}>120x200</div>
                    ) : row.plano === 'custom' ? (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <select style={{ ...s.select, width:80 }} value={row.plano} onChange={e => updater(setMaterial)(i,'plano',e.target.value)}>
                          {PLANO_OPTIONS.map(p => <option key={p}>{p}</option>)}
                        </select>
                        <input style={{ ...s.input, width:50 }} placeholder="P(cm)" type="number" value={row.plano_w} onChange={e => updater(setMaterial)(i,'plano_w',e.target.value)} />
                        <input style={{ ...s.input, width:50 }} placeholder="L(cm)" type="number" value={row.plano_h} onChange={e => updater(setMaterial)(i,'plano_h',e.target.value)} />
                        <input style={{ ...s.input, width:80 }} placeholder="Rp/kg" type="number" value={row.harga_kg||''} onChange={e => updater(setMaterial)(i,'harga_kg',e.target.value)} />
                      </div>
                    ) : (
                      <select style={{ ...s.select, width:110 }} value={row.plano}
                        onChange={e => updater(setMaterial)(i,'plano',e.target.value)}>
                        {(planoOptions(row.material, row.gsm).length > 0 ? planoOptions(row.material, row.gsm) : PLANO_OPTIONS).map(p => <option key={p}>{p}</option>)}
                      </select>
                    )}
                  </td>
                  {/* Luas Permukaan, Mata, Plano Get, Insheet — kosong untuk corrugated */}
                  <td style={s.td}>{row.is_corrugated ? <span style={{color:'#d1d5db'}}>—</span> : <input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setMaterial)(i,'luas_permukaan',e.target.value)} placeholder="30x40" />}</td>
                  <td style={s.td}>{row.is_corrugated ? <span style={{color:'#d1d5db'}}>—</span> : <input style={{ ...s.input, width:60 }} type="number" min="1" value={row.mata||1} onChange={e => updater(setMaterial)(i,'mata',e.target.value)} placeholder="1" />}</td>
                  <td style={s.td}>{row.is_corrugated ? <span style={{color:'#d1d5db'}}>—</span> : <input style={{ ...s.input, width:80 }} type="number" value={row.plano_get} onChange={e => updater(setMaterial)(i,'plano_get',e.target.value)} placeholder="1" />}</td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setMaterial)(i,'quantity',e.target.value)} /></td>
                  <td style={s.td}>{row.is_corrugated ? <span style={{color:'#d1d5db'}}>—</span> : <input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setMaterial)(i,'insheet',e.target.value)} placeholder="500" />}</td>
                  <td style={s.td}><div style={{ ...s.calc, color: row.harga_lembar > 0 ? '#16a34a' : '#9ca3af' }}>{row.harga_lembar > 0 ? idr(row.harga_lembar) : '—'}</div></td>
                  <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                  <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setMaterial)(i,'diskon',e.target.value)} placeholder="0" /></td>
                  <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                  <td style={s.td}><button style={s.delBtn} onClick={() => setMaterial(p => p.filter((_,idx)=>idx!==i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. CETAK COST */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>2. Cetak Cost</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.cetak > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.cetak)}</span>}
            <button style={s.addBtn} onClick={() => setCetak(p => [...p, newCetak()])}>+ Tambah Baris</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Nama','Mesin','Warna','Qty','Insheet','Luas Permukaan','Harga/pcs','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {cetak.length === 0 && <tr><td colSpan={10} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
              {cetakCalc.map((row,i) => (
                <tr key={row.id}>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setCetak)(i,'nama',e.target.value)} /></td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:150 }} value={row.mesin} onChange={e => updater(setCetak)(i,'mesin',e.target.value)}>
                      {mesinNames.map(n=><option key={n}>{n}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:130 }} value={row.warna} onChange={e => updater(setCetak)(i,'warna',e.target.value)}>
                      {WARNA_OPTIONS.map(w=><option key={w}>{w}</option>)}
                    </select>
                  </td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setCetak)(i,'quantity',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setCetak)(i,'insheet',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setCetak)(i,'luas_permukaan',e.target.value)} placeholder="30x40" /></td>
                  <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                  <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setCetak)(i,'diskon',e.target.value)} placeholder="0" /></td>
                  <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                  <td style={s.td}><button style={s.delBtn} onClick={() => setCetak(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. EMBOSS / LAMINASI */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>3. Emboss / Laminasi</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.emboss > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.emboss)}</span>}
            <button style={s.addBtn} onClick={() => setEmboss(p=>[...p, newEmboss()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Qty','Insheet','Luas Permukaan','Mata','Harga/pcs','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {emboss.length === 0 && <tr><td colSpan={9} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {embCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setEmboss)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:160 }} value={row.proses} onChange={e => updater(setEmboss)(i,'proses',e.target.value)}>
                    {embossNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setEmboss)(i,'quantity',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setEmboss)(i,'insheet',e.target.value)} /></td>
                {/* Luas Permukaan: hanya untuk mode per cm² (Laminasi) */}
                <td style={s.td}>
                  {lookupEmboss(row.proses).per_lembar ? (
                    <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                  ) : (
                    <input style={{ ...s.input, width:90 }} type="text"
                      value={row.luas_permukaan} onChange={e => updater(setEmboss)(i,'luas_permukaan',e.target.value)}
                      placeholder="20x20" />
                  )}
                </td>
                {/* Mata: untuk semua mode */}
                <td style={s.td}>
                  <input style={{ ...s.input, width:60 }} type="number" min="1"
                    value={row.mata || ''} onChange={e => updater(setEmboss)(i,'mata',e.target.value)}
                    placeholder="1" title="Jumlah mata dari Material Cost" />
                </td>
                <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setEmboss)(i,'diskon',e.target.value)} placeholder="0" /></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setEmboss(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. MATERIAL PROSES */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>4. Material Proses</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.matProses > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.matProses)}</span>}
            <button style={s.addBtn} onClick={() => setMatProses(p=>[...p, newMatProses()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Luas Permukaan','Harga Satuan','Qty','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {matProses.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {mpCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setMatProses)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:160 }} value={row.proses} onChange={e => updater(setMatProses)(i,'proses',e.target.value)}>
                    <option value="">-- pilih --</option>
                    {matProsesNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setMatProses)(i,'luas_permukaan',e.target.value)} placeholder="20x20" /></td>
                <td style={s.td}><div style={{ ...s.calc, color:'#16a34a' }}>{idr(row.harga_satuan)}</div></td>
                <td style={s.td}><input style={{ ...s.input, width:70 }} type="number" value={row.quantity} onChange={e => updater(setMatProses)(i,'quantity',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setMatProses)(i,'diskon',e.target.value)} placeholder="0" /></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setMatProses(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. FINISHING WO */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>5. Finishing WO</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.finishing > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.finishing)}</span>}
            <button style={s.addBtn} onClick={() => setFinishing(p=>[...p, newFinishing()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Spesifik','Harga/pcs','Diskon%','Subtotal (×qty)',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {finishing.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {finCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setFinishing)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:150 }} value={row.proses}
                    onChange={e => { updater(setFinishing)(i,'proses',e.target.value); updater(setFinishing)(i,'spesifik','') }}>
                    <option value="">-- pilih --</option>
                    {finishingProses.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:220 }} value={row.spesifik} onChange={e => updater(setFinishing)(i,'spesifik',e.target.value)}>
                    <option value="">-- pilih spesifik --</option>
                    {finishingSpecs(row.proses).map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={s.td}>
                  <div style={{ ...s.calc, color:'#16a34a' }}>{idr(row.harga_satuan)}</div>
                  {(row.pct_upah > 0 || row.pct_bahan > 0 || row.pct_mesin > 0) && (
                    <div style={{ fontSize:10.5, color:'#9ca3af', marginTop:2, whiteSpace:'nowrap' }} title="Split otomatis dari rumus % di Pricing Dataset">
                      U {idr(Math.round(row.upah_amount))} · B {idr(Math.round(row.bahan_amount))} · M {idr(Math.round(row.mesin_amount))}
                    </div>
                  )}
                </td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setFinishing)(i,'diskon',e.target.value)} placeholder="0" /></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setFinishing(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6. ADDITIONAL COST */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>6. Additional Cost</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.additional > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.additional)}</span>}
            <button style={s.addBtn} onClick={() => setAdditional(p=>[...p, newAdditional()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Detail','Qty','Harga/pcs','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {additional.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {addCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setAdditional)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:130 }} value={row.proses} onChange={e => updater(setAdditional)(i,'proses',e.target.value)}>
                    <option value="">-- pilih --</option>
                    {ADDITIONAL_PROSES.map(p=><option key={p}>{p}</option>)}
                  </select>
                </td>
                <td style={s.td}>
                  {row.proses === 'potong' ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input style={{ ...s.input, width:70 }} type="text" placeholder="PxL cm" value={row.luas_permukaan} onChange={e => updater(setAdditional)(i,'luas_permukaan',e.target.value)} />
                      <input style={{ ...s.input, width:80 }} type="number" placeholder="gsm" value={row.gramasi} onChange={e => updater(setAdditional)(i,'gramasi',e.target.value)} />
                    </div>
                  ) : row.proses === 'lem samping' ? (
                    <input style={{ ...s.input, width:100 }} type="number" placeholder="panjang(cm)" value={row.panjang_lem} onChange={e => updater(setAdditional)(i,'panjang_lem',e.target.value)} />
                  ) : (
                    <input style={{ ...s.input, width:180 }} value={row.keterangan} onChange={e => updater(setAdditional)(i,'keterangan',e.target.value)} placeholder="keterangan" />
                  )}
                </td>
                <td style={s.td}>
                  <input style={{ ...s.input, width:70 }} type="number" value={row.quantity} onChange={e => updater(setAdditional)(i,'quantity',e.target.value)} />
                </td>
                <td style={s.td}>
                  {(row.proses === 'potong' || row.proses === 'lem samping') ? (
                    <div style={s.calcGreen}>{row.harga > 0 ? idr(row.harga) : '—'}</div>
                  ) : (
                    <input style={{ ...s.input, width:110 }} type="number" value={row.harga} onChange={e => updater(setAdditional)(i,'harga',e.target.value)} placeholder="harga/pcs" />
                  )}
                </td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setAdditional)(i,'diskon',e.target.value)} placeholder="0" /></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setAdditional(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SUMMARY */}
      <div style={{ ...s.card, borderTop:`3px solid #16a34a` }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.dark, marginBottom:12 }}>Ringkasan Biaya</div>
            {[['Material Cost',sub.material],['Cetak Cost',sub.cetak],['Emboss / Laminasi',sub.emboss],
              ['Material Proses',sub.matProses],['Finishing WO',sub.finishing],['Additional Cost',sub.additional]
            ].map(([label,val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.cream}`, fontSize:13, color:C.dark }}>
                <span>{label}</span><span style={{ fontFamily:'monospace' }}>{idr(val)}</span>
              </div>
            ))}
            {hasVendorComparison && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.cream}`, fontSize:13, color:'#854F0B' }}>
                <span>Pembanding Vendor{vendorName ? ` (${vendorName})` : ''}</span><span style={{ fontFamily:'monospace' }}>{idr(vendorTotal)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:14, fontWeight:700, color:C.dark, borderTop:`2px solid ${C.border}`, marginTop:4 }}>
              <span>Total Modal</span><span>{idr(total)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.dark, marginBottom:12 }}>Harga Jual</div>
            <label style={{ fontSize:13, color:C.brown, display:'block', marginBottom:6 }}>Margin (%)</label>
            <input type="number" min="0" max="100" value={margin}
              onChange={e => setMargin(e.target.value)}
              style={{ ...s.input, width:100, fontSize:16, fontWeight:600, marginBottom:16 }} />
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:16 }}>
              <div style={{ fontSize:12, color:'#16a34a', marginBottom:4 }}>Harga Jual Total</div>
              <div style={{ fontSize:26, fontWeight:700, color:'#15803d' }}>{idr(selling)}</div>
              <div style={{ fontSize:13, color:'#16a34a', marginTop:6 }}>
                Per unit: {idr(perUnit)} &nbsp;|&nbsp; Qty: {fmt(activeQty)}
              </div>
            </div>
          </div>
        </div>
      {/* Panel Benchmarking Purchasing — muncul kalau purchasing sudah validasi.
          POSISI: sengaja di BAWAH, sesudah semua section biaya dan Ringkasan.
          Panel ini membandingkan harga estimator vs purchasing, jadi gunanya
          untuk MEMERIKSA hasil -- bukan bahan saat mulai mengisi. Ditaruh di
          atas, ia mendorong seluruh form ke bawah pada order yang sudah
          divalidasi. Permintaan revisi tetap di atas karena itu instruksi yang
          harus dibaca SEBELUM mulai mengerjakan. */}
      {purchasingData && purchasingData.comparisons.length > 0 && (() => {
        const C2 = { warn: '#92400e', warnBg: '#fffbeb', warnBorder: '#f59e0b', dangerBg: '#fef2f2', dangerText: '#b91c1c', successText: '#15803d', muted: '#6b7280' }
        const SECTION_LABEL = { material:'Material', cetak:'Cetak', emboss:'Emboss/Laminasi', mat_proses:'Material Proses', finishing:'Finishing WO', additional:'Additional Cost', vendor_total:'Vendor Total' }
        // Hanya tampilkan baris yang purchasing_price sudah diisi
        const filled = purchasingData.comparisons.filter(c => c.purchasing_price != null && c.purchasing_price !== '')
        // Pisahkan: perlu perhatian (+%) vs aman (-%)
        const needAttention = filled.filter(c => {
          if (!c.estimator_price || c.estimator_price === 0) return false
          return c.purchasing_price > c.estimator_price
        })
        const statusColor = purchasingData.status === 'approved' ? '#15803d' : purchasingData.status === 'hold' ? '#b45309' : '#b91c1c'
        const statusLabel = purchasingData.status === 'approved' ? 'Disetujui' : purchasingData.status === 'hold' ? 'Hold' : 'Cancel'
        const reviewDate = purchasingData.reviewedAt ? new Date(purchasingData.reviewedAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : ''
        return (
          <div style={{ marginBottom:20, border:`1px solid ${needAttention.length > 0 ? '#f59e0b' : '#86efac'}`, borderRadius:10, overflow:'hidden' }}>
            <div style={{ background: needAttention.length > 0 ? '#fffbeb' : '#f0fdf4', padding:'10px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${needAttention.length > 0 ? '#fde68a' : '#bbf7d0'}` }}>
              <span style={{ fontSize:15 }}>{needAttention.length > 0 ? '⚠️' : '✅'}</span>
              <span style={{ fontSize:13, fontWeight:600, color: needAttention.length > 0 ? C2.warn : '#15803d' }}>
                Hasil Validasi Purchasing
                {needAttention.length > 0 ? ` — ${needAttention.length} item perlu diperhatikan` : ' — Semua harga estimator sudah sesuai'}
              </span>
              <span style={{ marginLeft:'auto', fontSize:11, color: statusColor, fontWeight:600, background: purchasingData.status === 'approved' ? '#dcfce7' : purchasingData.status === 'hold' ? '#fef3c7' : '#fee2e2', padding:'2px 10px', borderRadius:20 }}>
                {statusLabel}
              </span>
              {reviewDate && <span style={{ fontSize:11, color: C2.muted }}>{reviewDate}</span>}
            </div>
            <div style={{ background:'#fff', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    {['Section','Item','Harga Estimator','Harga Purchasing','Selisih'].map(h => (
                      <th key={h} style={{ padding:'7px 12px', textAlign: h.startsWith('Harga')||h==='Selisih' ? 'right' : 'left', fontWeight:500, color: C2.muted, fontSize:11, borderBottom:`1px solid #f3f4f6` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filled.map((c, i) => {
                    const pct = c.estimator_price && c.estimator_price > 0
                      ? Math.round(((c.purchasing_price - c.estimator_price) / c.estimator_price) * 100)
                      : null
                    const isHigh = pct !== null && pct > 0
                    const idr = v => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : '—'
                    return (
                      <tr key={i} style={{ background: isHigh ? C2.dangerBg : 'transparent', borderBottom:'1px solid #f3f4f6' }}>
                        <td style={{ padding:'7px 12px', color: C2.muted, fontSize:11, whiteSpace:'nowrap' }}>{SECTION_LABEL[c.section] || c.section}</td>
                        <td style={{ padding:'7px 12px', color:'#111827', maxWidth:200 }}>{c.item_name || '—'}</td>
                        <td style={{ padding:'7px 12px', textAlign:'right', color:'#374151' }}>{idr(c.estimator_price)}</td>
                        <td style={{ padding:'7px 12px', textAlign:'right', fontWeight: isHigh ? 600 : 400, color: isHigh ? C2.dangerText : '#374151' }}>{idr(c.purchasing_price)}</td>
                        <td style={{ padding:'7px 12px', textAlign:'right', fontWeight:600, color: isHigh ? C2.dangerText : C2.successText, whiteSpace:'nowrap' }}>
                          {pct !== null ? (pct > 0 ? `+${pct}%` : `${pct}%`) : '—'}
                          {isHigh ? ' ⚠' : pct !== null ? ' ✓' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ padding:'8px 14px', borderTop:'1px solid #f3f4f6', fontSize:11, color: C2.muted }}>
                {needAttention.length > 0
                  ? '⬆ Baris merah = harga estimator lebih rendah dari purchasing. Perlu direvisi di section terkait.'
                  : '✓ Tidak ada item yang harga estimator lebih rendah dari purchasing.'}
              </div>
            </div>
          </div>
        )
      })()}

        <div style={{ marginTop:24, display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button onClick={() => navigate(queuePath)} style={{ padding:'10px 20px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:'pointer', color:C.dark }}>
            Kembali
          </button>
          <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
            {saving ? 'Menyimpan...' : (() => {
              const remaining = qtyList.filter(q => q !== activeQty && !savedQtys.includes(q)).length
              if (qtyList.length <= 1) return '💾 Simpan & Selesai'
              return remaining > 0
                ? `💾 Simpan Qty ${fmt(activeQty)} & Lanjut`
                : `💾 Simpan Qty ${fmt(activeQty)} & Selesai Semua`
            })()}
          </button>
        </div>
      </div>
    </Layout>
  )
}






