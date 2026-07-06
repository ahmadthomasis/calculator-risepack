import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import Layout from '../../components/Layout'
import {
  FORM_TYPE_SHORT, deriveStatus, STATUS_LABEL, STATUS_COLOR,
  statusWaktu, WAKTU_COLOR, lamaHari, fmtDate,
  KEPUASAN_LABEL, DEAL_LABEL, BAYAR_LABEL,
} from '../../lib/prodev'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:  { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  th:    { textAlign:'left', padding:'10px 10px', fontSize:11, color:C.brown, borderBottom:`2px solid ${C.border}`, fontWeight:600, whiteSpace:'nowrap' },
  td:    { padding:'10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, verticalAlign:'top' },
  badge: (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:11.5, fontWeight:600, background:c+'1c', color:c, whiteSpace:'nowrap' }),
  selectMini: { padding:'4px 6px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, outline:'none', background:'#fff', color:C.dark },
}

// Kartu ringkasan atas
function Stat({ label, value, color }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'18px 22px', border:`1px solid ${C.border}`, boxShadow:'0 1px 4px rgba(44,24,16,0.06)', flex:1, minWidth:130 }}>
      <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{label}</div>
    </div>
  )
}

export default function ProdevList() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [orders, setOrders]   = useState([])
  const [names, setNames]     = useState({})     // profil id -> full_name
  const [filter, setFilter]   = useState('all')  // all|layout|rakit|terima|selesai
  const [typeFilter, setTypeFilter] = useState('all') // all|fps|fsa
  const [search, setSearch]   = useState('')
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('prodev-list-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'prodev_orders' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchOrders() {
    // Manager melihat semua; innersales hanya miliknya sendiri
    let q = supabase.from('prodev_orders').select('*').order('created_at', { ascending:false })
    if (profile?.role !== 'manager') q = q.eq('created_by', profile.id)
    const { data } = await q
    setOrders(data || [])

    const { data: profs } = await supabase.from('profiles').select('id, full_name')
    setNames(Object.fromEntries((profs || []).map(p => [p.id, p.full_name])))
  }

  // Update satu field penilaian akhir langsung dari tabel
  async function updateField(id, field, value) {
    setSavingId(id)
    const { error } = await supabase.from('prodev_orders').update({ [field]: value }).eq('id', id)
    if (error) alert('Gagal menyimpan: ' + error.message)
    setSavingId(null)
  }

  async function deleteOrder(o) {
    if (!confirm(`Hapus ${FORM_TYPE_SHORT[o.form_type]} untuk ${o.customer_name}? Hanya bisa selama layout belum dikerjakan.`)) return
    const { error } = await supabase.from('prodev_orders').delete().eq('id', o.id)
    if (error) alert('Gagal menghapus: ' + error.message)
  }

  const counts = { all: 0, layout: 0, rakit: 0, terima: 0, selesai: 0 }
  orders.forEach(o => {
    const st = deriveStatus(o)
    if (st !== 'cancelled') counts.all++
    if (counts[st] !== undefined) counts[st]++
  })

  const filtered = orders
    .filter(o => filter === 'all' ? !o.is_cancelled : deriveStatus(o) === filter)
    .filter(o => typeFilter === 'all' || o.form_type === typeFilter)
    .filter(o => {
      const t = search.trim().toLowerCase()
      if (!t) return true
      return [o.customer_name, o.nama_customer, o.brand_name, o.kode_order].some(v => (v || '').toLowerCase().includes(t))
    })

  return (
    <Layout title="Prodev — FPS & FSA">
      {/* Ringkasan */}
      <div style={{ display:'flex', gap:14, marginBottom:20, flexWrap:'wrap' }}>
        <Stat label="Proses Layout"     value={counts.layout}  color="#d97706" />
        <Stat label="Proses Rakit"      value={counts.rakit}   color="#2563eb" />
        <Stat label="Menunggu Diterima" value={counts.terima}  color="#7c3aed" />
        <Stat label="Selesai"           value={counts.selesai} color="#16a34a" />
      </div>

      <div style={s.card}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.dark, marginRight:'auto' }}>
            {profile?.role === 'manager' ? 'Semua Order Prodev' : 'Order Prodev Saya'}
          </div>
          <input placeholder="Cari customer / brand / kode order..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:'none', width:230 }} />
          <select style={s.selectMini} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">FPS + FSA</option>
            <option value="fps">FPS saja</option>
            <option value="fsa">FSA saja</option>
          </select>
          {profile?.role !== 'manager' && (
            <>
              <button onClick={() => navigate('/prodev/new/fps')} style={{ padding:'9px 16px', background:C.orange, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ FPS Baru</button>
              <button onClick={() => navigate('/prodev/new/fsa')} style={{ padding:'9px 16px', background:C.dark, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ FSA Baru</button>
            </>
          )}
        </div>

        {/* Filter status */}
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {[['all','Semua'],['layout','Proses Layout'],['rakit','Proses Rakit'],['terima','Menunggu Diterima'],['selesai','Selesai']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding:'6px 14px', borderRadius:20, fontSize:12.5, fontWeight:600, cursor:'pointer',
              border: filter === val ? `1px solid ${C.orange}` : `1px solid ${C.border}`,
              background: filter === val ? '#fff7ed' : '#fff',
              color: filter === val ? C.orange : '#6b7280',
            }}>{lbl} ({counts[val] ?? 0})</button>
          ))}
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1300 }}>
            <thead><tr>
              {['Tipe','Kode Order','Customer','Produk','Deadline','Layouter','Status','Selesai Layout','Selesai Rakit','Ket. Waktu','Hari','Diterima','Rev. Kons.','Rev. Prodev','Kepuasan','Deal','Bayar', formTypeHasFsa(filtered) ? 'Dummy Final' : null,'Aksi']
                .filter(Boolean).map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={19} style={{ ...s.td, textAlign:'center', color:'#9ca3af', padding:30 }}>Belum ada data.</td></tr>
              )}
              {filtered.map(o => {
                const st       = deriveStatus(o)
                const wLayout  = statusWaktu(o.tanggal_selesai_layout, o.deadline)
                const wRakit   = statusWaktu(o.tanggal_selesai_rakit, o.deadline)
                const hari     = lamaHari(o.tanggal_pengajuan, o.tanggal_selesai_rakit)
                const editable = st !== 'cancelled' // penilaian bisa diisi kapan pun setelah dibuat
                const busy     = savingId === o.id
                return (
                  <tr key={o.id} style={{ opacity: busy ? 0.5 : 1 }}>
                    <td style={s.td}>
                      <span style={s.badge(o.form_type === 'fps' ? C.orange : '#1251A3')}>{FORM_TYPE_SHORT[o.form_type]}</span>
                    </td>
                    <td style={{ ...s.td, fontSize:11.5, whiteSpace:'nowrap' }}>{o.kode_order || '—'}</td>
                    <td style={{ ...s.td, fontWeight:600 }}>
                      {o.customer_name}
                      {o.nama_customer && <div style={{ fontSize:11, color:C.brown, fontWeight:500 }}>{o.nama_customer}</div>}
                      {o.revisi_ke > 0 && <div style={{ marginTop:3 }}><span style={{ ...s.badge('#7c3aed'), fontSize:10 }} title={o.keterangan_revisi || ''}>Revisi {o.revisi_ke}</span></div>}
                    </td>
                    <td style={s.td}>{o.brand_name || '—'}<div style={{ fontSize:11, color:'#9ca3af' }}>{o.jenis_kemasan}{o.model_layout ? ` · ${o.model_layout}` : ''}</div></td>
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>{fmtDate(o.deadline)}</td>
                    <td style={s.td}>{names[o.layouter_id] || '—'}</td>
                    <td style={s.td}><span style={s.badge(STATUS_COLOR[st])}>{STATUS_LABEL[st]}</span></td>
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>{fmtDate(o.tanggal_selesai_layout)}</td>
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                      {fmtDate(o.tanggal_selesai_rakit)}
                      {o.sample_maker_id && <div style={{ fontSize:11, color:'#9ca3af' }}>{names[o.sample_maker_id]}</div>}
                    </td>
                    <td style={s.td}>
                      {wRakit ? <span style={s.badge(WAKTU_COLOR[wRakit])}>{wRakit}</span>
                        : wLayout ? <span style={{ ...s.badge(WAKTU_COLOR[wLayout]), opacity:0.65 }} title="Status waktu layout (rakit belum selesai)">{wLayout}</span>
                        : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign:'center' }}>{hari ?? '—'}</td>
                    <td style={{ ...s.td, textAlign:'center' }}>
                      <input type="checkbox" checked={o.status_diterima_sales} disabled={!editable || busy}
                        onChange={e => updateField(o.id, 'status_diterima_sales', e.target.checked)}
                        style={{ width:16, height:16, cursor:'pointer' }} />
                    </td>
                    <td style={s.td}>
                      <select style={s.selectMini} value={o.revisi_konsumen} disabled={!editable || busy}
                        onChange={e => updateField(o.id, 'revisi_konsumen', parseInt(e.target.value))}>
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? '—' : `Rev${n}`}</option>)}
                      </select>
                    </td>
                    <td style={{ ...s.td, textAlign:'center' }} title="Diisi oleh sample maker saat mengembalikan layout">
                      {o.revisi_prodev > 0
                        ? <span style={s.badge('#c2410c')}>Rev{o.revisi_prodev}</span>
                        : <span style={{ color:'#d1d5db' }}>—</span>}
                    </td>
                    <td style={s.td}>
                      <select style={s.selectMini} value={o.tingkat_kepuasan || ''} disabled={!editable || busy}
                        onChange={e => updateField(o.id, 'tingkat_kepuasan', e.target.value || null)}>
                        <option value="">—</option>
                        {Object.entries(KEPUASAN_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td style={s.td}>
                      <select style={s.selectMini} value={o.status_deal || ''} disabled={!editable || busy}
                        onChange={e => updateField(o.id, 'status_deal', e.target.value || null)}>
                        <option value="">—</option>
                        {Object.entries(DEAL_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td style={s.td}>
                      <select style={s.selectMini} value={o.status_bayar || ''} disabled={!editable || busy}
                        onChange={e => updateField(o.id, 'status_bayar', e.target.value || null)}>
                        <option value="">—</option>
                        {Object.entries(BAYAR_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    {formTypeHasFsa(filtered) && (
                      <td style={s.td}>
                        {o.form_type === 'fsa'
                          ? (o.status_dummy_final === 'tersedia'
                              ? <span style={s.badge('#1251A3')}>Tersedia</span>
                              : <span style={{ fontSize:12, color:'#9ca3af' }}>Belum</span>)
                          : <span style={{ color:'#d1d5db' }}>—</span>}
                      </td>
                    )}
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                      {profile?.role !== 'manager' && !o.tanggal_selesai_layout && (
                        <>
                          <button onClick={() => navigate(`/prodev/edit/${o.id}`)} style={{ padding:'4px 10px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', color:C.brown, marginRight:6 }}>Edit</button>
                          <button onClick={() => deleteOrder(o)} style={{ padding:'4px 10px', background:'#fff', border:'1px solid #fecaca', borderRadius:6, fontSize:12, cursor:'pointer', color:'#dc2626', marginRight:6 }}>Hapus</button>
                        </>
                      )}
                      {profile?.role !== 'manager' && o.revisi_konsumen > 0 && (
                        <button onClick={() => navigate(`/prodev/revisi/${o.id}`)}
                          title="Buat FPS baru untuk revisi konsumen (isian ter-copy dari order ini)"
                          style={{ padding:'4px 10px', background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:6, fontSize:12, cursor:'pointer', color:'#7c3aed', fontWeight:600 }}>
                          ⟳ FPS Ulang · Revisi {(o.revisi_ke || 0) + 1}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}

// Kolom Dummy Final hanya ditampilkan kalau ada FSA di daftar yang sedang tampil
function formTypeHasFsa(list) {
  return list.some(o => o.form_type === 'fsa')
}
