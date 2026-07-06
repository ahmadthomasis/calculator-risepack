// ── Helper bersama modul Prodev (FPS/FSA) ────────────────────────────────────

export const FORM_TYPE_LABEL = {
  fps: 'FPS — Permintaan Sampel',
  fsa: 'FSA — Simulasi Artwork',
}
export const FORM_TYPE_SHORT = { fps: 'FPS', fsa: 'FSA' }

export const JENIS_KEMASAN_OPTIONS = [
  'Softbox', 'Hardbox', 'Corrugated Box', 'Stiker', 'Paper Bag', 'Packaging Lainnya',
]

export const URGENSI_OPTIONS = ['Presentasi', 'Pitching', 'Dikirim', 'Difoto']

export const STATUS_JASA_LABEL = {
  non_jasa_desain: 'Non Jasa Desain',
  jasa_desain: 'Jasa Desain',
}

export const KEPUASAN_LABEL = { puas: 'Puas', tidak_puas: 'Tidak Puas' }
export const DEAL_LABEL     = { deal: 'Deal', follow_up: 'Follow up' }
export const BAYAR_LABEL    = { gratis: 'Gratis', bayar: 'Bayar' }

// ── Status pengerjaan diturunkan dari tanggal, bukan disimpan terpisah, supaya
//    tidak pernah ada dua sumber kebenaran yang bisa saling bertentangan. ──
export function deriveStatus(o) {
  if (o.is_cancelled)              return 'cancelled'
  if (!o.tanggal_selesai_layout)   return 'layout'   // menunggu/proses layout
  if (!o.tanggal_selesai_rakit)    return 'rakit'    // layout selesai, proses rakit
  if (!o.status_diterima_sales)    return 'terima'   // rakit selesai, menunggu diterima sales
  return 'selesai'
}

export const STATUS_LABEL = {
  layout:    'Proses Layout',
  rakit:     'Proses Rakit',
  terima:    'Menunggu Diterima',
  selesai:   'Selesai',
  cancelled: 'Dibatalkan',
}

export const STATUS_COLOR = {
  layout:    '#d97706',
  rakit:     '#2563eb',
  terima:    '#7c3aed',
  selesai:   '#16a34a',
  cancelled: '#9ca3af',
}

// ── Status waktu: bandingkan tanggal selesai vs deadline ────────────────────
// Aturan (keputusan user): selesai SEBELUM deadline = Excellent,
// TEPAT di deadline = Tepat Waktu, LEWAT deadline = Terlambat.
// String ISO 'YYYY-MM-DD' aman dibandingkan langsung secara leksikografis.
export function statusWaktu(tanggalSelesai, deadline) {
  if (!tanggalSelesai || !deadline) return null
  const a = String(tanggalSelesai).slice(0, 10)
  const b = String(deadline).slice(0, 10)
  if (a < b) return 'Excellent'
  if (a === b) return 'Tepat Waktu'
  return 'Terlambat'
}

export const WAKTU_COLOR = {
  'Excellent':  '#15803d',
  'Tepat Waktu':'#2563eb',
  'Terlambat':  '#dc2626',
}

// Lama pengerjaan dalam hari (tanggal pengajuan → selesai rakit)
export function lamaHari(dari, sampai) {
  if (!dari || !sampai) return null
  const d1 = new Date(String(dari).slice(0, 10))
  const d2 = new Date(String(sampai).slice(0, 10))
  return Math.round((d2 - d1) / 86400000)
}

export const todayStr = () => {
  // Tanggal lokal (bukan UTC) supaya tidak mundur sehari saat malam WIB
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const fmtDate = (s) => {
  if (!s) return '—'
  return new Date(String(s).slice(0, 10)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Integrasi Pacdora (Level 1) ─────────────────────────────────────────────
// Bucket storage untuk file prodev (desain konsumen + hasil layout).
export const PRODEV_BUCKET = 'prodev-files'

// Tipe file desain/hasil yang diterima (bukan cuma gambar).
export const DESIGN_FILE_ACCEPT = '.pdf,.ai,.cdr,.eps,.svg,.zip,.rar,image/*'

// Halaman katalog dieline Pacdora — fallback kalau order belum punya template_url.
export const PACDORA_DIELINES_URL = 'https://www.pacdora.com/dielines'

// URL "Buka Template" untuk sebuah order: pakai template_url kalau ada,
// kalau tidak jatuh ke katalog dieline Pacdora (search di sana manual).
export function templateUrlFor(order) {
  return (order?.template_url && order.template_url.trim()) || PACDORA_DIELINES_URL
}

// Nama file dari URL storage (untuk label download).
export function fileNameFromUrl(url) {
  try { return decodeURIComponent(String(url).split('/').pop().split('?')[0]) }
  catch { return 'file' }
}

// Normalisasi entri file: dukung format lama (string url) & baru ({url,name}).
export function fileEntry(f) {
  if (!f) return { url: '', name: 'file' }
  if (typeof f === 'string') return { url: f, name: fileNameFromUrl(f) }
  return { url: f.url, name: f.name || fileNameFromUrl(f.url) }
}

// Gabungan nama perusahaan + nama customer untuk tampilan.
export function displayCustomer(o) {
  const co = o?.customer_name || ''
  const person = o?.nama_customer || ''
  if (co && person) return `${co} — ${person}`
  return co || person || '—'
}
