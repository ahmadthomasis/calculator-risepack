import { useState, useCallback, useRef } from 'react'

// useState yang nilainya bertahan saat pindah halaman lalu kembali (mis. buka
// perhitungan harga lalu "Kembali ke Antrian"). Disimpan di sessionStorage:
// hilang sendiri saat tab browser ditutup, dan tiap tab punya filternya sendiri.
// Kalau storage tidak tersedia (mode privat dsb.), jatuh ke useState biasa.
//
// Ditulis ke storage LANGSUNG di dalam setter, bukan lewat useEffect: pola
// "set lalu navigate()" di satu klik membuat komponen keburu dilepas sebelum
// effect sempat jalan, sehingga nilainya tidak pernah tersimpan.
export function useStateTersimpan(kunci, awal) {
  const [nilai, setNilai] = useState(() => {
    try {
      const v = sessionStorage.getItem(kunci)
      return v === null ? awal : JSON.parse(v)
    } catch { return awal }
  })
  const terkini = useRef(nilai)
  terkini.current = nilai
  const set = useCallback((v) => {
    const baru = typeof v === 'function' ? v(terkini.current) : v
    terkini.current = baru
    try { sessionStorage.setItem(kunci, JSON.stringify(baru)) } catch { /* abaikan */ }
    setNilai(baru)
  }, [kunci])
  return [nilai, set]
}
