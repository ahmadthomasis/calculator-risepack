import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import Layout from '../../components/Layout'
import {
  FORM_TYPE_SHORT, FORM_TYPE_LABEL, STATUS_JASA_LABEL,
  deriveStatus, STATUS_LABEL, STATUS_COLOR,
  statusWaktu, WAKTU_COLOR, fmtDate, todayStr,
  templateUrlFor, PRODEV_BUCKET, DESIGN_FILE_ACCEPT, fileEntry, fileNameFromUrl, displayCustomer,
} from '../../lib/prodev'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:  { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  th:    { textAlign:'left', padding:'10px 10px', fontSize:11, color:C.brown, borderBottom:`2px solid ${C.border}`, fontWeight:600, whiteSpace:'nowrap' },
  td:    { padding:'10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, verticalAlign:'top' },
  badge: (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:11.5, fontWeight:600, background:c+'1c', color:c, whiteSpace:'nowrap' }),
  btnGreen:  { padding:'6px 13px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, fontSize:12.5, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' },
  btnBlue:   { padding:'6px 13px', background:'#2563eb', color:'#fff', border:'none', borderRadius:7, fontSize:12.5, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' },
  btnGhost:  { padding:'6px 13px', background:'#fff', color:C.brown, border:`1px solid ${C.border}`, borderRadius:7, fontSize:12.5, cursor:'pointer', whiteSpace:'nowrap' },
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'18px 22px', border:`1px solid ${C.border}`, boxShadow:'0 1px 4px rgba(44,24,16,0.06)', flex:1, minWidth:130 }}>
      <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{label}</div>
    </div>
  )
}

// ── Modal detail order ────────────────────────────────────────────────────────
function DetailModal({ order: o, names, onClose, onUploadResult, onDeleteFile, uploadingResult, isLayouter }) {
  const resultRef = useRef()
  if (!o) return null
  const st = deriveStatus(o)
  const designFiles = (o.design_files || []).map(fileEntry)
  const resultFiles = (o.layout_result_files || []).map(fileEntry)
  const tplUrl = templateUrlFor(o)
  const Row = ({ k, v }) => (
    <div style={{ display:'flex', borderBottom:`1px solid ${C.cream}`, padding:'7px 0' }}>
      <div style={{ width:210, fontSize:12, color:'#9ca3af', flexShrink:0 }}>{k}</div>
      <div style={{ fontSize:13, color:C.dark, whiteSpace:'pre-wrap' }}>{v || '—'}</div>
    </div>
  )
  const list = (arr) => (arr || []).length ? arr.map((v, i) => `${arr.length > 1 ? `Part ${i+1}: ` : ''}${v}`).join('\n') : null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:28, maxWidth:760, width:'100%', maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:C.dark }}>{FORM_TYPE_LABEL[o.form_type]}</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{o.kode_order || 'Tanpa kode order'}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', ...s.btnGhost }}>Tutup ✕</button>
        </div>

        <div style={{ fontSize:13, fontWeight:700, color:C.orange, margin:'14px 0 4px' }}>INFORMASI KONSUMEN</div>
        <Row k="Nama Perusahaan" v={o.customer_name} />
        <Row k="Nama Customer" v={o.nama_customer} />
        <Row k="Nama Product/Brand" v={o.brand_name} />
        <Row k="Email / No. WA" v={o.contact} />
        <Row k="Tanggal Pengajuan" v={fmtDate(o.tanggal_pengajuan)} />
        <Row k="Deadline" v={fmtDate(o.deadline)} />
        <Row k="PIC Sales" v={o.pic_sales} />
        <Row k="Innersales (pembuat)" v={names[o.created_by]} />
        <Row k="PIC Layouter" v={names[o.layouter_id]} />
        <Row k="Jenis Kemasan" v={o.jenis_kemasan} />
        <Row k="Model Layout" v={o.model_layout} />
        <Row k="Status Jasa" v={STATUS_JASA_LABEL[o.status_jasa]} />
        <Row k="Urgensi" v={o.urgensi} />
        <Row k="Jumlah Part dengan Sekat" v={o.jumlah_part ? `${o.jumlah_part} pcs` : null} />
        <Row k="Jumlah Kebutuhan" v={o.jumlah_kebutuhan} />
        <Row k="Potensial Omzet" v={o.potensial_omzet} />

        <div style={{ fontSize:13, fontWeight:700, color:C.orange, margin:'14px 0 4px' }}>DESKRIPSI PRODUK</div>
        <Row k="Dimensi Produk (P×L×T cm)" v={o.dimensi_produk} />
        <Row k="LP Layout / Area Desain" v={list(o.lp_layout)} />
        <Row k="Dimensi Kemasan per Part" v={list(o.dimensi_kemasan)} />
        <Row k="Bahan Kemasan" v={o.bahan_kemasan} />
        <Row k="Berat Produk" v={o.berat_produk} />
        <Row k="Finishing" v={list(o.finishing)} />
        <Row k="Jenis Sambungan" v={o.jenis_sambungan} />
        <Row k="Finishing Lainnya" v={o.finishing_lainnya} />

        {/* ── Pacdora + file kerja layouter ── */}
        <div style={{ fontSize:13, fontWeight:700, color:C.orange, margin:'16px 0 8px' }}>TEMPLATE PACDORA & FILE KERJA</div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
          <a href={tplUrl} target="_blank" rel="noreferrer"
            style={{ padding:'9px 16px', background:'#7c3aed', color:'#fff', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none' }}>
            🎨 Buka Template Pacdora ↗
          </a>
          {o.dimensi_produk && (
            <span style={{ fontSize:13, color:C.dark, background:C.cream, padding:'8px 12px', borderRadius:8, border:`1px solid ${C.border}` }}>
              Dimensi (P×L×T): <b>{o.dimensi_produk}</b> cm
            </span>
          )}
          {!o.template_url && (
            <span style={{ fontSize:11, color:'#9ca3af' }}>Belum ada link spesifik — membuka katalog dieline Pacdora.</span>
          )}
        </div>

        {/* File desain konsumen (download) */}
        <div style={{ fontSize:12, color:'#6b7280', margin:'6px 0 4px', fontWeight:600 }}>File desain dari konsumen</div>
        {designFiles.length === 0 ? (
          <div style={{ fontSize:12.5, color:'#9ca3af', marginBottom:8 }}>— tidak ada file —</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {designFiles.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 11px', background:C.cream, borderRadius:7, border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:12.5, color:C.dark, flex:1, wordBreak:'break-all' }}>📄 {f.name}</span>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#2563eb' }}>Download ↗</a>
              </div>
            ))}
          </div>
        )}

        {/* Hasil layout (upload oleh layouter) */}
        <div style={{ fontSize:12, color:'#6b7280', margin:'10px 0 4px', fontWeight:600 }}>Hasil layout (dieline export)</div>
        {resultFiles.length === 0 ? (
          <div style={{ fontSize:12.5, color:'#9ca3af', marginBottom:8 }}>— belum ada hasil diupload —</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {resultFiles.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 11px', background:'#f0fdf4', borderRadius:7, border:'1px solid #bbf7d0' }}>
                <span style={{ fontSize:12.5, color:C.dark, flex:1, wordBreak:'break-all' }}>✅ {f.name}</span>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#2563eb' }}>Buka ↗</a>
                {isLayouter && <button onClick={() => onDeleteFile(o, 'layout_result_files', i)} style={{ ...s.btnGhost, color:'#dc2626', borderColor:'#fecaca', padding:'4px 8px' }}>✕</button>}
              </div>
            ))}
          </div>
        )}
        {isLayouter && st === 'layout' && (
          <div>
            <button disabled={uploadingResult} onClick={() => resultRef.current?.click()} style={{ ...s.btnBlue, opacity: uploadingResult ? 0.6 : 1 }}>
              {uploadingResult ? 'Mengunggah...' : '+ Upload Hasil Layout'}
            </button>
            <input ref={resultRef} type="file" accept={DESIGN_FILE_ACCEPT} style={{ display:'none' }}
              onChange={async e => { await onUploadResult(o, e.target.files[0]); e.target.value = '' }} />
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>Upload hasil dulu supaya tombol "Layout Selesai" aktif.</div>
          </div>
        )}

        <div style={{ fontSize:13, fontWeight:700, color:C.orange, margin:'16px 0 4px' }}>LAMPIRAN</div>
        <Row k="Catatan" v={o.lampiran_text} />
        {o.lampiran_link && (
          <div style={{ display:'flex', borderBottom:`1px solid ${C.cream}`, padding:'7px 0' }}>
            <div style={{ width:210, fontSize:12, color:'#9ca3af', flexShrink:0 }}>Link Drive</div>
            <a href={o.lampiran_link} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#2563eb', wordBreak:'break-all' }}>{o.lampiran_link}</a>
          </div>
        )}
        {(o.lampiran_images || []).length > 0 && (
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:10 }}>
            {o.lampiran_images.map((url, i) => (
              <img key={i} src={url} alt={`lampiran ${i+1}`} onClick={() => window.open(url, '_blank')}
                style={{ height:110, width:110, objectFit:'cover', borderRadius:8, border:`1px solid ${C.border}`, cursor:'pointer' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProdevQueue() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [names, setNames]   = useState({})
  const [filter, setFilter] = useState('aktif')  // aktif|layout|rakit|selesai|all
  const [typeFilter, setTypeFilter] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [pulse, setPulse]   = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [uploadingResult, setUploadingResult] = useState(false)

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('prodev-queue-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'prodev_orders' }, () => {
        fetchOrders()
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchOrders() {
    const { data } = await supabase.from('prodev_orders').select('*')
      .eq('is_cancelled', false)
      .order('deadline', { ascending: true, nullsFirst: false })
    setOrders(data || [])
    const { data: profs } = await supabase.from('profiles').select('id, full_name')
    setNames(Object.fromEntries((profs || []).map(p => [p.id, p.full_name])))
  }

  // ── Aksi layouter: tandai layout selesai hari ini ──
  async function selesaiLayout(o) {
    if (!(o.layout_result_files || []).length) {
      alert('Upload file hasil layout dulu (klik "Detail" → Upload Hasil Layout) sebelum menandai selesai.')
      setDetailId(o.id)
      return
    }
    if (!confirm(`Tandai layout "${o.customer_name} — ${o.brand_name || o.jenis_kemasan}" selesai hari ini?`)) return
    setBusyId(o.id)
    const { error } = await supabase.from('prodev_orders')
      .update({ tanggal_selesai_layout: todayStr() }).eq('id', o.id)
    if (error) alert('Gagal: ' + error.message)
    setBusyId(null)
  }

  // ── Aksi sample maker: tandai rakit selesai hari ini ──
  // sample_maker_id otomatis = user yang menekan tombol (cth. Kiki)
  async function selesaiRakit(o) {
    if (!confirm(`Tandai rakit "${o.customer_name} — ${o.brand_name || o.jenis_kemasan}" selesai hari ini?`)) return
    setBusyId(o.id)
    const { error } = await supabase.from('prodev_orders')
      .update({ tanggal_selesai_rakit: todayStr(), sample_maker_id: profile.id }).eq('id', o.id)
    if (error) alert('Gagal: ' + error.message)
    setBusyId(null)
  }

  // Koreksi kalau salah klik (hanya sebelum tahap berikutnya jalan)
  async function batalkanTanggal(o, field) {
    if (!confirm('Kosongkan kembali tanggal ini?')) return
    setBusyId(o.id)
    const patch = { [field]: null }
    if (field === 'tanggal_selesai_rakit') patch.sample_maker_id = null
    const { error } = await supabase.from('prodev_orders').update(patch).eq('id', o.id)
    if (error) alert('Gagal: ' + error.message)
    setBusyId(null)
  }

  async function setDummyFinal(o, val) {
    setBusyId(o.id)
    const { error } = await supabase.from('prodev_orders')
      .update({ status_dummy_final: val || null }).eq('id', o.id)
    if (error) alert('Gagal: ' + error.message)
    setBusyId(null)
  }

  // ── Upload hasil layout (dieline export) ke bucket prodev-files ──
  async function uploadResult(o, file) {
    if (!file) return
    setUploadingResult(true)
    const safe = (file.name || 'file').replace(/[^\w.\-]+/g, '_')
    const path = `prodev/result/${o.id}/${Date.now()}_${safe}`
    const { error: upErr } = await supabase.storage.from(PRODEV_BUCKET).upload(path, file)
    if (upErr) { alert('Upload gagal: ' + upErr.message + '\n(Pastikan bucket "prodev-files" & migration Pacdora sudah dijalankan.)'); setUploadingResult(false); return }
    const { data: { publicUrl } } = supabase.storage.from(PRODEV_BUCKET).getPublicUrl(path)
    const next = [ ...(o.layout_result_files || []).map(fileEntry), { url: publicUrl, name: file.name || fileNameFromUrl(publicUrl) } ]
    const { error } = await supabase.from('prodev_orders').update({ layout_result_files: next }).eq('id', o.id)
    if (error) alert('Gagal menyimpan: ' + error.message)
    setUploadingResult(false)
  }

  // ── Hapus satu file (hasil layout) ──
  async function deleteFile(o, field, i) {
    if (!confirm('Hapus file ini?')) return
    const next = (o[field] || []).filter((_, idx) => idx !== i)
    const { error } = await supabase.from('prodev_orders').update({ [field]: next }).eq('id', o.id)
    if (error) alert('Gagal: ' + error.message)
  }

  const counts = { aktif:0, layout:0, rakit:0, selesai:0, all: orders.length }
  orders.forEach(o => {
    const st = deriveStatus(o)
    if (st === 'layout') { counts.layout++; counts.aktif++ }
    else if (st === 'rakit') { counts.rakit++; counts.aktif++ }
    else counts.selesai++ // terima + selesai dianggap selesai dari sisi prodev
  })

  const filtered = orders
    .filter(o => {
      const st = deriveStatus(o)
      if (filter === 'aktif')   return st === 'layout' || st === 'rakit'
      if (filter === 'layout')  return st === 'layout'
      if (filter === 'rakit')   return st === 'rakit'
      if (filter === 'selesai') return st === 'terima' || st === 'selesai'
      return true
    })
    .filter(o => typeFilter === 'all' || o.form_type === typeFilter)
    .filter(o => !mineOnly || o.layouter_id === profile?.id || o.sample_maker_id === profile?.id)

  const isManager     = profile?.role === 'manager'
  const isLayouter    = profile?.role === 'prodev'
  const isSampleMaker = profile?.role === 'sample_maker'

  return (
    <Layout title="Antrian Prodev">
      {/* Realtime indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background: pulse ? '#16a34a' : '#d1d5db', transition:'background 0.3s' }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>Live — update otomatis saat FPS/FSA baru masuk</span>
      </div>

      <div style={{ display:'flex', gap:14, marginBottom:20, flexWrap:'wrap' }}>
        <Stat label="Menunggu Layout" value={counts.layout}  color="#d97706" />
        <Stat label="Proses Rakit"    value={counts.rakit}   color="#2563eb" />
        <Stat label="Selesai"         value={counts.selesai} color="#16a34a" />
      </div>

      <div style={s.card}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginRight:'auto' }}>
            {[['aktif','Aktif'],['layout','Menunggu Layout'],['rakit','Proses Rakit'],['selesai','Selesai'],['all','Semua']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding:'6px 14px', borderRadius:20, fontSize:12.5, fontWeight:600, cursor:'pointer',
                border: filter === val ? `1px solid ${C.orange}` : `1px solid ${C.border}`,
                background: filter === val ? '#fff7ed' : '#fff',
                color: filter === val ? C.orange : '#6b7280',
              }}>{lbl} ({counts[val] ?? 0})</button>
            ))}
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12.5, outline:'none', background:'#fff', color:C.dark }}>
            <option value="all">FPS + FSA</option>
            <option value="fps">FPS saja</option>
            <option value="fsa">FSA saja</option>
          </select>
          {!isManager && (
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:C.brown, cursor:'pointer' }}>
              <input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} style={{ cursor:'pointer' }} />
              Tugas saya saja
            </label>
          )}
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1150 }}>
            <thead><tr>
              {['Tipe','Customer','Produk','Innersales','Deadline','Layouter','Status','Selesai Layout','Selesai Rakit','Ket. Waktu','Dummy Final','Aksi'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} style={{ ...s.td, textAlign:'center', color:'#9ca3af', padding:30 }}>Tidak ada order.</td></tr>
              )}
              {filtered.map(o => {
                const st      = deriveStatus(o)
                const wLayout = statusWaktu(o.tanggal_selesai_layout, o.deadline)
                const wRakit  = statusWaktu(o.tanggal_selesai_rakit, o.deadline)
                const busy    = busyId === o.id
                const lewat   = !o.tanggal_selesai_rakit && o.deadline && todayStr() > o.deadline
                return (
                  <tr key={o.id} style={{ opacity: busy ? 0.5 : 1, background: lewat ? '#fef2f2' : 'transparent' }}>
                    <td style={s.td}><span style={s.badge(o.form_type === 'fps' ? C.orange : '#1251A3')}>{FORM_TYPE_SHORT[o.form_type]}</span></td>
                    <td style={{ ...s.td, fontWeight:600 }}>
                      {o.customer_name}
                      {o.nama_customer && <div style={{ fontSize:11, color:C.brown, fontWeight:500 }}>{o.nama_customer}</div>}
                      {o.kode_order && <div style={{ fontSize:10.5, color:'#9ca3af' }}>{o.kode_order}</div>}
                    </td>
                    <td style={s.td}>{o.brand_name || '—'}<div style={{ fontSize:11, color:'#9ca3af' }}>{o.jenis_kemasan}{o.model_layout ? ` · ${o.model_layout}` : ''}</div></td>
                    <td style={s.td}>{names[o.created_by] || '—'}</td>
                    <td style={{ ...s.td, whiteSpace:'nowrap', color: lewat ? '#dc2626' : C.dark, fontWeight: lewat ? 600 : 400 }}>{fmtDate(o.deadline)}</td>
                    <td style={s.td}>{names[o.layouter_id] || '—'}</td>
                    <td style={s.td}><span style={s.badge(STATUS_COLOR[st])}>{STATUS_LABEL[st]}</span></td>
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                      {fmtDate(o.tanggal_selesai_layout)}
                      {wLayout && <div><span style={{ ...s.badge(WAKTU_COLOR[wLayout]), fontSize:10.5 }}>{wLayout}</span></div>}
                    </td>
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                      {fmtDate(o.tanggal_selesai_rakit)}
                      {o.sample_maker_id && <div style={{ fontSize:11, color:'#9ca3af' }}>{names[o.sample_maker_id]}</div>}
                      {wRakit && <div><span style={{ ...s.badge(WAKTU_COLOR[wRakit]), fontSize:10.5 }}>{wRakit}</span></div>}
                    </td>
                    <td style={s.td}>
                      {wRakit ? <span style={s.badge(WAKTU_COLOR[wRakit])}>{wRakit}</span> : '—'}
                    </td>
                    <td style={s.td}>
                      {o.form_type === 'fsa' ? (
                        <select disabled={!isSampleMaker || busy} value={o.status_dummy_final || ''}
                          onChange={e => setDummyFinal(o, e.target.value)}
                          style={{ padding:'4px 6px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, outline:'none', background:'#fff', color: o.status_dummy_final ? '#1251A3' : C.dark, fontWeight: o.status_dummy_final ? 600 : 400 }}>
                          <option value="">Belum</option>
                          <option value="tersedia">Tersedia</option>
                        </select>
                      ) : <span style={{ color:'#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                      <button style={{ ...s.btnGhost, marginRight:6 }} onClick={() => setDetailId(o.id)}>Detail</button>
                      {isLayouter && st === 'layout' && (
                        <>
                          <a href={templateUrlFor(o)} target="_blank" rel="noreferrer" title="Buka template dieline di Pacdora"
                            style={{ ...s.btnGhost, textDecoration:'none', marginRight:6, borderColor:'#c4b5fd', color:'#6d28d9' }}>🎨 Template ↗</a>
                          <button style={{ ...s.btnBlue, opacity: (o.layout_result_files||[]).length ? 1 : 0.55 }} disabled={busy}
                            title={(o.layout_result_files||[]).length ? 'Tandai layout selesai' : 'Upload hasil layout dulu (via Detail)'}
                            onClick={() => selesaiLayout(o)}>Layout Selesai</button>
                        </>
                      )}
                      {isSampleMaker && st === 'rakit' && (
                        <>
                          <button style={{ ...s.btnGreen, marginRight:6 }} disabled={busy} onClick={() => selesaiRakit(o)}>Rakit Selesai</button>
                          <button style={s.btnGhost} disabled={busy} title="Kosongkan tanggal selesai layout (salah klik)"
                            onClick={() => batalkanTanggal(o, 'tanggal_selesai_layout')}>↩</button>
                        </>
                      )}
                      {isSampleMaker && (st === 'terima') && (
                        <button style={s.btnGhost} disabled={busy} title="Kosongkan tanggal selesai rakit (salah klik)"
                          onClick={() => batalkanTanggal(o, 'tanggal_selesai_rakit')}>↩</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DetailModal
        order={orders.find(o => o.id === detailId) || null}
        names={names}
        isLayouter={isLayouter}
        uploadingResult={uploadingResult}
        onUploadResult={uploadResult}
        onDeleteFile={deleteFile}
        onClose={() => setDetailId(null)} />
    </Layout>
  )
}
