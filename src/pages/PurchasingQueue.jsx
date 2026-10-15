import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { fetchPricedKeys, missingItems } from '../lib/itemKurang'
import FilterTanggal, { dalamRentang } from '../components/FilterTanggal'

const PSTATUS_LABEL = { pending:'Belum Diputuskan', approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }
const PSTATUS_COLOR = { pending:'#d97706', approved:'#16a34a', hold:'#d97706', cancelled:'#dc2626' }

// Status deal dari Sales (quotations.deal_status). Nilai yang ada di database:
// deal / followup / no_deal / quoted. Dipakai purchasing untuk tahu mana
// pekerjaan prioritas (sudah Deal) dan mana yang sekadar minta validasi.
const DEAL_LABEL = { deal:'Deal', followup:'Follow Up', no_deal:'Tidak Deal', quoted:'Quoted' }
const DEAL_COLOR = { deal:'#3B6D11', followup:'#854F0B', no_deal:'#A32D2D', quoted:'#5f5e5a' }

const s = {
  card: { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:24 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', padding:'10px 12px', fontSize:12, color:'#6b7280', borderBottom:'2px solid #f3f4f6', fontWeight:500 },
  td: { padding:'12px', fontSize:13, color:'#374151', borderBottom:'1px solid #f9fafb', verticalAlign:'top' },
  badge: (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500, background:c+'18', color:c }),
  btnPrimary: { padding:'7px 16px', background:'#2563eb', color:'#fff', border:'none', borderRadius:7, fontSize:13, cursor:'pointer', fontWeight:500 },
  metricCard: { background:'#f9fafb', borderRadius:10, padding:16, flex:1 },
  select: { padding:'7px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', fontSize:13, color:'#374151', cursor:'pointer', fontWeight:500, minWidth:175 },
}

export default function PurchasingQueue() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [quotations, setQuotations] = useState([])
  const [filter, setFilter] = useState('all')
  const [dealFilter, setDealFilter] = useState('all')
  const [projFilter, setProjFilter] = useState('all')
  const [tglDari, setTglDari]       = useState('')   // rentang tanggal, default: semua
  const [tglSampai, setTglSampai]   = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [pulse, setPulse] = useState(false)
  // Kunci `${quotation_id}|${section}|${row_index}` yang sudah punya harga
  // purchasing. null = belum/gagal dimuat, badge "Item Kurang" ditahan dulu
  // supaya tidak ada alarm palsu.
  const [pricedKeys, setPricedKeys] = useState(null)

  useEffect(() => {
    fetchQuotations()
    const channel = supabase
      .channel('purchasing-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
        fetchQuotations()
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchQuotations() {
    // purchasing_status not null berarti pernah dikirim ke purchasing (pending/approved/hold/cancelled)
    const { data } = await supabase
      .from('quotations')
      .select('*, requests(request_number, customer_name, product_type)')
      .not('purchasing_status', 'is', null)
      .eq('is_draft', false)
      // WAJIB. Tanpa ini, setiap kali estimator menyimpan ulang, baris
      // quotation LAMA (yang sudah is_active=false) tetap ikut tampil di
      // samping baris barunya -- jadi satu order kelihatan dua kali, dan
      // yang lama masih memajang status sebelum direset. ManagerDashboard
      // dan Dashboard Pantau sudah menyaring ini sejak awal; halaman ini
      // yang terlewat.
      .eq('is_active', true)
      .order('sent_to_purchasing_at', { ascending: false })
    setQuotations(data || [])

    // Baris mana saja yang sudah dihargai purchasing. Dipakai untuk badge
    // "Item Kurang": estimator menambah item SETELAH purchasing selesai
    // memproyeksikan, jadi ada baris yang tidak ada yang mengisi harganya.
    const projected = (data || []).filter(q => q.purchasing_projected_at).map(q => q.id)
    setPricedKeys(await fetchPricedKeys(supabase, projected))
  }

  // Tiga filter bertingkat: Proyeksi -> Status Purchasing -> Status Deal.
  // Hitungan pada tiap baris pil mengikuti filter DI ATASNYA, jadi angkanya
  // selalu menjawab "dari yang sedang tampil, berapa yang ...".
  // Rentang tanggal dipasang PALING DULU, sebelum ketiga filter bertingkat.
  // Kalau dipasang terakhir, angka di dalam kurung pada dropdown akan
  // menjanjikan baris yang ternyata tidak muncul. Patokannya tanggal masuk ke
  // antrean ini (sent_to_purchasing_at), bukan tanggal request dibuat -- itu
  // yang relevan untuk beban kerja purchasing.
  const dalamTanggal = quotations.filter(q => dalamRentang(q.sent_to_purchasing_at, tglDari, tglSampai))

  const byProj = projFilter === 'all' ? dalamTanggal
    : projFilter === 'sudah' ? dalamTanggal.filter(q => q.purchasing_projected_at)
    : projFilter === 'kurang' ? dalamTanggal.filter(q => missingItems(q, pricedKeys).count > 0)
    : dalamTanggal.filter(q => !q.purchasing_projected_at)

  const byPStatus = filter === 'all' ? byProj : byProj.filter(q => q.purchasing_status === filter)

  // Ubah keputusan langsung dari antrean -- menggantikan tiga tombol besar
  // yang dulu ada di halaman validasi. Mengikuti pola updateDealStatus() di
  // SalesDashboard: update, cek, lalu refetch.
  async function updatePurchasingStatus(quotationId, newStatus) {
    const { data, error } = await supabase.from('quotations')
      .update({
        purchasing_status: newStatus,
        purchasing_reviewed_at: new Date().toISOString(),
        purchasing_reviewed_by: profile?.id || null,
      })
      .eq('id', quotationId)
      .select('id')
    if (error) { alert('Gagal mengubah status: ' + error.message); return }
    if (!data || data.length === 0) {
      alert('Status TIDAK tersimpan — tidak ada baris yang berubah. Kemungkinan akun Anda belum punya izin mengubah quotation ini.')
      return
    }
    fetchQuotations()
  }

  const filtered = byPStatus
    .filter(q => {
      if (dealFilter === 'all') return true
      if (dealFilter === 'none') return !q.deal_status
      return q.deal_status === dealFilter
    })
    .filter(q => {
      if (!searchTerm.trim()) return true
      const s = searchTerm.toLowerCase()
      return (
        (q.customer_name || '').toLowerCase().includes(s) ||
        (q.product_type || '').toLowerCase().includes(s) ||
        (q.requests?.request_number || '').toLowerCase().includes(s) ||
        (q.requests?.customer_name || '').toLowerCase().includes(s) ||
        (q.requests?.product_type || '').toLowerCase().includes(s)
      )
    })
  // Peta id quotation -> { count, names } item yang belum dihargai purchasing.
  // Dihitung sekali untuk dipakai kartu, filter, dan badge di tabel.
  const kurangMap = {}
  dalamTanggal.forEach(q => {
    const m = missingItems(q, pricedKeys)
    if (m.count > 0) kurangMap[q.id] = m
  })

  // Hitungan kartu: dari seluruh data DI DALAM RENTANG TANGGAL, bukan dari
  // hasil filter yang lain. Rentang tanggal sengaja ikut diperhitungkan supaya
  // kartu di atas tidak pernah menyebut angka yang tidak bisa ditemukan di
  // tabel di bawahnya.
  const kartu = {
    dealBelum: dalamTanggal.filter(q => !q.purchasing_projected_at && q.deal_status === 'deal').length,
    belum:     dalamTanggal.filter(q => !q.purchasing_projected_at).length,
    menunggu:  dalamTanggal.filter(q => q.purchasing_projected_at && (q.purchasing_status || 'pending') === 'pending').length,
    kurang:    Object.keys(kurangMap).length,
  }

  const projCounts = { all: dalamTanggal.length, sudah: 0, belum: 0 }
  dalamTanggal.forEach(q => { if (q.purchasing_projected_at) projCounts.sudah++; else projCounts.belum++ })
  const counts = { all: byProj.length, pending: 0, approved: 0, hold: 0, cancelled: 0 }
  byProj.forEach(q => { if (counts[q.purchasing_status] !== undefined) counts[q.purchasing_status]++ })
  const dealCounts = { all: byPStatus.length, deal:0, followup:0, no_deal:0, quoted:0, none:0 }
  byPStatus.forEach(q => { const k = q.deal_status || 'none'; if (dealCounts[k] !== undefined) dealCounts[k]++ })

  function elapsed(ts) {
    if (!ts) return '—'
    const mins = Math.floor((Date.now() - new Date(ts)) / 60000)
    if (mins < 60) return `${mins}m lalu`
    if (mins < 1440) return `${Math.floor(mins/60)}j lalu`
    return `${Math.floor(mins/1440)}h lalu`
  }

  return (
    <Layout title="Antrian Purchasing">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <span style={{
          display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: pulse ? '#16a34a' : '#d1d5db',
          transition:'background 0.3s'
        }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>Live — update otomatis saat ada quotation dikirim</span>
      </div>

      {/* Kartu ringkasan sekaligus pintasan filter.
          Angkanya dihitung dari SELURUH data, tidak ikut filter yang sedang
          aktif -- supaya selalu menunjukkan beban kerja sebenarnya.
          Kartu 1 adalah bagian dari kartu 2; itu disengaja, karena "Deal"
          adalah prioritas DI DALAM tumpukan yang belum diproyeksi. */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:18 }}>
        {[
          { key:'deal_belum', ikon:'⚠️', warna:'#A32D2D', jumlah:kartu.dealBelum, label:'Deal belum diproyeksi',
            set:() => { setProjFilter('belum'); setDealFilter('deal'); setFilter('all') } },
          { key:'belum', ikon:'📋', warna:'#854F0B', jumlah:kartu.belum, label:'Belum diproyeksi',
            set:() => { setProjFilter('belum'); setDealFilter('all'); setFilter('all') } },
          { key:'menunggu', ikon:'⏳', warna:'#185FA5', jumlah:kartu.menunggu, label:'Menunggu validasi',
            set:() => { setProjFilter('sudah'); setDealFilter('all'); setFilter('pending') } },
          // Estimator menambah item setelah purchasing selesai memproyeksikan.
          // Barisnya ada, harganya belum ada yang mengisi -- harus dikerjakan
          // secepatnya, jadi ikut jadi kartu supaya langsung kelihatan.
          { key:'kurang', ikon:'➕', warna:'#7C3AED', jumlah:kartu.kurang, label:'Ada item kurang',
            set:() => { setProjFilter('kurang'); setDealFilter('all'); setFilter('all') } },
        ].map(k => (
          <button key={k.key} onClick={k.set} title="Klik untuk memasang filter ini" style={{
            flex:'1 1 200px', minWidth:200, textAlign:'left', cursor:'pointer',
            background:'#fff', borderRadius:12, padding:'14px 16px',
            border:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{
              width:38, height:38, borderRadius:10, flexShrink:0, fontSize:17,
              background:k.warna+'18', display:'flex', alignItems:'center', justifyContent:'center',
            }}>{k.ikon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:k.warna, lineHeight:1.1 }}>{k.jumlah}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{k.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filter dropdown. Angka di dalam tanda kurung bertingkat mengikuti
          filter di atasnya (Proyeksi -> Purchasing -> Deal). */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
        <select value={projFilter} onChange={e => setProjFilter(e.target.value)} style={s.select}>
          <option value="all">Semua Proyeksi ({projCounts.all})</option>
          <option value="belum">Belum Diproyeksi ({projCounts.belum})</option>
          <option value="sudah">Sudah Diproyeksi ({projCounts.sudah})</option>
          <option value="kurang">Ada Item Kurang ({kartu.kurang})</option>
        </select>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={s.select}>
          <option value="all">Semua Status Purchasing ({counts.all})</option>
          <option value="pending">Belum Diputuskan ({counts.pending})</option>
          <option value="approved">Disetujui ({counts.approved})</option>
          <option value="hold">Hold ({counts.hold})</option>
          <option value="cancelled">Cancelled ({counts.cancelled})</option>
        </select>
        <select value={dealFilter} onChange={e => setDealFilter(e.target.value)} style={s.select}>
          <option value="all">Semua Status Deal ({dealCounts.all})</option>
          <option value="deal">Deal ({dealCounts.deal})</option>
          <option value="followup">Follow Up ({dealCounts.followup})</option>
          <option value="no_deal">Tidak Deal ({dealCounts.no_deal})</option>
          <option value="quoted">Quoted ({dealCounts.quoted})</option>
          <option value="none">Deal belum diisi ({dealCounts.none})</option>
        </select>
        <FilterTanggal dari={tglDari} sampai={tglSampai} setDari={setTglDari} setSampai={setTglSampai}
          label="Masuk antrean" title="Saring berdasarkan tanggal order dikirim ke purchasing" />
        {(projFilter !== 'all' || filter !== 'all' || dealFilter !== 'all' || tglDari || tglSampai) && (
          <button onClick={() => { setProjFilter('all'); setFilter('all'); setDealFilter('all'); setTglDari(''); setTglSampai('') }} style={{
            padding:'7px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff',
            fontSize:13, color:'#6b7280', cursor:'pointer', fontWeight:500,
          }}>✕ Reset Filter</button>
        )}
      </div>

      <input
        type="text"
        placeholder="Cari no. request, customer, atau produk..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ width:'100%', padding:'8px 14px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:12, color:'#374151' }}
      />
      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6 }}>{filtered.length} total</div>
      <div style={{ maxHeight:560, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
        <table style={s.table}>
          <thead style={{ position:'sticky', top:0, zIndex:1, background:'#f9fafb' }}>
            <tr>
              <th style={s.th}>No. Request</th>
              <th style={s.th}>Kode Order</th>
              <th style={s.th}>Customer / Produk</th>
              <th style={s.th}>Qty</th>
              <th style={s.th}>Harga Estimator</th>
              <th style={s.th}>Proyeksi</th>
              <th style={s.th}>Status Purchasing</th>
              <th style={s.th}>Status Deal</th>
              <th style={s.th}>Dikirim</th>
              <th style={s.th}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ ...s.td, color:'#9ca3af', textAlign:'center', padding:40 }}>
                Tidak ada quotation
              </td></tr>
            )}
            {filtered.map(q => (
              <tr key={q.id}>
                <td style={s.td}><div style={{ fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>{q.requests?.request_number}</div></td>
                <td style={s.td}>
                  {q.kode_order ? (
                    <div style={{ fontFamily:'monospace', fontSize:12, color:'#111827', fontWeight:600 }}>{q.kode_order}</div>
                  ) : (
                    <div style={{ fontSize:11, color:'#b45309' }} title="Sales belum mengisi Kode Order, jadi order ini belum tersambung ke order ERP">⚠️ Belum ditagging Sales</div>
                  )}
                </td>
                <td style={s.td}>
                  <div style={{ fontWeight:500 }}>{q.customer_name}</div>
                  <div style={{ fontSize:12, color:'#9ca3af' }}>{q.product_type}</div>
                </td>
                <td style={s.td}>{(q.quantity || 0).toLocaleString('id-ID')}</td>
                <td style={s.td}><div style={{ fontWeight:500 }}>Rp {(q.selling_price || 0).toLocaleString('id-ID')}</div></td>
                <td style={s.td}>
                  {q.purchasing_projected_at
                    ? <span style={s.badge('#3B6D11')} title={`Diproyeksikan ${new Date(q.purchasing_projected_at).toLocaleString('id-ID')}`}>✓ Sudah</span>
                    : <span style={s.badge('#854F0B')} title="Purchasing belum menyimpan proyeksi biaya untuk order ini">Belum</span>}
                  {/* Estimator menambah item setelah proyeksi selesai. Baris
                      itu belum ada harga purchasing-nya, jadi ditandai supaya
                      langsung dikerjakan, bukan ketinggalan diam-diam. */}
                  {kurangMap[q.id] && (
                    <div style={{ marginTop:4 }}>
                      <span
                        style={{ ...s.badge('#7C3AED'), cursor:'help' }}
                        title={`Item yang belum ada harga purchasing (${kurangMap[q.id].count}):\n- ${kurangMap[q.id].names.join('\n- ')}`}
                      >➕ {kurangMap[q.id].count} item kurang</span>
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  <select
                    value={q.purchasing_status || 'pending'}
                    onChange={e => updatePurchasingStatus(q.id, e.target.value)}
                    style={{
                      padding:'5px 8px', borderRadius:6, fontSize:12, border:'1px solid #e5e7eb',
                      background:'#fff', fontWeight:500, cursor:'pointer',
                      color: PSTATUS_COLOR[q.purchasing_status] || '#9ca3af',
                    }}
                  >
                    <option value="pending">Belum Diputuskan</option>
                    <option value="approved">Disetujui ✅</option>
                    <option value="hold">Hold ⏸️</option>
                    <option value="cancelled">Cancel ❌</option>
                  </select>
                </td>
                <td style={s.td}>
                  <span style={s.badge(DEAL_COLOR[q.deal_status] || '#9ca3af')}>{DEAL_LABEL[q.deal_status] || 'Belum diisi'}</span>
                  {/* Keputusan sebelumnya dicabut karena estimator mengubah
                      perhitungan. Ditandai supaya purchasing tahu ini bukan
                      order baru, melainkan order yang pernah mereka putuskan. */}
                  {q.decision_reset_note && (
                    <div style={{ marginTop:4 }}>
                      <span style={{ ...s.badge('#B45309'), cursor:'help' }} title={q.decision_reset_note}>
                        ↻ Keputusan direset
                      </span>
                    </div>
                  )}
                </td>
                <td style={s.td}><div style={{ fontSize:12, color:'#9ca3af' }}>{elapsed(q.sent_to_purchasing_at)}</div></td>
                <td style={s.td}>
                  <button style={s.btnPrimary} onClick={() => navigate(`/purchasing/${q.id}`)}>
                    {q.purchasing_status === 'pending' ? 'Validasi' : 'Lihat'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
