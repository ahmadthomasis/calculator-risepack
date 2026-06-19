import { useState, useEffect, useMemo, useCallback } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:   { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', border:`1px solid ${C.border}` },
  input:  { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', color:C.dark },
  select: { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', background:'#fff', color:C.dark },
  th:     { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:600, textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:     { padding:'8px 10px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}`, verticalAlign:'middle' },
}

const fmt = n => (n || 0).toLocaleString('id-ID')

const categoryLabel = {
  material: 'Material',
  cetak: 'Cetak',
  emboss_laminasi: 'Emboss/Laminasi',
  material_proses: 'Material Proses',
  additional: 'Additional',
}

// Field harga mana saja yang relevan per kategori — supaya tidak tampilkan kolom kosong yang membingungkan
const fieldsByCategory = {
  material:         [{ key:'price', label:'Harga / Lembar' }],
  cetak:            [{ key:'price', label:'Harga / Lembar' }, { key:'harga_mesin', label:'Harga Mesin' }, { key:'qty_threshold', label:'Qty Threshold' }],
  emboss_laminasi:  [{ key:'price', label:'Harga / cm²' }, { key:'minimum_charge', label:'Min. Charge' }],
  material_proses:  [{ key:'price', label:'Harga' }, { key:'rate_per_cm', label:'Rate / cm' }],
  additional:       [{ key:'price', label:'Harga' }, { key:'rate_per_kg', label:'Rate / kg' }, { key:'rate_a', label:'Rate A' }, { key:'rate_b', label:'Rate B' }, { key:'minimum_charge', label:'Min. Charge' }],
}

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
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        disabled={saving}
        style={{ ...s.input, width:110, textAlign:'right' }}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        background:'none', border:'1px dashed transparent', borderRadius:6,
        padding:'4px 8px', cursor:'pointer', fontSize:13, color:C.dark,
        fontWeight:500, textAlign:'right', minWidth:90,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.border}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      title="Klik untuk ubah"
    >
      {fmt(value)}
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

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) setError(error.message)
    else { setRows(data || []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

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
    if (error) {
      setToast({ type:'error', msg: 'Gagal menyimpan: ' + error.message })
    } else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
      setToast({ type:'success', msg: 'Harga disimpan' })
    }
    setTimeout(() => setToast(null), 2500)
  }

  // Kumpulkan semua kolom field unik yang relevan untuk hasil filter saat ini,
  // supaya header tabel tidak menampilkan kolom yang tidak dipakai kategori manapun yang sedang tampil
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

  return (
    <Layout title="Pricing Dataset">
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:4 }}>Pricing Dataset</h2>
        <p style={{ fontSize:13, color:'#9ca3af', marginBottom:20 }}>
          Klik nilai harga untuk mengubahnya langsung. Perubahan tersimpan otomatis ke database.
        </p>

        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          <input
            style={{ ...s.input, flex:1 }}
            placeholder="Cari nama atau spesifikasi material..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
          }}>
            {toast.msg}
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
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Kategori</th>
                    <th style={s.th}>Nama</th>
                    <th style={s.th}>Spec</th>
                    <th style={s.th}>Unit</th>
                    {activeFieldKeys.map(f => (
                      <th key={f.key} style={{ ...s.th, textAlign:'right' }}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const rowFields = fieldsByCategory[row.category] || []
                    const rowFieldKeys = new Set(rowFields.map(f => f.key))
                    return (
                      <tr key={row.id}>
                        <td style={s.td}>
                          <span style={{
                            padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600,
                            background: C.cream, color: C.brown,
                          }}>{categoryLabel[row.category] || row.category}</span>
                        </td>
                        <td style={s.td}>{row.name}</td>
                        <td style={{ ...s.td, color:'#9ca3af' }}>{row.spec || '–'}</td>
                        <td style={{ ...s.td, color:'#9ca3af' }}>{row.unit || '–'}</td>
                        {activeFieldKeys.map(f => (
                          <td key={f.key} style={{ ...s.td, textAlign:'right' }}>
                            {rowFieldKeys.has(f.key) ? (
                              <EditableCell
                                value={row[f.key]}
                                onSave={(val) => handleUpdate(row.id, f.key, val)}
                              />
                            ) : (
                              <span style={{ color:'#d1d5db' }}>–</span>
                            )}
                          </td>
                        ))}
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
