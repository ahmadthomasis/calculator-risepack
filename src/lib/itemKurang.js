// ── Deteksi "Item Kurang" ────────────────────────────────────────────────
//
// MASALAH YANG DITANGANI
// Estimator kadang baru sadar ada item yang tertinggal SETELAH purchasing
// selesai memproyeksikan. Purchasing tidak bisa menambah baris item (hanya
// estimator yang bisa), dan estimator tidak tahu kalau purchasing sudah
// jalan. Jadi barisnya nambah tapi tidak ada yang mengisi harganya, dan
// COGS Proyeksi diam-diam memakai angka estimator untuk baris itu.
//
// DEFINISI
// Satu quotation disebut punya "item kurang" kalau:
//   1. purchasing sudah menandai SUDAH DIPROYEKSI (purchasing_projected_at),
//      DAN
//   2. masih ada baris biaya estimator yang belum punya harga pembanding
//      purchasing.
//
// Baris yang semua kolom pengenalnya kosong TIDAK dihitung, supaya baris
// sisa/kosong tidak memunculkan alarm palsu.
//
// Dipakai bersama oleh Antrian Purchasing dan Antrian Estimator supaya
// definisinya satu, tidak dua versi yang bisa beda.

// Nama kolom JSONB di quotations -> nama section di purchasing_comparisons
export const CMP_SECTION_OF = {
  material_cost:   'material',
  cetak_cost:      'cetak',
  emboss_laminasi: 'emboss',
  material_proses: 'mat_proses',
  finishing_wo:    'finishing',
  additional_cost: 'additional',
}

// Kolom yang menandai "baris ini memang item, bukan baris kosong".
const IDENT_FIELDS = ['nama', 'material', 'mesin', 'proses', 'spesifik', 'keterangan']

function isRealRow(row) {
  if (!row || typeof row !== 'object') return false
  return IDENT_FIELDS.some(f => String(row[f] ?? '').trim() !== '')
}

// Label baris untuk ditampilkan di tooltip badge.
const PRIMARY_FIELD = {
  material: 'nama', cetak: 'nama', emboss: 'proses',
  mat_proses: 'proses', finishing: 'proses', additional: 'nama',
}

/**
 * Ambil Set kunci harga purchasing yang SUDAH terisi.
 * Kunci: `${quotation_id}|${section}|${row_index}`
 *
 * @param {object} supabase klien supabase
 * @param {string[]} quotationIds
 * @returns {Promise<Set<string>>}
 */
export async function fetchPricedKeys(supabase, quotationIds) {
  const ids = (quotationIds || []).filter(Boolean)
  if (ids.length === 0) return new Set()

  const keys = new Set()
  // Dipotong per 200 id supaya URL query PostgREST tidak kepanjangan.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { data, error } = await supabase
      .from('purchasing_comparisons')
      .select('quotation_id, section, row_index, purchasing_price')
      .in('quotation_id', chunk)
    if (error) {
      console.error('Gagal memuat harga pembanding purchasing:', error)
      // Kembalikan apa yang sudah terkumpul. Lebih baik badge tidak muncul
      // daripada semua order terlihat "item kurang" karena query gagal.
      return null
    }
    ;(data || []).forEach(c => {
      if (c.purchasing_price == null || c.purchasing_price === '') return
      keys.add(`${c.quotation_id}|${c.section}|${c.row_index}`)
    })
  }
  return keys
}

/**
 * Hitung baris estimator yang belum dihargai purchasing.
 *
 * @param {object} quotation baris quotations lengkap dengan array biaya
 * @param {Set<string>|null} pricedKeys hasil fetchPricedKeys; null = tidak tahu
 * @returns {{ count: number, names: string[] }}
 */
export function missingItems(quotation, pricedKeys) {
  const kosong = { count: 0, names: [] }
  if (!quotation || !pricedKeys) return kosong
  // Belum diproyeksi purchasing = memang belum waktunya diisi, bukan "kurang".
  if (!quotation.purchasing_projected_at) return kosong

  const names = []
  Object.keys(CMP_SECTION_OF).forEach(col => {
    const rows = quotation[col]
    if (!Array.isArray(rows)) return
    const section = CMP_SECTION_OF[col]
    rows.forEach((row, i) => {
      if (!isRealRow(row)) return
      if (pricedKeys.has(`${quotation.id}|${section}|${i}`)) return
      const label = String(row[PRIMARY_FIELD[section]] ?? '').trim()
      names.push(label || `Baris ${i + 1}`)
    })
  })
  return { count: names.length, names }
}

/** True kalau quotation ini perlu badge "Item Kurang". */
export function hasMissingItems(quotation, pricedKeys) {
  return missingItems(quotation, pricedKeys).count > 0
}
