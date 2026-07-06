import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import Layout from '../../components/Layout'
import { PACDORA_DIELINES_URL } from '../../lib/prodev'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:   { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  th:     { textAlign:'left', padding:'9px 10px', fontSize:11, color:C.brown, borderBottom:`2px solid ${C.border}`, fontWeight:600 },
  td:     { padding:'9px 10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, verticalAlign:'middle' },
  input:  { width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, outline:'none', boxSizing:'border-box', background:'#fff', color:C.dark },
  btn:    { padding:'6px 13px', background:C.orange, color:'#fff', border:'none', borderRadius:7, fontSize:12.5, cursor:'pointer', fontWeight:600 },
  btnGhost:{ padding:'6px 12px', background:'#fff', color:C.brown, border:`1px solid ${C.border}`, borderRadius:7, fontSize:12.5, cursor:'pointer' },
  del:    { padding:'5px 9px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, fontSize:12, cursor:'pointer' },
}

const emptyRow = { kategori:'', nama_model:'', pacdora_url:'' }

export default function TemplateLibrary() {
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'
  const [rows, setRows]     = useState([])
  const [loading, setLoad]  = useState(true)
  const [adding, setAdding] = useState(emptyRow)
  const [editId, setEditId] = useState(null)
  const [editRow, setEditRow] = useState(emptyRow)
  const [busy, setBusy]     = useState(false)

  useEffect(() => { fetchRows() }, [])

  async function fetchRows() {
    const { data } = await supabase.from('prodev_templates').select('*').order('sort').order('nama_model')
    setRows(data || [])
    setLoad(false)
  }

  async function addRow() {
    if (!adding.kategori.trim() || !adding.nama_model.trim()) { alert('Kategori & nama model wajib diisi.'); return }
    setBusy(true)
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sort || 0), 0)
    const { error } = await supabase.from('prodev_templates').insert({
      kategori: adding.kategori.trim(), nama_model: adding.nama_model.trim(),
      pacdora_url: adding.pacdora_url.trim() || null, sort: maxSort + 1,
    })
    setBusy(false)
    if (error) { alert('Gagal: ' + error.message); return }
    setAdding(emptyRow); fetchRows()
  }

  async function saveEdit(id) {
    setBusy(true)
    const { error } = await supabase.from('prodev_templates').update({
      kategori: editRow.kategori.trim(), nama_model: editRow.nama_model.trim(),
      pacdora_url: (editRow.pacdora_url || '').trim() || null,
    }).eq('id', id)
    setBusy(false)
    if (error) { alert('Gagal: ' + error.message); return }
    setEditId(null); fetchRows()
  }

  async function delRow(r) {
    if (!confirm(`Hapus template "${r.nama_model}"?`)) return
    setBusy(true)
    const { error } = await supabase.from('prodev_templates').delete().eq('id', r.id)
    setBusy(false)
    if (error) { alert('Gagal: ' + error.message); return }
    fetchRows()
  }

  // Kelompokkan per kategori untuk tampilan
  const groups = {}
  rows.forEach(r => { (groups[r.kategori] ||= []).push(r) })

  return (
    <Layout title="Template Library (Pacdora)">
      <div style={s.card}>
        <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:4 }}>Template Library — Model Layout → Template Pacdora</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginBottom:2 }}>
          Daftar model yang dipakai tim, terhubung ke template resmi Pacdora. Layouter memilih model ini saat buat FPS/FSA;
          tombol <b>Buka Template</b> di antrian langsung membuka link yang sesuai.
        </div>
        <div style={{ fontSize:12, color:'#9ca3af' }}>
          Katalog Pacdora: <a href={PACDORA_DIELINES_URL} target="_blank" rel="noreferrer" style={{ color:'#2563eb' }}>{PACDORA_DIELINES_URL}</a>
          {isManager && ' · Kamu bisa mengganti URL kategori dengan link template spesifik (pola /dielines-detail/...).'}
        </div>
      </div>

      {loading ? (
        <div style={{ padding:50, textAlign:'center', color:'#9ca3af' }}>Memuat...</div>
      ) : (
        <div style={s.card}>
          {/* Form tambah (manager saja) */}
          {isManager && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 2fr auto', gap:8, marginBottom:16, alignItems:'center' }}>
              <input style={s.input} placeholder="Kategori (cth. Tuck End)" value={adding.kategori} onChange={e => setAdding(a => ({ ...a, kategori:e.target.value }))} />
              <input style={s.input} placeholder="Nama model" value={adding.nama_model} onChange={e => setAdding(a => ({ ...a, nama_model:e.target.value }))} />
              <input style={s.input} placeholder="URL template Pacdora (opsional)" value={adding.pacdora_url} onChange={e => setAdding(a => ({ ...a, pacdora_url:e.target.value }))} />
              <button style={s.btn} disabled={busy} onClick={addRow}>+ Tambah</button>
            </div>
          )}

          {rows.length === 0 && <div style={{ color:'#9ca3af', fontSize:13, padding:20, textAlign:'center' }}>Belum ada template. {isManager ? 'Tambahkan di atas.' : 'Minta manager mengisi daftar.'}</div>}

          {Object.entries(groups).map(([kat, list]) => (
            <div key={kat} style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.orange, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>{kat}</div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  {list.map(r => editId === r.id ? (
                    <tr key={r.id}>
                      <td style={{ ...s.td, width:'22%' }}><input style={s.input} value={editRow.kategori} onChange={e => setEditRow(x => ({ ...x, kategori:e.target.value }))} /></td>
                      <td style={{ ...s.td, width:'26%' }}><input style={s.input} value={editRow.nama_model} onChange={e => setEditRow(x => ({ ...x, nama_model:e.target.value }))} /></td>
                      <td style={s.td}><input style={s.input} value={editRow.pacdora_url || ''} onChange={e => setEditRow(x => ({ ...x, pacdora_url:e.target.value }))} /></td>
                      <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                        <button style={{ ...s.btn, marginRight:6 }} disabled={busy} onClick={() => saveEdit(r.id)}>Simpan</button>
                        <button style={s.btnGhost} onClick={() => setEditId(null)}>Batal</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id}>
                      <td style={{ ...s.td, width:'22%', color:'#9ca3af' }}>{r.kategori}</td>
                      <td style={{ ...s.td, width:'26%', fontWeight:600 }}>{r.nama_model}</td>
                      <td style={s.td}>
                        {r.pacdora_url
                          ? <a href={r.pacdora_url} target="_blank" rel="noreferrer" style={{ color:'#2563eb', wordBreak:'break-all', fontSize:12.5 }}>{r.pacdora_url}</a>
                          : <span style={{ color:'#d1d5db' }}>— belum ada link —</span>}
                      </td>
                      <td style={{ ...s.td, whiteSpace:'nowrap' }}>
                        {r.pacdora_url && <a href={r.pacdora_url} target="_blank" rel="noreferrer" style={{ ...s.btnGhost, textDecoration:'none', marginRight:6 }}>Buka ↗</a>}
                        {isManager && (
                          <>
                            <button style={{ ...s.btnGhost, marginRight:6 }} onClick={() => { setEditId(r.id); setEditRow({ kategori:r.kategori, nama_model:r.nama_model, pacdora_url:r.pacdora_url || '' }) }}>Edit</button>
                            <button style={s.del} disabled={busy} onClick={() => delRow(r)}>Hapus</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
