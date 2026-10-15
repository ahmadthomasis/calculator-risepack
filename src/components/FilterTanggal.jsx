// Kontrol rentang tanggal yang dipakai bersama oleh Request Harga (Sales),
// Antrian Estimator, dan Antrian Purchasing.
//
// DEFAULTNYA SENGAJA KOSONG (= semua tanggal), BUKAN 30 HARI TERAKHIR.
// Dashboard Manager memakai default 30 hari dan itu pernah menimbulkan
// kebingungan nyata pada 15 Okt 2026: jumlah Deal terbaca 5 di Manager tapi 24
// di Sales dan Estimator, semata-mata karena rentangnya -- bukan karena ada
// data yang hilang. Tiga halaman ini adalah antrean kerja, jadi lebih baik
// menampilkan semuanya lalu dipersempit sendiri daripada menyembunyikan baris
// tanpa ada yang sadar.

// Tanggal kalender LOKAL dari sebuah timestamp, bukan tanggal UTC-nya.
// Penting: tabel menampilkan tanggal pakai toLocaleDateString('id-ID'), jadi
// penyaringan harus memakai patokan yang sama. Kalau dipotong dari string ISO
// (slice(0,10)) maka di WIB (UTC+7) order yang masuk pukul 01:30 tanggal 16
// akan tersaring sebagai tanggal 15 -- beda dengan yang tertulis di layarnya.
export function tanggalLokal(nilai) {
  if (!nilai) return ''
  const d = new Date(nilai)
  if (isNaN(d.getTime())) return ''
  const bln = String(d.getMonth() + 1).padStart(2, '0')
  const tgl = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${bln}-${tgl}`
}

// Kedua ujung INKLUSIF: memilih 1-31 Okt berarti tanggal 31 ikut masuk.
// Baris tanpa tanggal ikut tampil selama rentangnya belum dipasang, dan keluar
// begitu dipasang -- kalau dipaksa tetap tampil, ia akan muncul di rentang
// mana pun dan orang akan mengira filternya rusak.
export function dalamRentang(nilai, dari, sampai) {
  if (!dari && !sampai) return true
  const t = tanggalLokal(nilai)
  if (!t) return false
  if (dari && t < dari) return false
  if (sampai && t > sampai) return false
  return true
}

export default function FilterTanggal({ dari, sampai, setDari, setSampai, label = 'Tanggal', title }) {
  const kotak = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e0d5',
    fontSize: 12.5, outline: 'none', background: '#fff', color: '#2c1810',
  }
  const aktif = !!(dari || sampai)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={title || `Saring berdasarkan ${label.toLowerCase()}`}>
      <span style={{ fontSize: 11.5, color: '#9ca3af', whiteSpace: 'nowrap' }}>{label}</span>
      <input type="date" value={dari || ''} max={sampai || undefined}
        onChange={e => setDari(e.target.value)} style={kotak} />
      <span style={{ fontSize: 11.5, color: '#9ca3af' }}>s/d</span>
      <input type="date" value={sampai || ''} min={dari || undefined}
        onChange={e => setSampai(e.target.value)} style={kotak} />
      {aktif && (
        <button onClick={() => { setDari(''); setSampai('') }}
          title="Tampilkan semua tanggal"
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e0d5',
            background: '#fff', color: '#6b7280', fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          ✕ Semua
        </button>
      )}
    </div>
  )
}
