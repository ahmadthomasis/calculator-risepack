import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:   { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', border:`1px solid ${C.border}` },
  input:  { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', color:C.dark },
  select: { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', background:'#fff', color:C.dark },
  th:     { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:600, textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:     { padding:'8px 10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, verticalAlign:'middle' },
  btn:    { padding:'7px 14px', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', border:'none' },
}

const fmt = n => (n || 0).toLocaleString('id-ID')

const categoryLabel = {
  material: 'Material',
  cetak: 'Cetak',
  emboss_laminasi: 'Emboss/Laminasi',
  material_proses: 'Material Proses',
  additional: 'Additional',
}

const fieldsByCategory = {
  material:         [{ key:'price', label:'Harga / Lembar' }],
  cetak:            [{ key:'price', label:'Harga / Lembar' }, { key:'harga_mesin', label:'Harga Mesin' }, { key:'qty_threshold', label:'Qty Threshold' }],
  emboss_laminasi:  [{ key:'price', label:'Harga / cm²' }, { key:'minimum_charge', label:'Min. Charge' }],
  material_proses:  [{ key:'price', label:'Harga' }, { key:'rate_per_cm', label:'Rate / cm' }],
  additional:       [{ key:'price', label:'Harga' }, { key:'rate_per_kg', label:'Rate / kg' }, { key:'rate_a', label:'Rate A' }, { key:'rate_b', label:'Rate B' }, { key:'minimum_charge', label:'Min. Charge' }],
}

const SEGMENT_KEUANGAN_OPTIONS = [
  'Kertas', 'Plat', 'Pisau', 'Film/HVS', 'Klise Poly', 'Klise Emboss', 'Sample',
  'Bahan Baku Lainnya', 'Bahan Baku Forming', 'Bahan Baku Sticking', 'Bahan Baku Lem Panas',
  'Bahan Baku Lem Lapis', 'Bahan Baku Finishing', 'Cetak', 'Laminasi', 'Ongkos Poly',
  'Ongkos Emboss', 'Spot UV', 'Potong', 'Sticker/ Packaging Support', 'Vendor',
  'Jasa Pond Luar', 'Jasa Finishing Luar', 'Jasa Grooving Luar', 'Jasa Sticking Luar',
  'Jasa Forming Luar', 'Jasa Assemblying Luar', 'Packing', 'QC', 'Transport', 'Ngopek',
  'Mesin Pond', 'Upah Pond', 'Mesin Groving', 'Upah Groving', 'Mesin Sticking', 'Upah Sticking',
  'Mesin Forming', 'Upah Forming', 'Upah Assemblying', 'Mesin Lem Lapis', 'Upah Lem Lapis',
  'Mesin Lem Panas', 'Upah Lem Panas',
]

// Form kosong untuk tambah baru per kategori
const emptyForm = (category) => ({
  category: category !== 'all' ? category : 'material',
  name: '', spec: '', unit: 'lembar', gsm: '', segment_keuangan: '',
  price: '', rate_per_kg: '', rate_a: '', rate_b: '',
  minimum_charge: '', harga_mesin: '', qty_threshold: '', rate_per_cm: '',
})

function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(value) }, [value])

  const commit = async () => {
    const num = parseFloat(draft)
    if (isNaN(num) || num === value) { setEditing(false); setDraft(value); return }
    setSaving(true)
    await onSave(num)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <input autoFocus type="number" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        disabled={saving}
        style={{ ...s.input, width:110, textAlign:'right' }}
      />
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      style={{ background:'none', border:'1px dashed transparent', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:13, color:C.dark, fontWeight:500, textAlign:'right', minWidth:90 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.border}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      title="Klik untuk ubah"
    >
      {fmt(value)}
    </button>
  )
}

function EditableSegmentCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const commit = async (val) => {
    if (val === (value || '')) { setEditing(false); return }
    setSaving(true)
    await onSave(val || null)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <select autoFocus value={value || ''} disabled={saving}
        onChange={e => commit(e.target.value)}
        onBlur={() => setEditing(false)}
        style={{ ...s.select, width:'100%', minWidth:170 }}
      >
        <option value="">– pilih segment –</option>
        {SEGMENT_KEUANGAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      style={{ background:'none', border:'1px dashed transparent', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:13, color: value ? C.dark : '#d1d5db', fontWeight: value ? 500 : 400, textAlign:'left', width:'100%' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.border}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      title="Klik untuk ubah"
    >
      {value || '– pilih segment –'}
    </button>
  )
}

export default function PricingDataset() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [toast, setToast] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm('all'))
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // id row yang mau dihapus

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('raw_materials').select('*').eq('is_active', true)
      .order('category', { ascending: true }).order('name', { ascending: true })
    if (error) setError(error.message)
    else { setRows(data || []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  // ── Rumus Split Finishing WO (Upah / Bahan Baku / Mesin) ──────────────────
  const [finishingProsesList, setFinishingProsesList] = useState([])
  const [splitRules, setSplitRules] = useState({}) // proses -> { pct_upah, pct_bahan, pct_mesin }
  const [showSplitPanel, setShowSplitPanel] = useState(false)

  const fetchFinishingSplit = useCallback(async () => {
    const [{ data: fin }, { data: rules }] = await Promise.all([
      supabase.from('raw_materials').select('name').eq('category', 'finishing_wo'),
      supabase.from('finishing_wo_split_rules').select('*'),
    ])
    setFinishingProsesList([...new Set((fin || []).map(r => r.name))].sort())
    setSplitRules(Object.fromEntries((rules || []).map(r => [r.proses, r])))
  }, [])

  useEffect(() => { fetchFinishingSplit() }, [fetchFinishingSplit])

  // `next` HARUS berisi ketiga field (pct_upah/bahan/mesin) yang sudah digabung
  // dengan nilai baru oleh caller — bukan dibaca ulang dari state `splitRules`,
  // supaya aman kalau user ganti 3 input beruntun sebelum re-render sempat commit.
  const handleSplitUpdate = async (proses, next) => {
    setSplitRules(prev => ({ ...prev, [proses]: { ...next, proses } }))
    const { error } = await supabase.from('finishing_wo_split_rules')
      .upsert({
        proses, pct_upah: next.pct_upah || 0, pct_bahan: next.pct_bahan || 0, pct_mesin: next.pct_mesin || 0,
        segment_upah: next.segment_upah || null, segment_bahan: next.segment_bahan || null, segment_mesin: next.segment_mesin || null,
        updated_at: new Date().toISOString(),
      })
    if (error) showToast('error', 'Gagal simpan rumus split: ' + error.message)
    else showToast('success', 'Rumus split disimpan')
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !(r.spec || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, search, categoryFilter])

  const handleUpdate = async (id, field, value) => {
    const { error } = await supabase.from('raw_materials').update({ [field]: value }).eq('id', id)
    if (error) showToast('error', 'Gagal menyimpan: ' + error.message)
    else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
      showToast('success', 'Harga disimpan')
    }
  }

  const handleAdd = async () => {
    if (!addForm.name.trim()) { showToast('error', 'Nama wajib diisi'); return }
    setAdding(true)
    const payload = {
      category: addForm.category,
      name: addForm.name.trim(),
      spec: addForm.spec.trim() || null,
      unit: addForm.unit.trim() || null,
      notes: addForm.gsm.trim() || null,  // GSM disimpan di kolom notes
      segment_keuangan: addForm.segment_keuangan || null,
      price: parseFloat(addForm.price) || 0,
      is_active: true,
    }
    // Field opsional per kategori
    if (addForm.rate_per_kg) payload.rate_per_kg = parseFloat(addForm.rate_per_kg) || 0
    if (addForm.rate_a) payload.rate_a = parseFloat(addForm.rate_a) || 0
    if (addForm.rate_b) payload.rate_b = parseFloat(addForm.rate_b) || 0
    if (addForm.minimum_charge) payload.minimum_charge = parseFloat(addForm.minimum_charge) || 0
    if (addForm.harga_mesin) payload.harga_mesin = parseFloat(addForm.harga_mesin) || 0
    if (addForm.qty_threshold) payload.qty_threshold = parseFloat(addForm.qty_threshold) || 0
    if (addForm.rate_per_cm) payload.rate_per_cm = parseFloat(addForm.rate_per_cm) || 0

    const { error } = await supabase.from('raw_materials').insert(payload)
    if (error) showToast('error', 'Gagal tambah: ' + error.message)
    else {
      showToast('success', `Material "${payload.name}" berhasil ditambahkan`)
      setShowAddForm(false)
      setAddForm(emptyForm(categoryFilter))
      fetchRows()
    }
    setAdding(false)
  }

  const handleDelete = async (id) => {
    // Soft delete: set is_active = false
    const { error } = await supabase.from('raw_materials').update({ is_active: false }).eq('id', id)
    if (error) showToast('error', 'Gagal hapus: ' + error.message)
    else {
      setRows(prev => prev.filter(r => r.id !== id))
      showToast('success', 'Material dihapus')
    }
    setConfirmDelete(null)
  }

  const activeFieldKeys = useMemo(() => {
    const cats = categoryFilter === 'all'
      ? [...new Set(filtered.map(r => r.category))]
      : [categoryFilter]
    const seen = new Map()
    cats.forEach(cat => {
      (fieldsByCategory[cat] || []).forEach(f => { if (!seen.has(f.key)) seen.set(f.key, f.label) })
    })
    return [...seen.entries()].map(([key, label]) => ({ key, label }))
  }, [filtered, categoryFilter])

  // Field yang relevan untuk form tambah berdasarkan kategori yang dipilih
  const addFormFields = fieldsByCategory[addForm.category] || []

  return (
    <Layout title="Pricing Dataset">
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:4 }}>Pricing Dataset</h2>
            <p style={{ fontSize:13, color:'#9ca3af' }}>
              Klik nilai harga untuk mengubahnya langsung. Perubahan tersimpan otomatis ke database.
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => setShowSplitPanel(v => !v)}
              style={{ ...s.btn, background: showSplitPanel ? C.brown : '#fff', color: showSplitPanel ? '#fff' : C.brown, border:`1px solid ${C.border}` }}
            >
              {showSplitPanel ? '✕ Tutup Rumus Split' : '⚙️ Rumus Split Finishing WO'}
            </button>
            <button
              onClick={() => { setShowAddForm(v => !v); setAddForm(emptyForm(categoryFilter)) }}
              style={{ ...s.btn, background: showAddForm ? '#f3f4f6' : C.orange, color: showAddForm ? C.dark : '#fff' }}
            >
              {showAddForm ? '✕ Batal' : '+ Tambah Material'}
            </button>
          </div>
        </div>

        {/* Panel Rumus Split Finishing WO */}
        {showSplitPanel && (
          <div style={{ ...s.card, marginBottom:16, borderColor: C.brown }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.dark, marginBottom:4 }}>Rumus Split Finishing WO</div>
            <p style={{ fontSize:12, color:'#9ca3af', marginBottom:14 }}>
              % dari Harga/pcs tiap proses yang otomatis dipecah jadi Upah Pekerja / Bahan Baku / Charge Mesin
              di halaman Kalkulator (estimator), masing-masing dengan Segment Keuangan sendiri untuk laporan
              proyeksi vs real. Idealnya total % tiap baris = 100%.
            </p>
            {finishingProsesList.length === 0 ? (
              <div style={{ fontSize:13, color:'#9ca3af' }}>Belum ada data proses Finishing WO di raw_materials.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', whiteSpace:'nowrap' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Proses</th>
                    <th style={{ ...s.th, textAlign:'right' }}>% Upah</th>
                    <th style={s.th}>Segment Upah</th>
                    <th style={{ ...s.th, textAlign:'right' }}>% Bahan Baku</th>
                    <th style={s.th}>Segment Bahan Baku</th>
                    <th style={{ ...s.th, textAlign:'right' }}>% Mesin</th>
                    <th style={s.th}>Segment Mesin</th>
                    <th style={{ ...s.th, textAlign:'right' }}>Total %</th>
                  </tr>
                </thead>
                <tbody>
                  {finishingProsesList.map(proses => {
                    const rule = splitRules[proses] || { pct_upah:0, pct_bahan:0, pct_mesin:0, segment_upah:'', segment_bahan:'', segment_mesin:'' }
                    const total = (Number(rule.pct_upah)||0) + (Number(rule.pct_bahan)||0) + (Number(rule.pct_mesin)||0)
                    return (
                      <tr key={proses}>
                        <td style={s.td}>{proses}</td>
                        {[['pct_upah','segment_upah'], ['pct_bahan','segment_bahan'], ['pct_mesin','segment_mesin']].map(([pf, sf]) => (
                          <Fragment key={pf}>
                            <td style={{ ...s.td, textAlign:'right' }}>
                              <input type="number" min="0" max="100"
                                style={{ ...s.input, width:60, textAlign:'right' }}
                                value={rule[pf] ?? 0}
                                onChange={e => handleSplitUpdate(proses, { ...rule, [pf]: parseFloat(e.target.value) || 0 })}
                              />
                            </td>
                            <td style={s.td}>
                              <select style={{ ...s.select, width:170 }}
                                value={rule[sf] || ''}
                                onChange={e => handleSplitUpdate(proses, { ...rule, [sf]: e.target.value })}
                              >
                                <option value="">– pilih segment –</option>
                                {SEGMENT_KEUANGAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </td>
                          </Fragment>
                        ))}
                        <td style={{ ...s.td, textAlign:'right', fontWeight:600, color: total === 100 ? '#16a34a' : total === 0 ? '#9ca3af' : '#dc2626' }}>
                          {total}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Form Tambah */}
        {showAddForm && (
          <div style={{ ...s.card, marginBottom:16, borderColor: C.orange }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.dark, marginBottom:14 }}>Tambah Material Baru</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Kategori *</div>
                <select style={{ ...s.select, width:'100%' }} value={addForm.category}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                  {Object.entries(categoryLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Nama *</div>
                <input style={{ ...s.input, width:'100%', boxSizing:'border-box' }}
                  placeholder="cth. ivory chenming"
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Segment Keuangan</div>
                <select style={{ ...s.select, width:'100%' }} value={addForm.segment_keuangan}
                  onChange={e => setAddForm(f => ({ ...f, segment_keuangan: e.target.value }))}>
                  <option value="">– pilih segment –</option>
                  {SEGMENT_KEUANGAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Spec</div>
                <input style={{ ...s.input, width:'100%', boxSizing:'border-box' }}
                  placeholder="cth. 79x109"
                  value={addForm.spec}
                  onChange={e => setAddForm(f => ({ ...f, spec: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>GSM (Gramasi)</div>
                <input style={{ ...s.input, width:'100%', boxSizing:'border-box' }}
                  type="number" placeholder="cth. 260"
                  value={addForm.gsm}
                  onChange={e => setAddForm(f => ({ ...f, gsm: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Unit</div>
                <input style={{ ...s.input, width:'100%', boxSizing:'border-box' }}
                  placeholder="cth. lembar"
                  value={addForm.unit}
                  onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
              {addFormFields.map(f => (
                <div key={f.key}>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{f.label}</div>
                  <input style={{ ...s.input, width:'100%', boxSizing:'border-box' }}
                    type="number" placeholder="0"
                    value={addForm[f.key]}
                    onChange={e => setAddForm(form => ({ ...form, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, display:'flex', gap:8 }}>
              <button onClick={handleAdd} disabled={adding}
                style={{ ...s.btn, background: C.orange, color:'#fff', opacity: adding ? 0.7 : 1 }}>
                {adding ? 'Menyimpan...' : '💾 Simpan Material'}
              </button>
              <button onClick={() => setShowAddForm(false)}
                style={{ ...s.btn, background:'#f3f4f6', color:C.dark }}>
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          <input style={{ ...s.input, flex:1 }}
            placeholder="Cari nama atau spesifikasi material..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select style={s.select} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">Semua Kategori</option>
            {Object.entries(categoryLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {toast && (
          <div style={{
            padding:'8px 14px', borderRadius:8, marginBottom:12, fontSize:13, fontWeight:500,
            background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: toast.type === 'error' ? '#dc2626' : '#16a34a',
            border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#86efac'}`,
          }}>{toast.msg}</div>
        )}

        {/* Confirm Delete Dialog */}
        {confirmDelete && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:380, width:'90%', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize:15, fontWeight:600, color:C.dark, marginBottom:8 }}>Hapus Material?</div>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>
                Material "<strong>{confirmDelete.name}</strong>" akan dihapus dari daftar harga. Aksi ini tidak bisa dibatalkan.
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ ...s.btn, background:'#f3f4f6', color:C.dark }}>Batal</button>
                <button onClick={() => handleDelete(confirmDelete.id)}
                  style={{ ...s.btn, background:'#dc2626', color:'#fff' }}>Hapus</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ ...s.card, padding:0, overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Memuat data...</div>
          ) : error ? (
            <div style={{ padding:40, textAlign:'center', color:'#dc2626' }}>Gagal memuat: {error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Tidak ada material yang cocok.</div>
          ) : (
            <div style={{ maxHeight:600, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>Kategori</th>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>Nama</th>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>Segment Keuangan</th>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>Spec</th>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>GSM</th>
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>Unit</th>
                    {activeFieldKeys.map(f => (
                      <th key={f.key} style={{ ...s.th, textAlign:'right', position:'sticky', top:0, background:'#fff', zIndex:1 }}>{f.label}</th>
                    ))}
                    <th style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1, textAlign:'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const rowFields = fieldsByCategory[row.category] || []
                    const rowFieldKeys = new Set(rowFields.map(f => f.key))
                    return (
                      <tr key={row.id} style={{ transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.cream}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={s.td}>
                          <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:C.cream, color:C.brown }}>
                            {categoryLabel[row.category] || row.category}
                          </span>
                        </td>
                        <td style={s.td}>{row.name}</td>
                        <td style={{ ...s.td, minWidth:190 }}>
                          {row.category === 'finishing_wo' ? (
                            <span style={{ fontSize:11.5, color:'#9ca3af', fontStyle:'italic' }} title="Segment untuk Finishing WO diatur per komponen (Upah/Bahan Baku/Mesin) di panel Rumus Split Finishing WO">
                              diatur di Rumus Split ↑
                            </span>
                          ) : (
                            <EditableSegmentCell value={row.segment_keuangan} onSave={(val) => handleUpdate(row.id, 'segment_keuangan', val)} />
                          )}
                        </td>
                        <td style={{ ...s.td, color:'#9ca3af' }}>{row.spec || '–'}</td>
                        <td style={{ ...s.td, color:'#9ca3af' }}>
                          {row.category === 'material' ? (row.notes || '–') : '–'}
                        </td>
                        <td style={{ ...s.td, color:'#9ca3af' }}>{row.unit || '–'}</td>
                        {activeFieldKeys.map(f => (
                          <td key={f.key} style={{ ...s.td, textAlign:'right' }}>
                            {rowFieldKeys.has(f.key) ? (
                              <EditableCell value={row[f.key]} onSave={(val) => handleUpdate(row.id, f.key, val)} />
                            ) : (
                              <span style={{ color:'#d1d5db' }}>–</span>
                            )}
                          </td>
                        ))}
                        <td style={{ ...s.td, textAlign:'center' }}>
                          <button
                            onClick={() => setConfirmDelete({ id: row.id, name: row.name })}
                            style={{ background:'none', border:'1px solid #fecaca', borderRadius:6, padding:'3px 10px', fontSize:12, color:'#dc2626', cursor:'pointer' }}
                            title="Hapus material ini"
                          >Hapus</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize:12, color:'#9ca3af', marginTop:12 }}>
          Menampilkan {filtered.length} dari {rows.length} material aktif.
        </p>
      </div>
    </Layout>
  )
}
