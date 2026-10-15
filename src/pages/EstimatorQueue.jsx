import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import FilterTanggal, { dalamRentang } from '../components/FilterTanggal'

const STATUS_LABEL = { pending:'Menunggu', in_progress:'Dikerjakan', done:'Selesai', cancelled:'Dibatalkan' }
const STATUS_COLOR = { pending:'#f59e0b', in_progress:'#2563eb', done:'#16a34a', cancelled:'#9ca3af' }

const DEAL_LABEL = { quoted:'Belum Diisi', deal:'Deal ✅', no_deal:'No Deal ❌', followup:'Followup 🔄' }
const DEAL_COLOR = { quoted:'#9ca3af', deal:'#16a34a', no_deal:'#dc2626', followup:'#d97706' }

// Satu request bisa punya BEBERAPA quotation AKTIF sekaligus -- itu varian qty
// yang ditawarkan ke customer (misal 10.000 pcs dan 5.000 pcs), dan Sales
// menandai Deal pada salah satunya saja. Baris di tabel ini satu per REQUEST,
// jadi harus dipilih satu quotation sebagai wakilnya.
//
// Dulu yang diambil `[0]`, yaitu quotation aktif mana pun yang kebetulan datang
// duluan dari PostgREST. Urutan itu TIDAK DIJAMIN, jadi order yang sudah Deal
// bisa tampil sebagai "Belum Diisi" atau "No Deal" di antrean ini. Dilaporkan
// 15 Okt 2026 pada kode order 4974 dan 5057, dan terbukti di data:
//   REQ-20260820-0496  -> [0] quoted qty 10.000, padahal yang Deal qty 5.000
//   REQ-20261015-0985  -> [0] no_deal qty 10.000, padahal yang Deal qty 5.000
//
// Wakilnya sekarang dipilih, bukan diambil asal: yang sudah Deal menang (kalau
// satu varian sudah deal, ordernya memang jalan), lalu Followup, lalu yang
// belum diisi, lalu No Deal. Seri diputus oleh updated_at terbaru.
//
// CATATAN: kolom harga per qty di tabel sengaja TIDAK memakai fungsi ini -- di
// sana semua varian aktif memang harus ditampilkan, bukan cuma wakilnya.
const URUTAN_WAKIL = { deal: 0, followup: 1, quoted: 2, no_deal: 3 }

function quotWakil(r) {
  const aktif = (r?.quotations || []).filter(qt => !qt.is_draft && qt.is_active)
  if (aktif.length <= 1) return aktif[0]
  return [...aktif].sort((a, b) => {
    const pa = URUTAN_WAKIL[a.deal_status] ?? 9
    const pb = URUTAN_WAKIL[b.deal_status] ?? 9
    if (pa !== pb) return pa - pb
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })[0]
}

const LAST_SEEN_KEY = 'risepack_estimator_deal_last_seen'

const s = {
  card: { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:24 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', padding:'10px 12px', fontSize:12, color:'#6b7280', borderBottom:'2px solid #f3f4f6', fontWeight:500 },
  td: { padding:'12px', fontSize:13, color:'#374151', borderBottom:'1px solid #f9fafb', verticalAlign:'top' },
  badge: (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500, background:c+'18', color:c }),
  btnPrimary: { padding:'7px 16px', background:'#2563eb', color:'#fff', border:'none', borderRadius:7, fontSize:13, cursor:'pointer', fontWeight:500 },
  btnGray: { padding:'7px 16px', background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', borderRadius:7, fontSize:13, cursor:'pointer' },
}

export default function EstimatorQueue() {
  const navigate = useNavigate()
  // Dipakai untuk mencatat siapa yang mengirim ke purchasing.
  const { profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [filter, setFilter]     = useState('all')
  const [pulse, setPulse]       = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [salesFilter, setSalesFilter] = useState('all')
  const [dealFilter,  setDealFilter]  = useState('all')
  const [purchFilter, setPurchFilter] = useState('all')
  const [tglDari, setTglDari]       = useState('')   // rentang tanggal, default: semua
  const [tglSampai, setTglSampai]   = useState('')
  const [lastSeen] = useState(() => localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString())

  useEffect(() => {
    // Tandai "sudah dilihat" setelah komponen sempat dirender, supaya badge "baru" sempat terlihat dulu
    const t = setTimeout(() => localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    fetchRequests()
    // Realtime subscription
    const channel = supabase
      .channel('requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests()
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
        fetchRequests()
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchRequests() {
    const { data } = await supabase
      .from('requests')
      .select('*, profiles!requests_sales_id_fkey(full_name), quotations(id, deal_status, updated_at, is_draft, is_active, purchasing_status, purchasing_notes, needs_revision, revision_note, revision_requested_at, kode_order, cost_source, vendor_name, price_per_unit, quantity)')
      .order('priority', { ascending: false })
      .order('submitted_at', { ascending: true })
    setRequests(data || [])
  }

  // Kirim ke Purchasing — sebelumnya hanya ada di ManagerDashboard, jadi
  // estimator harus menunggu manager walau perhitungannya sudah selesai.
  //
  // Mengisi purchasing_status = 'pending' itulah yang membuat order muncul
  // di Antrian Purchasing: halaman itu menyaring purchasing_status is not
  // null. sent_to_purchasing_by diisi supaya kelihatan siapa yang mengirim.
  async function kirimKePurchasing(quotationId) {
    const { data, error } = await supabase.from('quotations').update({
      purchasing_status:     'pending',
      sent_to_purchasing_at: new Date().toISOString(),
      sent_to_purchasing_by: profile?.id || null,
    }).eq('id', quotationId).select('id')

    if (error) {
      console.error('Gagal kirim ke purchasing:', error)
      alert('Gagal mengirim ke Purchasing: ' + error.message)
      return
    }
    // PostgREST tidak menganggap UPDATE yang ditolak RLS sebagai error --
    // baris yang kena 0 tanpa pesan apa pun. Tanpa cek ini, tombolnya akan
    // kelihatan berhasil padahal tidak menyimpan apa-apa.
    if (!data || data.length === 0) {
      alert('TIDAK terkirim — tidak ada baris yang berubah.\n\nKemungkinan akun Anda belum punya izin mengubah quotation ini, atau order ini sudah pernah dikirim.')
      return
    }
    fetchRequests()
  }

  async function startRequest(id) {
    await supabase.from('requests').update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      // Reset spec_updated_at supaya badge "Ada Revisi" hilang --
      // estimator sudah acknowledge revisi dengan mulai kerjakan ulang.
      spec_updated_at: null,
    }).eq('id', id)
    navigate(`/calculator/${id}`)
  }

  async function cancelRequest(id) {
    if (!confirm('Batalkan request ini?')) return
    await supabase.from('requests').update({ status:'cancelled' }).eq('id', id)
  }

  const salesList = [...new Set(requests.map(r => r.profiles?.full_name).filter(Boolean))].sort()

  // Quotation wakil dari satu request (lihat quotWakil di atas).
  const activeQuot = quotWakil

  const mintaRevisi = r => !!activeQuot(r)?.needs_revision

  // Semua varian qty aktif dari sebuah request. Dipakai untuk FILTER dan
  // HITUNGAN. Untuk badge di tabel tetap quotWakil -- satu baris butuh satu
  // wakil, tapi menyaring dan menghitung tidak boleh kehilangan varian lain.
  const quotAktifSemua = r => (r?.quotations || []).filter(qt => !qt.is_draft && qt.is_active)

  // Rentang tanggal dipasang PALING DULU supaya seluruh hitungan di bawahnya
  // ikut menyesuaikan, dan angka di dalam kurung tidak pernah menjanjikan
  // baris yang ternyata tidak muncul.
  const dalamTanggal = requests.filter(r => dalamRentang(r.submitted_at, tglDari, tglSampai))

  const filtered = (filter === 'all' ? dalamTanggal
    : filter === 'minta_revisi' ? dalamTanggal.filter(mintaRevisi)
    : dalamTanggal.filter(r => r.status === filter))
    .filter(r => {
      // Pencarian ikut menjangkau Kode Order, no. request, dan nama produk --
      // bukan cuma nama customer. Kode Order-nya ada di quotation aktif.
      const s = searchTerm.trim().toLowerCase()
      if (!s) return true
      const q = activeQuot(r)
      return (r.customer_name || '').toLowerCase().includes(s)
        || (r.request_number || '').toLowerCase().includes(s)
        || (r.product_type || '').toLowerCase().includes(s)
        || (q?.kode_order || '').toLowerCase().includes(s)
    })
    .filter(r => salesFilter === 'all' || r.profiles?.full_name === salesFilter)
    // Syaratnya "ADA MINIMAL SATU varian aktif berstatus ini", bukan status si
    // wakil. Request yang salah satu variannya Deal memang harus ikut muncul
    // saat difilter Deal -- kalau dipakai wakilnya, request seperti itu malah
    // hilang dari hasil filter. Sama dengan halaman Sales.
    .filter(r => {
      if (dealFilter === 'all') return true
      const v = quotAktifSemua(r)
      // 'none' = belum ada varian aktif sama sekali, atau semuanya belum diisi.
      if (dealFilter === 'none') return v.length === 0 || v.every(q => !q.deal_status)
      return v.some(q => q.deal_status === dealFilter)
    })
    .filter(r => {
      if (purchFilter === 'all') return true
      const v = quotAktifSemua(r)
      // 'none' = belum pernah dikirim ke purchasing sama sekali.
      if (purchFilter === 'none') return v.length === 0 || v.every(q => !q.purchasing_status)
      return v.some(q => q.purchasing_status === purchFilter)
    })
  const counts   = { all: dalamTanggal.length, pending: 0, in_progress: 0, done: 0, minta_revisi: 0 }
  dalamTanggal.forEach(r => {
    if (counts[r.status] !== undefined) counts[r.status]++
    if (mintaRevisi(r)) counts.minta_revisi++
  })

  // SATUAN HITUNG kedua dropdown di bawah ini adalah VARIAN QTY (quotation),
  // BUKAN request -- sama dengan Dashboard Manager dan halaman Sales. Sales
  // menandai Deal pada satu varian qty, jadi varian itulah satuan sebenarnya.
  // Kalau dihitung per request, satu request yang dua variannya sama-sama Deal
  // hanya terhitung satu dan angkanya tidak akan pernah cocok dengan Manager
  // (terbukti 15 Okt 2026: Manager 25 quotation vs 24 request).
  //
  // Konsekuensi yang disengaja: angka di dalam kurung bisa LEBIH BESAR
  // daripada jumlah baris yang tampil, karena satu baris request bisa mewakili
  // beberapa varian. Baris tabel memang per request; yang dihitung varian.
  const dealCounts  = { all: 0, deal:0, followup:0, no_deal:0, quoted:0, none:0 }
  const purchCounts = { all: 0, pending:0, approved:0, hold:0, cancelled:0, none:0 }
  dalamTanggal.forEach(r => {
    const v = quotAktifSemua(r)
    // Request tanpa varian aktif tetap dihitung satu, masuk 'none' -- supaya
    // angkanya sejalan dengan predikat filter 'none' di atas.
    if (v.length === 0) {
      dealCounts.all++;  dealCounts.none++
      purchCounts.all++; purchCounts.none++
      return
    }
    v.forEach(q => {
      dealCounts.all++;  purchCounts.all++
      const d = q.deal_status || 'none'
      if (dealCounts[d] !== undefined) dealCounts[d]++
      const pst = q.purchasing_status || 'none'
      if (purchCounts[pst] !== undefined) purchCounts[pst]++
    })
  })

  function elapsed(submitted) {
    const mins = Math.floor((Date.now() - new Date(submitted)) / 60000)
    if (mins < 60) return `${mins}m lalu`
    if (mins < 1440) return `${Math.floor(mins/60)}j lalu`
    return `${Math.floor(mins/1440)}h lalu`
  }

  return (
    <Layout title="Antrian Estimasi">
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        @keyframes pulseDotEst {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      {/* Realtime indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <span style={{
          display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: pulse ? '#16a34a' : '#d1d5db',
          transition:'background 0.3s'
        }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>Live — update otomatis saat request masuk</span>
      </div>

      {/* Strip pekerjaan mendesak. Pil filter saja tidak cukup: pil ada di
          deretan filter status biasa dan mudah terlewat. Hanya muncul kalau
          angkanya > 0, jadi tidak jadi hiasan tetap. */}
      {counts.minta_revisi > 0 && (
        <button onClick={() => setFilter('minta_revisi')} style={{
          display:'flex', width:'100%', boxSizing:'border-box', textAlign:'left',
          cursor:'pointer', alignItems:'center', gap:10, marginBottom:16,
          padding:'11px 14px', borderRadius:10,
          background:'#EFF6FF', border:'1px solid #93C5FD',
        }}>
          <span style={{ fontSize:16 }}>📋</span>
          <span style={{ fontSize:13, color:'#1D4ED8', fontWeight:600 }}>
            {counts.minta_revisi} perhitungan diminta revisi purchasing
          </span>
          <span style={{ marginLeft:'auto', fontSize:11, color:'#1D4ED8', opacity:0.75 }}>lihat →</span>
        </button>
      )}

      {/* Filter tabs + search */}
      <div style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center', flexWrap:'wrap', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:8 }}>
          {[['all','Semua'],['pending','Menunggu'],['in_progress','Dikerjakan'],['done','Selesai'],['minta_revisi','📋 Diminta Revisi']].map(([val,label]) => {
            // Pil "Item Kurang" dibedakan warnanya (ungu) supaya tidak hilang
            // di antara filter status biasa -- ini pekerjaan yang mendesak.
            // Pil "Diminta Revisi" dibedakan warnanya supaya tidak hilang di
            // antara filter status biasa, dan disembunyikan kalau angkanya 0.
            const urgent = val === 'minta_revisi'
            const aktif  = filter === val
            const warna  = urgent ? '#1D4ED8' : '#2563eb'
            if (urgent && (counts[val] ?? 0) === 0 && !aktif) return null
            const judul  = urgent ? 'Purchasing minta estimator memperbaiki/menambah item' : undefined
            return (
              <button key={val} onClick={() => setFilter(val)} title={judul} style={{
                padding:'6px 16px', borderRadius:20, fontSize:13, cursor:'pointer', fontWeight:500,
                background: aktif ? warna : '#fff',
                color: aktif ? '#fff' : (urgent ? warna : '#6b7280'),
                border: aktif ? `1px solid ${warna}` : `1px solid ${urgent ? warna+'66' : '#e5e7eb'}`
              }}>{label} <span style={{ opacity:0.7 }}>({counts[val] ?? 0})</span></button>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select
            value={dealFilter}
            onChange={e => setDealFilter(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none', background:'#fff', color: dealFilter === 'all' ? '#6b7280' : '#1d4ed8', fontWeight: dealFilter === 'all' ? 400 : 600, cursor:'pointer' }}
          >
            <option value="all">Semua Status Deal ({dealCounts.all})</option>
            <option value="deal">Deal ({dealCounts.deal})</option>
            <option value="followup">Followup ({dealCounts.followup})</option>
            <option value="no_deal">No Deal ({dealCounts.no_deal})</option>
            <option value="quoted">Belum Diisi ({dealCounts.quoted})</option>
            <option value="none">Belum ada quotation ({dealCounts.none})</option>
          </select>
          <select
            value={purchFilter}
            onChange={e => setPurchFilter(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none', background:'#fff', color: purchFilter === 'all' ? '#6b7280' : '#1d4ed8', fontWeight: purchFilter === 'all' ? 400 : 600, cursor:'pointer' }}
          >
            <option value="all">Semua Status Purchasing ({purchCounts.all})</option>
            <option value="none">Belum dikirim ({purchCounts.none})</option>
            <option value="pending">Menunggu ({purchCounts.pending})</option>
            <option value="approved">Disetujui ({purchCounts.approved})</option>
            <option value="hold">Hold ({purchCounts.hold})</option>
            <option value="cancelled">Cancelled ({purchCounts.cancelled})</option>
          </select>
          <select
            value={salesFilter}
            onChange={e => setSalesFilter(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none', background:'#fff', color: salesFilter === 'all' ? '#6b7280' : '#1d4ed8', fontWeight: salesFilter === 'all' ? 400 : 600, cursor:'pointer' }}
          >
            <option value="all">Semua Sales</option>
            {salesList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Cari Kode Order, customer, no. request, produk..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, width:220, outline:'none' }}
          />
          <FilterTanggal dari={tglDari} sampai={tglSampai} setDari={setTglDari} setSampai={setTglSampai}
            label="Masuk" title="Saring berdasarkan tanggal request masuk" />
        </div>
      </div>

      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6 }}>{filtered.length} total</div>
      <div style={{ maxHeight:560, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
        <table style={s.table}>
          <thead style={{ position:'sticky', top:0, zIndex:1, background:'#f9fafb' }}>
            <tr>
              <th style={s.th}>Request</th>
              <th style={s.th}>Customer</th>
              <th style={s.th}>Spesifikasi</th>
              <th style={s.th}>Qty</th>
              <th style={s.th}>Harga/pcs</th>
              <th style={s.th}>Sales</th>
              <th style={s.th}>Waktu</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Status Deal</th>
              <th style={s.th}>Sumber</th>
              <th style={s.th}>Purchasing</th>
              <th style={s.th}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ ...s.td, color:'#9ca3af', textAlign:'center', padding:40 }}>
                Tidak ada request
              </td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} style={{ background: r.priority==='urgent' ? '#fff7ed' : 'transparent' }}>
                <td style={s.td}>
                  <div style={{ fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>{r.request_number}</div>
                  {r.priority==='urgent' && <div style={{ color:'#dc2626', fontSize:11, fontWeight:600, marginTop:2 }}>🔴 URGENT</div>}
                </td>
                <td style={s.td}><div style={{ fontWeight:500 }}>{r.customer_name}</div><div style={{ fontSize:12, color:'#9ca3af' }}>{r.product_type}</div></td>
                <td style={s.td}>
                  <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>
                    {r.product_size && <div>📐 {r.product_size}</div>}
                    {r.material_spec && <div>📄 {r.material_spec}</div>}
                    {r.print_spec && <div>🖨️ {r.print_spec}</div>}
                    {r.finishing_spec && <div>✂️ {r.finishing_spec}</div>}
                    {r.notes && <div style={{ color:'#9ca3af', fontStyle:'italic' }}>💬 {r.notes}</div>}
                    {(() => {
                      const imgs = Array.isArray(r.reference_images) && r.reference_images.length > 0
                        ? r.reference_images
                        : (r.reference_image ? [r.reference_image] : [])
                      if (imgs.length === 0) return null
                      return (
                        <div style={{ marginTop:8 }}>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            {imgs.map((url, i) => (
                              <img
                                key={i}
                                src={url.includes('/storage/v1/object/public/')
                                  ? url.replace('/object/public/', '/render/image/public/') + '?width=160&height=160&resize=cover&quality=60'
                                  : url}
                                alt={`referensi ${i+1}`}
                                loading="lazy"
                                decoding="async"
                                style={{ width:78, height:78, borderRadius:6, border:'1px solid #e5e7eb', cursor:'pointer', objectFit:'cover', background:'#f3f4f6' }}
                                onClick={() => window.open(url, '_blank')}
                                onError={e => {
                                  // Fallback ke URL asli kalau image transform tidak tersedia (Free plan)
                                  if (e.target.src !== url) e.target.src = url
                                }}
                                title="Klik untuk lihat ukuran penuh"
                              />
                            ))}
                          </div>
                          <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>🖼️ klik gambar untuk perbesar</div>
                        </div>
                      )
                    })()}
                  </div>
                </td>
                <td style={s.td}>
                  {(() => {
                    const qtys = Array.isArray(r.quantities) && r.quantities.length > 0
                      ? r.quantities
                      : (r.quantity ? [r.quantity] : [])
                    return qtys.map(q => q.toLocaleString('id-ID')).join(' / ')
                  })()}
                </td>
                <td style={s.td}>
                  {(() => {
                    // Tampilkan harga/pcs dari quotation aktif per qty
                    const activeQuots = (r.quotations || []).filter(qt => !qt.is_draft && qt.is_active)
                    if (activeQuots.length === 0) return <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                    return (
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {activeQuots.map((qt, i) => (
                          qt.price_per_unit > 0
                            ? <div key={i} style={{ fontSize:12, fontWeight:500, color:'#E8760A' }}>
                                Rp {Math.round(qt.price_per_unit).toLocaleString('id-ID')}
                              </div>
                            : <span key={i} style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                        ))}
                      </div>
                    )
                  })()}
                </td>
                <td style={s.td}>{r.profiles?.full_name}</td>
                <td style={s.td}><div style={{ fontSize:12, color:'#9ca3af' }}>{elapsed(r.submitted_at)}</div></td>
                <td style={s.td}>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <span style={s.badge(STATUS_COLOR[r.status])}>{STATUS_LABEL[r.status]}</span>
                    {(() => {
                      // Badge "Ada Revisi": muncul hanya kalau:
                      // 1. Status 'done' (selesai) -- kalau masih dikerjakan tidak perlu
                      // 2. spec_updated_at ada (sales/manager mengubah spesifikasi)
                      // 3. spec_updated_at > completed_at (revisi terjadi SETELAH estimator selesai)
                      //    atau completed_at null tapi spec_updated_at ada
                      if (r.status !== 'done') return null
                      if (!r.spec_updated_at) return null
                      const revisiSetelahSelesai = !r.completed_at ||
                        new Date(r.spec_updated_at) > new Date(r.completed_at)
                      if (!revisiSetelahSelesai) return null
                      return (
                        <span style={{
                          padding:'2px 8px', borderRadius:12, fontSize:10, fontWeight:600,
                          background:'#FEF3C7', color:'#92400E', border:'1px solid #FCD34D',
                          animation:'pulseDotEst 1.4s ease-in-out infinite',
                        }}>⚠ Ada Revisi</span>
                      )
                    })()}
                    {(() => {
                      // Badge "📋 Revisi Purchasing".
                      //
                      // DULU badge ini cuma melihat purchasing_notes terisi atau
                      // tidak. Itu keliru: purchasing_notes adalah catatan biasa
                      // yang ikut tersimpan SETIAP kali purchasing menekan Save
                      // Proyeksi -- jadi badge-nya menyala terus walau tidak ada
                      // yang perlu direvisi, dan tidak pernah bisa dimatikan.
                      //
                      // Sekarang pakai penanda eksplisit needs_revision, yang
                      // hanya menyala kalau purchasing memang menekan "Minta
                      // Revisi ke Estimator", dan padam sendiri begitu estimator
                      // menyimpan ulang (baris quotation baru default false).
                      const q = quotWakil(r)
                      if (!q?.needs_revision) return null
                      return (
                        <span title={q.revision_note || 'Purchasing meminta perbaikan pada perhitungan ini'} style={{
                          padding:'2px 8px', borderRadius:12, fontSize:10, fontWeight:600,
                          background:'#EFF6FF', color:'#1D4ED8', border:'1px solid #93C5FD',
                          cursor:'help', animation:'pulseDotEst 1.4s ease-in-out infinite',
                        }}>📋 Revisi Purchasing</span>
                      )
                    })()}
                  </div>
                </td>
                <td style={s.td}>
                  {(() => {
                    const q = quotWakil(r)
                    if (!q || !q.deal_status) return <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                    const isNew = q.deal_status !== 'quoted' && q.updated_at && new Date(q.updated_at) > new Date(lastSeen)
                    return (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {isNew && (
                          <span style={{
                            width:7, height:7, borderRadius:'50%', background:'#dc2626', flexShrink:0,
                            animation:'pulseDot 1.4s ease-in-out infinite',
                          }} />
                        )}
                        <span style={s.badge(DEAL_COLOR[q.deal_status])}>{DEAL_LABEL[q.deal_status]}</span>
                      </div>
                    )
                  })()}
                  {/* Kode Order ditaruh di bawah Status Deal, bukan jadi kolom
                      sendiri: tabel ini sudah 12 kolom. Keduanya memang satu
                      paket -- Kode Order diisi Sales bersamaan saat menandai
                      Deal, jadi dibaca bersebelahan. */}
                  {(() => {
                    const q = activeQuot(r)
                    if (!q?.kode_order) return null
                    return (
                      <div style={{ fontFamily:'monospace', fontSize:11, color:'#6b7280', marginTop:3 }}
                           title="Kode Order dari ERP, diisi Sales saat menandai Deal">
                        📦 {q.kode_order}
                      </div>
                    )
                  })()}
                </td>
                <td style={s.td}>
                  {(() => {
                    const q = quotWakil(r)
                    if (!q) return <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                    if (q.cost_source === 'vendor') {
                      return (
                        <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:'#FAEEDA', color:'#854F0B' }} title={q.vendor_name || ''}>
                          Vendor{q.vendor_name ? `: ${q.vendor_name}` : ''}
                        </span>
                      )
                    }
                    return <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:'#f1efe8', color:'#5f5e5a' }}>Internal</span>
                  })()}
                </td>
                <td style={s.td}>
                  {(() => {
                    const q = quotWakil(r)
                    if (!q || !q.purchasing_status) return <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                    const labels = { pending:'Menunggu', approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }
                    const colors = { pending:'#d97706', approved:'#16a34a', hold:'#d97706', cancelled:'#dc2626' }
                    // Penanda "item kurang" SENGAJA tidak ada di sini.
                    // Mengisi harga item adalah pekerjaan purchasing, dan
                    // estimator tidak bisa berbuat apa-apa soal itu -- jadi
                    // alarmnya hanya dipasang di Antrian Purchasing. Yang
                    // relevan untuk estimator adalah permintaan revisi, dan
                    // itu sudah punya badge sendiri di kolom Status.
                    return <span style={s.badge(colors[q.purchasing_status])} title={q.purchasing_notes || ''}>{labels[q.purchasing_status]}</span>
                  })()}
                </td>
                <td style={s.td}>
                  <div style={{ display:'flex', gap:8, flexDirection:'column' }}>
                    {(r.status === 'pending' || r.status === 'in_progress') && (
                      <button style={s.btnPrimary} onClick={() => startRequest(r.id)}>
                        {r.status === 'pending' ? 'Mulai Hitung' : 'Lanjut Hitung'}
                      </button>
                    )}
                    {r.status === 'pending' && (
                      <button style={s.btnGray} onClick={() => cancelRequest(r.id)}>Batalkan</button>
                    )}
                    {r.status === 'done' && (
                      <button style={s.btnGray} onClick={() => navigate(`/calculator/${r.id}`)}>Lihat</button>
                    )}
                    {(() => {
                      // Tombol kirim hanya untuk perhitungan yang SUDAH final
                      // dan BELUM pernah dikirim. Kalau sudah dikirim,
                      // statusnya yang ditampilkan (kolom Purchasing).
                      const q = activeQuot(r)
                      if (!q || q.purchasing_status) return null
                      if (r.status !== 'done') return null
                      return (
                        <button
                          onClick={() => kirimKePurchasing(q.id)}
                          title="Kirim perhitungan ini ke Purchasing untuk dibuatkan COGS Proyeksi"
                          style={{
                            padding:'7px 16px', background:'#fff', border:'1px solid #2563eb',
                            color:'#2563eb', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer',
                          }}
                        >Kirim ke Purchasing</button>
                      )
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}





