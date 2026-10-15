// Mengambil SELURUH baris dari sebuah query Supabase, bukan cuma 1.000 pertama.
//
// KENAPA INI ADA. PostgREST memulangkan maksimal 1.000 baris per permintaan dan
// TIDAK memberi tanda apa pun kalau ada sisanya -- tidak ada error, tidak ada
// peringatan, cuma array yang berhenti di 1.000. Jadi halaman tetap tampil
// normal sementara angkanya salah.
//
// Terbukti 15 Okt 2026 di Dashboard Manager: 1.585 quotation cocok dengan
// filternya, yang terkirim 1.000, dan dari potongan itu terbaca 17 Deal senilai
// Rp 897.356.541 -- padahal yang sebenarnya 25 Deal. Angka omzet di layar
// dihitung dari data yang terpotong, dan tidak ada satu pun gejala yang
// menunjukkan hal itu.
//
// Tabel `requests` saat itu berisi 997 baris: tiga request lagi dan halaman
// Sales serta Estimator akan ikut terpotong dengan cara yang sama persis.
//
// Pakai ini untuk SETIAP query yang jumlah barisnya bisa tumbuh tanpa batas.
// Untuk query yang pasti kecil (mis. satu quotation per id) tidak perlu.
export async function ambilSemua(bikinQuery, ukuran = 1000) {
  const hasil = []
  const sudah = new Set()

  for (let dari = 0; ; dari += ukuran) {
    // bikinQuery() harus memulangkan builder BARU tiap dipanggil -- builder
    // Supabase tidak bisa dipakai ulang setelah di-range().
    //
    // .order('id') ditambahkan sebagai kunci urut terakhir, dan itu bukan
    // hiasan: paginasi hanya benar kalau urutannya pasti. Kalau query-nya cuma
    // diurutkan berdasarkan kolom yang nilainya bisa kembar (submitted_at,
    // priority), dua baris kembar bisa berpindah halaman di antara dua
    // permintaan -- satu baris terkirim dua kali, baris lain tidak terkirim
    // sama sekali. Urutan sekunder yang unik menghilangkan kemungkinan itu.
    const { data, error } = await bikinQuery()
      .order('id', { ascending: true })
      .range(dari, dari + ukuran - 1)

    // Dibungkus jadi Error sungguhan: Supabase memulangkan objek biasa, dan
    // objek biasa yang dilempar kehilangan pesan serta jejak tumpukannya begitu
    // sampai di penangkap error -- yang muncul cuma "[object Object]".
    if (error) {
      throw new Error('ambilSemua gagal di baris ke-' + dari + ': ' + (error.message || JSON.stringify(error)))
    }
    const baris = data || []

    // Jaring pengaman kedua: kalaupun ada baris yang terkirim dua kali, ia
    // tidak ikut terhitung dua kali.
    for (const b of baris) {
      const kunci = b?.id
      if (kunci === undefined || kunci === null) { hasil.push(b); continue }
      if (sudah.has(kunci)) continue
      sudah.add(kunci)
      hasil.push(b)
    }

    if (baris.length < ukuran) break

    // Pembatas mutlak supaya salah pakai tidak berubah jadi lingkaran tak
    // berujung yang menghabiskan kuota.
    if (dari > 200000) throw new Error('ambilSemua: melebihi 200.000 baris, hentikan dan periksa filternya.')
  }

  return hasil
}
