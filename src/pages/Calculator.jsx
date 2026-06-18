import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

// ── helpers ──────────────────────────────────────────────────
const fmt   = n => (n || 0).toLocaleString('id-ID')
const num   = v => parseFloat(v) || 0
const idr   = n => 'Rp ' + fmt(Math.round(n))

// Plano standard sizes (cm)
const STANDARD_PLANO = ['65x100','61x86','54x86','46x64','50x70','48x68','79x109','custom']

// Hitung kebutuhan plano dari luas permukaan produk
function calcPlanoGet(planoW, planoH, productW, productH) {
  if (!planoW || !planoH || !productW || !productH) return 0
  const cols = Math.floor(planoW / productW)
  const rows = Math.floor(planoH / productH)
  return cols * rows || 1
}

// ── default row factories ─────────────────────────────────────
const newMaterial     = () => ({ id: Date.now(), nama:'', material:'', plano:'65x100', plano_custom_w:'', plano_custom_h:'', gramasi:0, luas_permukaan:0, plano_get:0, quantity:0, insheet:0 })
const newCetak        = () => ({ id: Date.now(), nama:'', proses:'', warna:'4 warna', quantity:0, luas_permukaan:0, insheet:0 })
const newEmboss       = () => ({ id: Date.now(), nama:'', proses:'', quantity:0, luas_permukaan:0, insheet:0 })
const newMatProses    = () => ({ id: Date.now(), nama:'', proses:'', harga_proses:0, quantity:0 })
const newFinishing    = () => ({ id: Date.now(), nama:'', proses:'', spesifik:'' })
const newAdditional   = () => ({ id: Date.now(), nama:'', proses:'', harga:0 })

const s = {
  card:    { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:20 },
  sTitle:  { fontSize:15, fontWeight:600, color:'#1a1a1a', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' },
  input:   { padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  select:  { padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, outline:'none', background:'#fff', width:'100%', boxSizing:'border-box' },
  th:      { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:500, textAlign:'left', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap' },
  td:      { padding:'6px 6px', verticalAlign:'middle' },
  calc:    { padding:'7px 10px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13, color:'#374151', minWidth:60, textAlign:'right' },
  addBtn:  { padding:'6px 14px', background:'#f0f9ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:500 },
  delBtn:  { padding:'4px 8px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, fontSize:11, cursor:'pointer' },
  saveBtn: { padding:'12px 28px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer' },
  total:   { textAlign:'right', fontSize:13, color:'#374151', padding:'6px 0' },
}

function PlanoCell({ row, onChange }) {
  const isCustom = row.plano === 'custom'
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <select style={{ ...s.select, width:120 }} value={row.plano}
        onChange={e => onChange('plano', e.target.value)}>
        {STANDARD_PLANO.map(p => <option key={p}>{p}</option>)}
      </select>
      {isCustom && (
        <>
          <input style={{ ...s.input, width:60 }} placeholder="W(cm)" type="number"
            value={row.plano_custom_w} onChange={e => onChange('plano_custom_w', e.target.value)} />
          <span style={{ fontSize:11, color:'#9ca3af' }}>×</span>
          <input style={{ ...s.input, width:60 }} placeholder="H(cm)" type="number"
            value={row.plano_custom_h} onChange={e => onChange('plano_custom_h', e.target.value)} />
        </>
      )}
    </div>
  )
}

function SectionTable({ title, rows, columns, onAdd, onDel, onChange, subtotal }) {
  return (
    <div style={s.card}>
      <div style={s.sTitle}>
        <span>{title}</span>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {subtotal > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(subtotal)}</span>}
          <button style={s.addBtn} onClick={onAdd}>+ Tambah Baris</button>
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
          <thead>
            <tr>{columns.map(c => <th key={c.key} style={{ ...s.th, width:c.w }}>{c.label}</th>)}
              <th style={s.th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length+1} style={{ padding:'20px', textAlign:'center', color:'#d1d5db', fontSize:13 }}>
                Klik "+ Tambah Baris"
              </td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id}>
                {columns.map(col => (
                  <td key={col.key} style={s.td}>
                    {col.computed ? (
                      <div style={s.calc}>{col.format ? col.format(row[col.key]) : row[col.key]}</div>
                    ) : col.type === 'plano' ? (
                      <PlanoCell row={row} onChange={(k, v) => onChange(i, k, v)} />
                    ) : col.type === 'select' ? (
                      <select style={s.select} value={row[col.key]}
                        onChange={e => onChange(i, col.key, e.target.value)}>
                        {col.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input style={s.input} type={col.type || 'text'}
                        value={row[col.key]} placeholder={col.placeholder || ''}
                        onChange={e => onChange(i, col.key, col.type === 'number' ? e.target.value : e.target.value)} />
                    )}
                  </td>
                ))}
                <td style={s.td}>
                  <button style={s.delBtn} onClick={() => onDel(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────
export default function Calculator() {
  const { requestId } = useParams()
  const { profile }   = useAuth()
  const navigate      = useNavigate()

  const [request,  setRequest]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [margin,   setMargin]   = useState(15)

  const [material,   setMaterial]   = useState([])
  const [cetak,      setCetak]      = useState([])
  const [emboss,     setEmboss]     = useState([])
  const [matProses,  setMatProses]  = useState([])
  const [finishing,  setFinishing]  = useState([])
  const [additional, setAdditional] = useState([])

  useEffect(() => { if (requestId) loadRequest() }, [requestId])

  async function loadRequest() {
    setLoading(true)
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single()
    setRequest(req)
    // Check existing quotation
    const { data: quot } = await supabase.from('quotations').select('*').eq('request_id', requestId).eq('is_active', true).single()
    if (quot) {
      setMaterial(quot.material_cost || [])
      setCetak(quot.cetak_cost || [])
      setEmboss(quot.emboss_laminasi || [])
      setMatProses(quot.material_proses || [])
      setFinishing(quot.finishing_wo || [])
      setAdditional(quot.additional_cost || [])
      setMargin(quot.margin_percent || 15)
    }
    setLoading(false)
  }

  // ── live calculations ─────────────────────────────────────
  const calcMaterialRows = useCallback(() =>
    material.map(r => {
      const [pw, ph] = r.plano === 'custom'
        ? [num(r.plano_custom_w), num(r.plano_custom_h)]
        : r.plano.split('x').map(Number)
      const luas    = (pw * ph) / 10000  // cm² → m²
      const planoGet = calcPlanoGet(pw, ph, Math.sqrt(num(r.luas_permukaan)*10000), Math.sqrt(num(r.luas_permukaan)*10000))
      const insheet  = planoGet > 0 ? Math.ceil(num(r.quantity) / planoGet) : 0
      return { ...r, luas_plano: luas, plano_get: planoGet, insheet }
    }), [material])

  const calcSubtotals = useCallback(() => {
    // Subtotals hanya bisa dihitung jika ada harga per row
    // Untuk sekarang tampilkan jumlah row sebagai indikator
    // Harga final dihitung saat save berdasarkan raw_materials lookup
    return {
      material:   material.reduce((s, r) => s + num(r.insheet) * 1000, 0), // placeholder
      cetak:      cetak.reduce((s, r) => s + num(r.insheet) * 500, 0),
      emboss:     emboss.reduce((s, r) => s + num(r.insheet) * 300, 0),
      matProses:  matProses.reduce((s, r) => s + num(r.harga_proses) * num(r.quantity), 0),
      finishing:  finishing.length * num(request?.quantity || 0) * 80,
      additional: additional.reduce((s, r) => s + num(r.harga), 0),
    }
  }, [material, cetak, emboss, matProses, finishing, additional, request])

  const sub = calcSubtotals()
  const total = Object.values(sub).reduce((a, b) => a + b, 0)
  const selling = total * (1 + num(margin) / 100)
  const perUnit  = request?.quantity ? selling / request.quantity : 0

  // ── row updater factory ───────────────────────────────────
  const updater = (setter) => (i, key, val) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))

  async function handleSave(dealStatus = 'quoted') {
    setSaving(true)
    const materialCalced = calcMaterialRows()

    const payload = {
      request_id: requestId,
      estimator_id: profile.id,
      customer_name: request.customer_name,
      product_type: request.product_type,
      quantity: request.quantity,
      material_cost:   materialCalced,
      cetak_cost:      cetak,
      emboss_laminasi: emboss,
      material_proses: matProses,
      finishing_wo:    finishing,
      additional_cost: additional,
      subtotal_material:   sub.material,
      subtotal_cetak:      sub.cetak,
      subtotal_emboss:     sub.emboss,
      subtotal_matproses:  sub.matProses,
      subtotal_finishing:  sub.finishing,
      subtotal_additional: sub.additional,
      total_cost:          total,
      margin_percent:      num(margin),
      selling_price:       Math.round(selling),
      price_per_unit:      perUnit,
      deal_status:         dealStatus,
    }

    // Deactivate old quotation if exists
    await supabase.from('quotations').update({ is_active: false }).eq('request_id', requestId)
    const { error } = await supabase.from('quotations').insert(payload)

    if (!error) {
      await supabase.from('requests').update({
        status: 'done',
        completed_at: new Date().toISOString()
      }).eq('id', requestId)
      navigate('/')
    }
    setSaving(false)
  }

  if (loading) return <Layout title="Kalkulator"><div style={{ padding:40, color:'#9ca3af', textAlign:'center' }}>Memuat...</div></Layout>
  if (!request) return <Layout title="Kalkulator"><div style={{ padding:40, color:'#dc2626' }}>Request tidak ditemukan.</div></Layout>

  const materialCalced = calcMaterialRows()

  return (
    <Layout title={`Kalkulator — ${request.request_number}`}>
      {/* Request info header */}
      <div style={{ ...s.card, borderLeft:'4px solid #2563eb', padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
          {[
            ['Customer', request.customer_name],
            ['Produk', request.product_type],
            ['Quantity', fmt(request.quantity)],
            ['Ukuran', request.product_size || '—'],
            ['Material', request.material_spec || '—'],
            ['Print', request.print_spec || '—'],
            ['Finishing', request.finishing_spec || '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, display:'flex', gap:16, flexWrap:'wrap' }}>
          {request.notes && (
            <div style={{ flex:1, minWidth:200, padding:'8px 12px', background:'#fffbeb', borderRadius:6, fontSize:13, color:'#92400e' }}>
              💬 {request.notes}
            </div>
          )}
          {request.reference_image && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>🖼️ Gambar Referensi</div>
              <img
                src={request.reference_image}
                alt="referensi"
                style={{ maxHeight:140, maxWidth:220, borderRadius:8, border:'1px solid #e5e7eb', cursor:'pointer', objectFit:'cover' }}
                onClick={() => window.open(request.reference_image, '_blank')}
                title="Klik untuk lihat ukuran penuh"
              />
              <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>klik untuk perbesar</div>
            </div>
          )}
        </div>
      </div>

      {/* 1. Material Cost */}
      <SectionTable
        title="1. Material Cost"
        rows={materialCalced}
        onAdd={() => setMaterial(p => [...p, newMaterial()])}
        onDel={i => setMaterial(p => p.filter((_, idx) => idx !== i))}
        onChange={updater(setMaterial)}
        subtotal={sub.material}
        columns={[
          { key:'nama', label:'Nama', w:100 },
          { key:'material', label:'Material', w:130, placeholder:'Art Carton 260gsm' },
          { key:'plano', label:'Plano', w:180, type:'plano' },
          { key:'gramasi', label:'Gramasi', w:80, type:'number' },
          { key:'luas_permukaan', label:'Luas (m²)', w:90, type:'number', placeholder:'0.065' },
          { key:'plano_get', label:'Plano Get', w:80, computed:true },
          { key:'quantity', label:'Qty', w:80, type:'number' },
          { key:'insheet', label:'Insheet', w:80, computed:true },
        ]}
      />

      {/* 2. Cetak Cost */}
      <SectionTable
        title="2. Cetak Cost"
        rows={cetak}
        onAdd={() => setCetak(p => [...p, newCetak()])}
        onDel={i => setCetak(p => p.filter((_, idx) => idx !== i))}
        onChange={updater(setCetak)}
        subtotal={sub.cetak}
        columns={[
          { key:'nama', label:'Nama', w:100 },
          { key:'proses', label:'Mesin', w:100, placeholder:'SM 74' },
          { key:'warna', label:'Warna', w:120, type:'select', options:['1 warna','2 warna','4 warna','5 warna'] },
          { key:'quantity', label:'Qty', w:80, type:'number' },
          { key:'luas_permukaan', label:'Luas (m²)', w:90, type:'number' },
          { key:'insheet', label:'Insheet', w:80, type:'number' },
        ]}
      />

      {/* 3. Emboss / Laminasi */}
      <SectionTable
        title="3. Emboss / Laminasi"
        rows={emboss}
        onAdd={() => setEmboss(p => [...p, newEmboss()])}
        onDel={i => setEmboss(p => p.filter((_, idx) => idx !== i))}
        onChange={updater(setEmboss)}
        subtotal={sub.emboss}
        columns={[
          { key:'nama', label:'Nama', w:100 },
          { key:'proses', label:'Proses', w:150, type:'select', options:['Laminasi Doff','Laminasi Gloss','Spot UV','Emboss','Hot Stamping'] },
          { key:'quantity', label:'Qty', w:80, type:'number' },
          { key:'luas_permukaan', label:'Luas (m²)', w:90, type:'number' },
          { key:'insheet', label:'Insheet', w:80, type:'number' },
        ]}
      />

      {/* 4. Material Proses */}
      <SectionTable
        title="4. Material Proses"
        rows={matProses}
        onAdd={() => setMatProses(p => [...p, newMatProses()])}
        onDel={i => setMatProses(p => p.filter((_, idx) => idx !== i))}
        onChange={updater(setMatProses)}
        subtotal={sub.matProses}
        columns={[
          { key:'nama', label:'Nama', w:100 },
          { key:'proses', label:'Proses', w:150, placeholder:'Pisau Pond' },
          { key:'harga_proses', label:'Harga', w:100, type:'number' },
          { key:'quantity', label:'Qty', w:80, type:'number' },
        ]}
      />

      {/* 5. Finishing WO */}
      <SectionTable
        title="5. Finishing WO"
        rows={finishing}
        onAdd={() => setFinishing(p => [...p, newFinishing()])}
        onDel={i => setFinishing(p => p.filter((_, idx) => idx !== i))}
        onChange={updater(setFinishing)}
        subtotal={sub.finishing}
        columns={[
          { key:'nama', label:'Nama', w:120 },
          { key:'proses', label:'Proses', w:150, placeholder:'Pond, Lem, QC' },
          { key:'spesifik', label:'Spesifik', w:150, placeholder:'manual / mesin' },
        ]}
      />

      {/* 6. Additional Cost */}
      <SectionTable
        title="6. Additional Cost"
        rows={additional}
        onAdd={() => setAdditional(p => [...p, newAdditional()])}
        onDel={i => setAdditional(p => p.filter((_, idx) => idx !== i))}
        onChange={updater(setAdditional)}
        subtotal={sub.additional}
        columns={[
          { key:'nama', label:'Nama', w:120 },
          { key:'proses', label:'Keterangan', w:200 },
          { key:'harga', label:'Harga', w:120, type:'number' },
        ]}
      />

      {/* Summary */}
      <div style={{ ...s.card, borderTop:'3px solid #16a34a' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Ringkasan Biaya</div>
            {[
              ['Material Cost', sub.material],
              ['Cetak Cost', sub.cetak],
              ['Emboss / Laminasi', sub.emboss],
              ['Material Proses', sub.matProses],
              ['Finishing WO', sub.finishing],
              ['Additional Cost', sub.additional],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f9fafb', fontSize:13, color:'#374151' }}>
                <span>{label}</span><span style={{ fontFamily:'monospace' }}>{idr(val)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:14, fontWeight:600, color:'#1a1a1a', borderTop:'2px solid #e5e7eb', marginTop:4 }}>
              <span>Total Modal</span><span>{idr(total)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Harga Jual</div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, color:'#374151', display:'block', marginBottom:6 }}>Margin (%)</label>
              <input type="number" min="0" max="100" value={margin}
                onChange={e => setMargin(e.target.value)}
                style={{ ...s.input, width:100, fontSize:15, fontWeight:600 }} />
            </div>
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:16 }}>
              <div style={{ fontSize:12, color:'#16a34a', marginBottom:4 }}>Harga Jual Total</div>
              <div style={{ fontSize:24, fontWeight:700, color:'#15803d' }}>{idr(selling)}</div>
              <div style={{ fontSize:13, color:'#16a34a', marginTop:6 }}>
                Per unit: {idr(perUnit)} &nbsp;|&nbsp; Qty: {fmt(request.quantity)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:24, display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button onClick={() => navigate('/')} style={{ padding:'10px 20px', background:'#fff', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, cursor:'pointer', color:'#374151' }}>
            Kembali
          </button>
          <button onClick={() => handleSave('quoted')} disabled={saving} style={s.saveBtn}>
            {saving ? 'Menyimpan...' : '💾 Simpan & Selesai'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
