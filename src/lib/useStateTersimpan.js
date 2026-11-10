import { useState, useEffect } from 'react'

// useState yang nilainya bertahan saat pindah halaman lalu kembali (mis. buka
// perhitungan harga lalu "Kembali ke Antrian"). Disimpan di sessionStorage:
// hilang sendiri saat tab browser ditutup, dan tiap tab punya filternya sendiri.
// Kalau storage tidak tersedia (mode privat dsb.), jatuh ke useState biasa.
export function useStateTersimpan(kunci, awal) {
  const [nilai, setNilai] = useState(() => {
    try {
      const v = sessionStorage.getItem(kunci)
      return v === null ? awal : JSON.parse(v)
    } catch { return awal }
  })
  useEffect(() => {
    try { sessionStorage.setItem(kunci, JSON.stringify(nilai)) } catch { /* abaikan */ }
  }, [kunci, nilai])
  return [nilai, setNilai]
}
