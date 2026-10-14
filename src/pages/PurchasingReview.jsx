import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import SalinOrderLama from '../components/SalinOrderLama'

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

// Status deal dari Sales (quotations.deal_status). Nilai yang ada di database:
// deal / followup / no_deal / quoted. Dipakai purchasing untuk tahu mana
// pekerjaan prioritas (sudah Deal) dan mana yang sekadar minta validasi.
const DEAL_LABEL = { deal:'Deal', followup:'Follow Up', no_deal:'Tidak Deal', quoted:'Quoted' }
const DEAL_COLOR = { deal:'#3B6D11', followup:'#854F0B', no_deal:'#A32D2D', quoted:'#5f5e5a' }
const DEAL_BG = { deal:'#EAF3DE', followup:'#FAEEDA', no_deal:'#FCEBEB', quoted:'#f1efe8' }

export default function PurchasingReview() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [quotation,   setQuotation]   = useState(null)
  const [request,     setRequest]     = useState(null)
  const [comparisons, setComparisons] = useState({})
  // Kunci baris yang BENAR-BENAR diubah user di sesi ini (format
  // `${sectionKey}-${rowIndex}`). Saat simpan, HANYA baris inilah yang
  // ditulis ke database -- baris milik akun purchasing lain yang sedang
  // mengisi area berbeda tidak disentuh sama sekali.
  const [dirtyKeys,   setDirtyKeys]   = useState(() => new Set())
  const [notes,       setNotes]       = useState('')
  const [loading,     setLoading]     = useState(true)
  const [savingDraft,  setSavingDraft]  = useState(false)
  const [draftSaved,   setDraftSaved]   = useState(false)
  // Permintaan revisi ke estimator. SENGAJA dipisah dari `notes`
  // (purchasing_notes): notes itu catatan biasa yang ikut tersimpan setiap
  // Save Proyeksi, sedangkan ini pernyataan eksplisit "ada yang harus
  // diperbaiki estimator". Lihat supabase/purchasing_revisi_migration.sql.
  const [revisionNote,  setRevisionNote]  = useState('')
  const [needsRevision, setNeedsRevision] = useState(false)
  const [sendingRev,    setSendingRev]    = useState(false)
  // Modal "Salin harga purchasing dari Kode Order lama" (repeat order).
  const [salinOpen, setSalinOpen] = useState(false)
  const [salinInfo, setSalinInfo] = useState(null)
  const [dbAdditional,setDbAdditional]= useState([])
  const [finSplitRules, setFinSplitRules] = useState({}) // proses -> { pct_upah, pct_bahan, pct_mesin }

  useEffect(() => { loadAll() }, [quotationId])

  // Auto-refresh dinonaktifkan — purchasing bisa refresh manual kalau perlu
  // useEffect(() => {
  //   const interval = setInterval(() => { loadAll() }, 30000)
  //   return () => clearInterval(interval)
  // }, [quotationId])

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
    // PENTING: pakai q.id, BUKAN quotationId dari URL. Kalau estimator sudah
    // simpan ulang, blok di atas memindahkan q ke quotation yang baru --
    // dan harga pembanding purchasing juga sudah ikut dipindahkan ke sana
    // oleh Calculator.jsx. Membaca pakai id URL yang sudah mati membuat
    // seluruh harga terlihat hilang padahal masih ada.
    const { data: comps } = await supabase.from('purchasing_comparisons').select('*').eq('quotation_id', q.id)
    const { data: addlMaster } = await supabase.from('raw_materials').select('id,name,price,rate_per_kg,rate_a,rate_b,minimum_charge').eq('category','additional')
    const { data: finRules } = await supabase.from('finishing_wo_split_rules').select('*')
    setFinSplitRules(Object.fromEntries((finRules || []).map(r => [r.proses, r])))

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
    setNeedsRevision(!!q.needs_revision)
    setLoading(false)
  }

  function updatePrice(sectionKey, rowIndex, value, estimatorPrice, itemName) {
    const key = `${sectionKey}-${rowIndex}`
    setDirtyKeys(prev => new Set(prev).add(key))
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

  // Finishing WO: purchasing isi 3 komponen manual (Upah/Bahan Baku/Mesin),
  // purchasing_price (total, dipakai semua kalkulasi selisih & total yang sudah ada)
  // otomatis = jumlah ketiganya.
  function updateFinishingPart(rowIndex, part, value, estimatorPrice, itemName) {
    const key = `finishing_wo-${rowIndex}`
    setDirtyKeys(prev => new Set(prev).add(key))
    setComparisons(prev => {
      const cur = prev[key] || {}
      const parts = {
        purchasing_upah: cur.purchasing_upah ?? null,
        purchasing_bahan: cur.purchasing_bahan ?? null,
        purchasing_mesin: cur.purchasing_mesin ?? null,
        [`purchasing_${part}`]: value === '' ? null : Number(value),
      }
      const filled = [parts.purchasing_upah, parts.purchasing_bahan, parts.purchasing_mesin].filter(v => v != null)
      const total = filled.length > 0 ? filled.reduce((a, b) => a + Number(b), 0) : null
      return {
        ...prev,
        [key]: { ...cur, ...parts, purchasing_price: total, estimator_price: estimatorPrice, item_name: itemName },
      }
    })
  }

  // ── Salin harga purchasing dari order lama (repeat order) ──────────────
  //
  // Dicocokkan lewat NAMA ITEM di dalam section yang sama, bukan posisi baris.
  // Dua order berbeda hampir pasti punya urutan baris yang berbeda, jadi
  // menyalin per posisi akan menempelkan harga ke item yang salah.
  //
  // Dua aturan yang disengaja:
  //   1. Baris yang SUDAH ada harganya TIDAK ditimpa. Hasil kerja sendiri (atau
  //      rekan yang sedang mengisi area lain) tidak boleh hilang karena salin.
  //   2. Baris yang namanya tidak ada di order lama dibiarkan kosong, supaya
  //      jelas mana yang masih perlu dicek manual.
  function normNamaItem(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return (s === '' || s === '—' || s === '-') ? '' : s
  }

  async function salinHargaDariOrderLama(sumber) {
    const { data: comps, error } = await supabase
      .from('purchasing_comparisons').select('*').eq('quotation_id', sumber.id)
    if (error) throw error

    const peta = {}
    ;(comps || []).forEach(c => {
      if (c.purchasing_price == null || c.purchasing_price === '') return
      const nama = normNamaItem(c.item_name)
      if (!nama) return
      if (!peta[c.section]) peta[c.section] = {}
      // Item kembar: yang pertama menang, supaya hasilnya tidak bergantung
      // pada urutan baris yang dikembalikan database.
      if (!(nama in peta[c.section])) peta[c.section][nama] = c
    })

    const next  = { ...comparisons }
    const dirty = new Set(dirtyKeys)
    let terisi = 0, dilewati = 0, tidakKetemu = 0

    SECTIONS.forEach(sec => {
      const rows = quotation?.[sec.key]
      if (!Array.isArray(rows)) return
      const cols = SECTION_COLS[sec.key] || []
      const priceCol = cols.find(c => c.priceField)
      rows.forEach((row, i) => {
        const key  = `${sec.key}-${i}`
        const ada  = next[key]?.purchasing_price
        if (ada != null && ada !== '') { dilewati++; return }

        const label  = cols[0]?.render(row) || ''
        const sumberBaris = peta[sec.dbSection]?.[normNamaItem(label)]
        if (!sumberBaris) { tidakKetemu++; return }

        const estPrice = sec.key === 'additional_cost'
          ? resolveAdditionalHarga(row)
          : (priceCol ? (Number(row[priceCol.priceField]) || 0) : 0)

        next[key] = {
          ...(next[key] || {}),
          purchasing_price: Number(sumberBaris.purchasing_price),
          purchasing_upah:  sumberBaris.purchasing_upah  ?? null,
          purchasing_bahan: sumberBaris.purchasing_bahan ?? null,
          purchasing_mesin: sumberBaris.purchasing_mesin ?? null,
          estimator_price:  Number(estPrice) || 0,
          item_name: label || `Row ${i + 1}`,
        }
        dirty.add(key)
        terisi++
      })
    })

    setComparisons(next)
    setDirtyKeys(dirty)
    setSalinInfo({
      kode: sumber.kode_order || sumber.customer_name || 'order lama',
      terisi, dilewati, tidakKetemu,
    })
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

  // Total harga purchasing lengkap:
  // - Item yang sudah diisi purchasing → pakai harga purchasing × qty
  // - Item yang belum diisi → pakai harga estimator (subtotal) sebagai fallback
  const totalPurchasingWithFallback = (() => {
    if (!quotation) return null
    const SECTIONS = ['material_cost','cetak_cost','emboss_laminasi','material_proses','finishing_wo','additional_cost']
    let total = 0
    SECTIONS.forEach(secKey => {
      const rows = quotation[secKey]
      if (!Array.isArray(rows)) return
      rows.forEach((row, i) => {
        const c = comparisons[`${secKey}-${i}`]
        const qty = Number(row.quantity || quotation.quantity || 0)
        if (c?.purchasing_price != null && c.purchasing_price !== '') {
          // Sudah diisi purchasing: harga/pcs × qty
          total += Number(c.purchasing_price) * qty
        } else {
          // Belum diisi: fallback ke subtotal estimator
          total += Number(row.subtotal || 0)
        }
      })
    })
    return total
  })()

  // Harga purchasing per pcs
  const purchasingPerUnit = totalPurchasingWithFallback != null && quotation?.quantity > 0
    ? totalPurchasingWithFallback / quotation.quantity
    : null

  // Simpan HANYA baris yang diubah user di sesi ini.
  //
  // Versi lama MENGHAPUS SEMUA baris purchasing_comparisons milik 1 quotation
  // lalu insert ulang isi layarnya sendiri. Akibatnya dua akun purchasing
  // tidak bisa kerja bersamaan: saat Hamam menyimpan Material Cost, baris
  // Cetak Cost milik Nisa ikut terhapus -- padahal areanya beda. Sekarang
  // pakai UPSERT per baris lewat unique key (quotation_id, section,
  // row_index), lihat supabase/purchasing_multiuser_migration.sql.
  async function saveComparisons() {
    const keys = Array.from(dirtyKeys)
    if (keys.length === 0) return true

    // Sasaran penyimpanan adalah quotation yang SEDANG DITAMPILKAN, bukan id
    // di URL. Keduanya berbeda kalau estimator menyimpan ulang sementara
    // purchasing membuka halaman ini: loadAll() ikut pindah ke versi baru,
    // jadi penyimpanan harus ikut pindah juga. Kalau tidak, harga tersimpan
    // di baris yang sudah is_active=false dan tidak pernah terbaca lagi.
    const targetId = quotation?.id || quotationId

    const toUpsert = []
    const toDelete = []
    keys.forEach(key => {
      const lastDash = key.lastIndexOf('-')
      const sectionKey = key.slice(0, lastDash)
      const rowIndex = Number(key.slice(lastDash + 1))
      const section = SECTION_DB_MAP[sectionKey] || sectionKey
      const c = comparisons[key] || {}
      if (c.purchasing_price == null || c.purchasing_price === '') {
        // User mengosongkan baris ini -- hapus baris ITU saja.
        toDelete.push({ section, rowIndex })
      } else {
        toUpsert.push({
          quotation_id: targetId,
          section,
          row_index: rowIndex,
          item_name: c.item_name || null,
          estimator_price: c.estimator_price ?? null,
          purchasing_price: c.purchasing_price,
          purchasing_upah: c.purchasing_upah ?? null,
          purchasing_bahan: c.purchasing_bahan ?? null,
          purchasing_mesin: c.purchasing_mesin ?? null,
          updated_at: new Date().toISOString(),
        })
      }
    })

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from('purchasing_comparisons')
        .upsert(toUpsert, { onConflict: 'quotation_id,section,row_index' })
      if (error) {
        console.error('Gagal simpan comparisons:', error)
        alert('Gagal menyimpan harga pembanding: ' + error.message)
        return false
      }
    }

    for (const d of toDelete) {
      const { error } = await supabase
        .from('purchasing_comparisons')
        .delete()
        .eq('quotation_id', targetId)
        .eq('section', d.section)
        .eq('row_index', d.rowIndex)
      if (error) {
        console.error('Gagal hapus baris pembanding:', error)
        alert('Gagal menghapus baris pembanding: ' + error.message)
        return false
      }
    }

    setDirtyKeys(new Set())
    return true
  }

  // Purchasing tidak bisa menambah baris item -- hanya estimator yang bisa.
  // Jadi kalau ada item yang tertinggal, satu-satunya jalan adalah meminta
  // estimator memperbaiki. Ini membuat permintaan itu tercatat di aplikasi,
  // bukan lewat WhatsApp yang tidak ada jejaknya.
  //
  // Tidak ada tombol "revisi selesai": begitu estimator menyimpan ulang,
  // Calculator.jsx membuat baris quotation baru yang needs_revision-nya
  // default false. Revisi beres karena diperbaiki, bukan karena diklik.
  async function requestRevision(cancel = false) {
    const catatan = revisionNote.trim()
    if (!cancel && !catatan) {
      alert('Tulis dulu apa yang harus diperbaiki estimator, supaya dia tahu yang mana.')
      return
    }
    if (cancel && !confirm('Batalkan permintaan revisi ini?')) return

    setSendingRev(true)
    const targetId = quotation?.id || quotationId
    // Status purchasing ikut dipindah ke HOLD, bukan dibiarkan 'pending'.
    //
    // Alasannya soal kejujuran antrean: 'pending' (Belum Diputuskan) berarti
    // "bolanya di purchasing". Selama item belum lengkap, bolanya justru di
    // estimator -- purchasing tidak bisa memutuskan apa pun. Kalau dibiarkan
    // 'pending', order ini menumpuk di kartu "Menunggu Validasi" dan membuat
    // angka prioritas purchasing bohong.
    //
    // Beda "hold karena minta revisi" dan "hold karena alasan lain" dibawa
    // oleh needs_revision, jadi keduanya tetap bisa dipisah di filter.
    const { data, error } = await supabase.from('quotations').update(
      cancel
        ? {
            needs_revision: false,
            revision_requested_at: null,
            revision_requested_by: null,
            // Permintaan dibatalkan -> bola kembali ke purchasing.
            purchasing_status: 'pending',
          }
        : {
            needs_revision: true,
            revision_note: catatan,
            revision_requested_at: new Date().toISOString(),
            revision_requested_by: profile?.id || null,
            purchasing_status: 'hold',
          }
    ).eq('id', targetId).select('id')

    if (error) {
      console.error('Gagal mengirim permintaan revisi:', error)
      alert('Gagal mengirim permintaan revisi: ' + error.message)
      setSendingRev(false)
      return
    }
    // PostgREST: UPDATE yang ditolak RLS mengenai 0 baris TANPA error.
    // Tanpa .select('id') ini akan terlihat "berhasil" padahal tidak tersimpan.
    if (!data || data.length === 0) {
      alert('Permintaan revisi TIDAK tersimpan — tidak ada baris yang berubah.\n\nKemungkinan akun Anda belum punya izin mengubah quotation ini.')
      setSendingRev(false)
      return
    }
    setNeedsRevision(!cancel)
    setSendingRev(false)
    // Muat ulang supaya header & status di layar ikut menunjukkan Hold.
    loadAll()
  }

  async function saveProyeksi() {
    setSavingDraft(true)
    const saved = await saveComparisons()
    if (saved) {
      // Simpan notes ke quotations — pakai quotation.id yang sudah di-load
      // (mungkin berbeda dari URL kalau estimator sudah save ulang)
      const targetId = quotation?.id || quotationId
      const { data: updated, error: notesErr } = await supabase.from('quotations').update({
        purchasing_notes: notes || null,
        // Menandai order ini SUDAH DIPROYEKSI oleh purchasing. Keputusan
        // Disetujui/Hold/Cancel terpisah, dipilih di halaman Antrian.
        purchasing_projected_at: new Date().toISOString(),
        purchasing_projected_by: profile?.id || null,
      }).eq('id', targetId).select('id')
      if (notesErr) {
        console.error('Gagal simpan catatan purchasing:', notesErr)
        alert('Gagal menyimpan catatan: ' + notesErr.message)
        setSavingDraft(false)
        return
      }
      if (!updated || updated.length === 0) {
        alert('Catatan TIDAK tersimpan — tidak ada baris yang berubah.\n\nHarga pembanding sudah tersimpan, tapi catatan gagal. Kemungkinan akun Anda belum punya izin mengubah quotation ini.')
        setSavingDraft(false)
        return
      }
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2500)
    }
    setSavingDraft(false)
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

      {/* Repeat order: tarik harga purchasing dari order lama, lalu tinggal
          dicek yang berubah. Ditaruh paling atas supaya terlihat SEBELUM
          purchasing mulai mengisi harga satu per satu. */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={() => setSalinOpen(true)} style={{
          padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`,
          background:'#fff', fontSize:13, fontWeight:600, color:C.dark, cursor:'pointer',
        }}>📄 Salin harga dari Kode Order lama</button>
        <span style={{ fontSize:11, color:'#9ca3af' }}>
          Untuk repeat order — harga lama diisikan ke item dengan nama yang sama. Harga yang sudah Anda isi tidak ditimpa.
        </span>
        {salinInfo && (
          <span style={{
            fontSize:11.5, fontWeight:600, color:'#3b6d11', background:'#f0fdf4',
            border:'1px solid #bbf7d0', borderRadius:20, padding:'3px 10px',
          }} title={`Dilewati karena sudah ada harganya: ${salinInfo.dilewati}\nTidak ketemu di order lama: ${salinInfo.tidakKetemu}`}>
            ✓ {salinInfo.terisi} harga terisi dari {salinInfo.kode}
            {salinInfo.tidakKetemu > 0 ? ` · ${salinInfo.tidakKetemu} item perlu dicek manual` : ''}
            {' '}— belum tersimpan, tekan Save Proyeksi
          </span>
        )}
      </div>

      {salinOpen && (
        <SalinOrderLama
          mode="cogs"
          excludeId={quotation?.id}
          onPick={salinHargaDariOrderLama}
          onClose={() => setSalinOpen(false)}
        />
      )}

      {/* Keputusan purchasing dicabut karena estimator mengubah perhitungan.
          Ditaruh di atas Header Info supaya terbaca sebelum purchasing mulai
          memeriksa angkanya. */}
      {quotation.decision_reset_note && (
        <div style={{ marginBottom:18, border:'1px solid #FCD34D', borderRadius:10, overflow:'hidden' }}>
          <div style={{ background:'#FFFBEB', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:10 }}>
            <span style={{ fontSize:15, lineHeight:1.4 }}>↻</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#92400E', marginBottom:4 }}>
                Keputusan sebelumnya sudah tidak berlaku
              </div>
              <div style={{ fontSize:13, color:'#78350F', lineHeight:1.6 }}>
                {quotation.decision_reset_note}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderLeft:`4px solid ${C.orange}`, borderRadius:10, padding:'14px 18px', marginBottom:18 }}>
        {/* Kode Order + Status Deal — penanda apakah ini pekerjaan prioritas.
            Ditaruh di baris sendiri, bukan ditambahkan ke grid 7 kolom di
            bawah, supaya tidak makin sempit dan tetap terbaca sekilas. */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:28, flexWrap:'wrap', marginBottom:12, paddingBottom:12, borderBottom:`0.5px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:3 }}>Kode Order</div>
            {quotation.kode_order ? (
              <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:600, color:C.dark }}>{quotation.kode_order}</div>
            ) : (
              <div style={{ fontSize:12, color:'#b45309', fontWeight:500 }} title="Sales belum mengisi Kode Order, jadi order ini belum tersambung ke order ERP">⚠️ Belum ditagging Sales</div>
            )}
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:3 }}>Status Deal</div>
            <span style={{
              padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:600,
              background: DEAL_BG[quotation.deal_status] || '#f3f4f6',
              color: DEAL_COLOR[quotation.deal_status] || '#6b7280',
            }}>{DEAL_LABEL[quotation.deal_status] || 'Belum diisi Sales'}</span>
          </div>
        </div>

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
            <div style={{ fontWeight:500 }}>{idr(quotation.total_cost)}</div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>
              ≈ {idr(quotation.quantity > 0 ? Math.round(quotation.total_cost / quotation.quantity) : 0)} /pcs
              <span style={{ marginLeft:6, opacity:0.7 }}>(modal)</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Harga Purchasing</div>
            <div style={{ fontWeight:500, color: totalPurchasingWithFallback != null ? C.dark : '#9ca3af' }}>
              {totalPurchasingWithFallback != null ? idr(Math.round(totalPurchasingWithFallback)) : '—'}
            </div>
            {purchasingPerUnit != null && (
              <div style={{ fontSize:11, color:'#9ca3af' }}>≈ {idr(Math.round(purchasingPerUnit))} /pcs</div>
            )}
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Selisih Total</div>
            {(() => {
              const diff = totalPurchasingWithFallback - (quotation.total_cost || 0)
              return (
                <div style={{ fontWeight:500, color: totalPurchasingWithFallback == null ? '#9ca3af' : diff > 0 ? '#A32D2D' : diff < 0 ? '#3b6d11' : C.dark }}>
                  {totalPurchasingWithFallback != null
                    ? `${diff > 0 ? '+' : ''}${idr(Math.round(diff))}`
                    : '—'}
                </div>
              )
            })()}
          </div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Dikirim</div><div style={{ fontWeight:500 }}>{quotation.sent_to_purchasing_at ? new Date(quotation.sent_to_purchasing_at).toLocaleDateString('id-ID') : '—'}</div></div>
        </div>
        {hasAtLeastOnePrice && (
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
            * Harga Purchasing = item terisi pakai harga purchasing, item belum diisi fallback ke subtotal estimator. Harga Estimator = total modal (tanpa margin). Selisih Total = Purchasing − Modal Estimator.
          </div>
        )}

        {/* Gambar Referensi dari Sales */}
        {(() => {
          const imgs = Array.isArray(request?.reference_images) && request.reference_images.length > 0
            ? request.reference_images
            : (request?.reference_image ? [request.reference_image] : [])
          if (imgs.length === 0) return null
          return (
            <div style={{ marginTop:12, borderTop:`0.5px solid ${C.border}`, paddingTop:12 }}>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>🖼️ Gambar Referensi</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {imgs.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" title="Klik untuk perbesar">
                    <img
                      src={url}
                      alt={`referensi-${i+1}`}
                      style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:`0.5px solid ${C.border}`, cursor:'pointer', display:'block' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )
        })()}
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
                    {sec.key === 'finishing_wo' ? (
                      <>
                        <th style={{ ...thPurch }}>Upah<br /><span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(Purchasing)</span></th>
                        <th style={{ ...thPurch, borderLeft:'none' }}>Bahan Baku<br /><span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(Purchasing)</span></th>
                        <th style={{ ...thPurch, borderLeft:'none' }}>Mesin<br /><span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(Purchasing)</span></th>
                        <th style={{ ...thPurch, borderLeft:'none' }}>Total<br /><span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(Purchasing)</span></th>
                      </>
                    ) : (
                      <th style={{ ...thPurch }}>
                        Harga/pcs<br />
                        <span style={{ fontWeight:400, fontSize:10, color:'#378ADD' }}>(Purchasing)</span>
                      </th>
                    )}
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
                        {cols.map((col, ci) => {
                          // Finishing WO: breakdown Upah/Bahan Baku/Mesin dihitung LIVE dari
                          // Harga/pcs × rumus % proses saat ini (bukan snapshot lama tersimpan),
                          // supaya quotation lama pun ikut kebagian begitu rumusnya diisi/diubah.
                          const splitRule = sec.key === 'finishing_wo' && col.priceField === 'harga_satuan'
                            ? finSplitRules[row.proses] : null
                          return (
                            <td key={ci} style={{ ...tdEst, textAlign: col.align }}>
                              {col.render(row)}
                              {splitRule && (Number(splitRule.pct_upah) > 0 || Number(splitRule.pct_bahan) > 0 || Number(splitRule.pct_mesin) > 0) && (
                                <div style={{ fontSize:10, color:'#9ca3af', fontWeight:400, marginTop:2 }} title="Split otomatis estimator (rumus % Pricing Dataset)">
                                  U {idr(Math.round(Number(row.harga_satuan) * Number(splitRule.pct_upah) / 100))} · B {idr(Math.round(Number(row.harga_satuan) * Number(splitRule.pct_bahan) / 100))} · M {idr(Math.round(Number(row.harga_satuan) * Number(splitRule.pct_mesin) / 100))}
                                </div>
                              )}
                            </td>
                          )
                        })}
                        {/* Input harga purchasing */}
                        {sec.key === 'finishing_wo' ? (
                          <>
                            {['upah','bahan','mesin'].map(part => (
                              <td key={part} style={{ ...tdPurch, borderLeft: part === 'upah' ? undefined : 'none' }}>
                                <input
                                  type="number"
                                  style={{
                                    width:70, padding:'5px 6px', border:`1px solid ${comp[`purchasing_${part}`] != null ? '#378ADD' : C.border}`,
                                    borderRadius:6, fontSize:12, textAlign:'right',
                                    background:'#fff', color:C.dark, outline:'none',
                                  }}
                                  placeholder="—"
                                  value={comp[`purchasing_${part}`] ?? ''}
                                  onChange={e => updateFinishingPart(
                                    i, part, e.target.value,
                                    Number(estPriceRaw) || 0,
                                    cols[0]?.render(row) || `Row ${i+1}`
                                  )}
                                />
                              </td>
                            ))}
                            <td style={{ ...tdPurch, borderLeft:'none', fontWeight:600 }}>
                              {purchPrice != null ? idr(purchPrice) : <span style={{ color:'#d1d5db', fontWeight:400 }}>belum diisi</span>}
                            </td>
                          </>
                        ) : (
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
                        )}
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

      {/* Minta revisi ke estimator. Dipisah dari kotak Catatan di atas supaya
          jelas bedanya: Catatan dibaca Sales/Manager, yang ini TUGAS untuk
          estimator dan memunculkan badge di Antrian Estimator. */}
      <div style={{
        background: needsRevision ? '#FFFBEB' : '#fff',
        border: `1px solid ${needsRevision ? '#FCD34D' : C.border}`,
        borderRadius:10, padding:16, marginBottom:18,
      }}>
        <label style={{ fontSize:13, fontWeight:600, color:C.dark, display:'block', marginBottom:4 }}>
          Minta Revisi ke Estimator
        </label>
        <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8, lineHeight:1.5 }}>
          Dipakai kalau ada <strong>item yang belum diinput estimator</strong> — purchasing tidak
          bisa menambah baris item sendiri. Permintaan ini muncul sebagai badge di Antrian
          Estimator, dan hilang sendiri setelah estimator menyimpan perhitungan yang sudah
          diperbaiki.
          <br />
          Status order ini otomatis jadi <strong>Hold</strong> selama menunggu, supaya tidak
          ikut terhitung di <em>Menunggu Validasi</em> — bolanya memang sedang di estimator.
          Harga yang sudah Anda isi tetap tersimpan.
        </div>
        <textarea rows={3} value={revisionNote} onChange={e => setRevisionNote(e.target.value)}
          placeholder="Contoh: Item Hot Print pada cover belum masuk perhitungan, tolong ditambahkan."
          style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, resize:'vertical', boxSizing:'border-box', color:C.dark, outline:'none' }}
        />
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:10, flexWrap:'wrap' }}>
          <button onClick={() => requestRevision(false)} disabled={sendingRev}
            style={{ padding:'9px 16px', borderRadius:7, border:'none', fontSize:13, fontWeight:600,
                     cursor: sendingRev ? 'not-allowed' : 'pointer',
                     background: sendingRev ? '#d1d5db' : '#B45309', color:'#fff' }}>
            {sendingRev ? 'Mengirim...' : needsRevision ? '↻ Perbarui Permintaan' : '📋 Minta Revisi ke Estimator'}
          </button>
          {needsRevision && (
            <>
              <button onClick={() => requestRevision(true)} disabled={sendingRev}
                style={{ padding:'9px 16px', borderRadius:7, border:`1px solid ${C.border}`, background:'#fff',
                         fontSize:13, color:'#6b7280', cursor: sendingRev ? 'not-allowed' : 'pointer' }}>
                ✕ Batalkan Permintaan
              </button>
              <span style={{ fontSize:12, color:'#92400E', fontWeight:600 }}>
                ⚠ Sedang menunggu estimator
              </span>
            </>
          )}
        </div>
      </div>

      {/* Save Proyeksi — satu-satunya aksi di halaman ini.
          Keputusan Disetujui / Hold / Cancel TIDAK lagi di sini; dipilih lewat
          dropdown di halaman Antrian Purchasing, mengikuti pola dropdown
          status deal di dashboard Sales. Halaman ini murni untuk mengerjakan
          dan menyimpan proyeksi biaya. */}
      <div style={{ marginBottom:12 }}>
        <button onClick={saveProyeksi} disabled={savingDraft || !hasAtLeastOnePrice}
          style={{ width:'100%', padding:14, borderRadius:8, border:'none', fontSize:14, fontWeight:600, cursor: hasAtLeastOnePrice && !savingDraft ? 'pointer' : 'not-allowed', background: hasAtLeastOnePrice ? '#3b6d11' : '#d1d5db', color:'#fff' }}>
          {savingDraft ? 'Menyimpan...' : draftSaved ? '✓ Proyeksi tersimpan' : '💾 Save Proyeksi'}
        </button>
        <div style={{ fontSize:11, color:'#9ca3af', textAlign:'center', marginTop:6, lineHeight:1.5 }}>
          Menyimpan proyeksi biaya dan menandai order ini <strong>Sudah Diproyeksi</strong>.<br />
          Boleh disimpan berkali-kali — rekan tetap bisa melanjutkan area yang lain.<br />
          Keputusan Disetujui / Hold / Cancel dipilih di halaman Antrian Purchasing.
        </div>
      </div>
    </Layout>
  )
}



