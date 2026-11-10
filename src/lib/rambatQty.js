// ── Rambatkan perubahan antar-qty ───────────────────────────────────────────
// Saat satu qty disimpan, nilai yang DIUBAH di qty itu (dibanding saat qty itu
// dibuka) ikut dipasang ke qty lain -- tapi hanya kalau nilai di qty lain itu
// masih sama dengan nilai LAMA. Contoh: transport 1.000 → 300 di 2.000 pcs,
// maka 3.000 pcs yang transport-nya juga 1.000 ikut jadi 300; kalau di 3.000
// sengaja diisi 800, dibiarkan.
// Baris dicocokkan per urutan dalam section, dan harus nama+proses yang sama.
// Field yang bergantung pada qty (quantity, insheet) dan hasil hitung tidak
// pernah dirambatkan.
export const SECTION_QTY = ['material', 'cetak', 'emboss', 'matProses', 'finishing', 'additional']
const FIELD_TIDAK_DIRAMBATKAN = new Set([
  'id', 'quantity', 'insheet', 'harga_lembar', 'harga_per_pcs', 'subtotal', 'subtotal_raw',
  'harga_mesin', 'per_drug', 'qty_threshold',
])
const samaNilai = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '')

export function rambatkanPerubahan(sebelum, sesudah, target) {
  if (!sebelum || !sesudah || !target) return { hasil: target, jumlah: 0 }
  let jumlah = 0
  const hasil = { ...target }
  for (const sec of SECTION_QTY) {
    const lama = sebelum[sec] || [], baru = sesudah[sec] || [], tujuan = target[sec]
    if (!Array.isArray(tujuan)) continue
    hasil[sec] = tujuan.map((t, i) => {
      const b = lama[i], c = baru[i]
      if (!b || !c) return t
      // Identitas baris harus sama di ketiganya (sebelum, sesudah, tujuan)
      if (!samaNilai(t.nama, b.nama) || !samaNilai(t.proses, b.proses)) return t
      if (!samaNilai(c.nama, b.nama) || !samaNilai(c.proses, b.proses)) return t
      let ubah = null
      for (const k of Object.keys(c)) {
        if (FIELD_TIDAK_DIRAMBATKAN.has(k)) continue
        if (samaNilai(c[k], b[k])) continue          // tidak diubah di qty ini
        if (!samaNilai(t[k], b[k])) continue         // qty tujuan sudah beda sendiri
        ;(ubah ||= { ...t })[k] = c[k]
        jumlah++
      }
      return ubah || t
    })
  }
  return { hasil, jumlah }
}
