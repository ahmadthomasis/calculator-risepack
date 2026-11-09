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

// ── Urutan antrian: mana yang dikerjakan duluan ─────────────────────────────
// Deadline terdekat dulu (tanpa deadline paling belakang); deadline sama →
// yang masuk duluan (tanggal pengajuan, lalu jam dibuat). id sebagai pemutus
// seri terakhir supaya urutannya selalu pasti, tidak loncat-loncat.
export function bandingAntrian(a, b) {
  const da = a.deadline ? String(a.deadline).slice(0, 10) : '9999-12-31'
  const db = b.deadline ? String(b.deadline).slice(0, 10) : '9999-12-31'
  if (da !== db) return da < db ? -1 : 1
  const pa = String(a.tanggal_pengajuan || '').slice(0, 10)
  const pb = String(b.tanggal_pengajuan || '').slice(0, 10)
  if (pa !== pb) return pa < pb ? -1 : 1
  const ca = a.created_at || '', cb = b.created_at || ''
  if (ca !== cb) return ca < cb ? -1 : 1
  return String(a.id).localeCompare(String(b.id))
}

// ── Antrian bersama yang diatur innersales ──────────────────────────────────
// Satu antrian per layouter untuk tahap Layout, satu antrian bersama untuk
// tahap Rakit. Urutan manual (urutan_layout / urutan_rakit, hasil geseran
// innersales) menang; order yang belum pernah digeser ditaruh di bawahnya,
// diurutkan otomatis lewat bandingAntrian.
export const kolomUrutan = (tahap) => (tahap === 'layout' ? 'urutan_layout' : 'urutan_rakit')

export function kunciAntrian(o) {
  const tahap = deriveStatus(o)
  if (tahap === 'layout') return `layout:${o.layouter_id || '-'}`
  if (tahap === 'rakit')  return 'rakit'
  return null
}

function bandingManual(kolom) {
  return (a, b) => {
    const ma = a[kolom], mb = b[kolom]
    const ada = (v) => v !== null && v !== undefined
    if (ada(ma) && ada(mb) && ma !== mb) return ma - mb
    if (ada(ma) !== ada(mb)) return ada(ma) ? -1 : 1
    return bandingAntrian(a, b)
  }
}

// Daftar order per antrian, sudah terurut. Hasil: { [kunci]: [order, ...] }
export function susunAntrian(orders) {
  const grup = {}
  for (const o of orders) {
    const k = kunciAntrian(o)
    if (!k) continue
    ;(grup[k] ||= []).push(o)
  }
  for (const k of Object.keys(grup)) {
    grup[k].sort(bandingManual(kolomUrutan(k.startsWith('layout') ? 'layout' : 'rakit')))
  }
  return grup
}

// Nomor antrian tiap order, dihitung dari SEMUA order sebelum filter supaya
// "#1" sama di layar semua orang. Hasil: { [id]: { no, total, kunci } }
export function nomorAntrian(orders) {
  const out = {}
  const grup = susunAntrian(orders)
  for (const [kunci, list] of Object.entries(grup)) {
    list.forEach((o, i) => { out[o.id] = { no: i + 1, total: list.length, kunci } })
  }
  return out
}

// Pindahkan satu order ke posisi baru (0-based) di antriannya. Mengembalikan
// patch yang perlu disimpan: seluruh antrian itu dinomori ulang 1..n supaya
// urutan yang terlihat sekarang terkunci. Hanya baris yang nilainya berubah.
export function rencanaGeser(orders, id, posisiBaru) {
  const o = orders.find(x => x.id === id)
  const kunci = o && kunciAntrian(o)
  if (!kunci) return []
  const kolom = kolomUrutan(kunci.startsWith('layout') ? 'layout' : 'rakit')
  const list = [...susunAntrian(orders)[kunci]]
  const dari = list.findIndex(x => x.id === id)
  const ke = Math.max(0, Math.min(list.length - 1, posisiBaru))
  if (dari === ke) return []
  list.splice(ke, 0, list.splice(dari, 1)[0])
  return list
    .map((x, i) => ({ id: x.id, kolom, nilai: i + 1, lama: x[kolom] }))
    .filter(p => p.lama !== p.nilai)
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
