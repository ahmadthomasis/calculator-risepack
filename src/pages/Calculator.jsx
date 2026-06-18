import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const fmt  = n => (n || 0).toLocaleString('id-ID')
const num  = v => parseFloat(v) || 0
const idr  = n => 'Rp ' + fmt(Math.round(n))

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const PLANO_OPTIONS = ['79x109','65x100','90x120','90x100','77x66','75x100','70x100','custom']
const WARNA_OPTIONS = ['1 warna','2 warna','4 warna','4 warna + 1 spesial','5 warna']

const s = {
  card:   { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  sTitle: { fontSize:15, fontWeight:600, color:C.dark, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' },
  input:  { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', color:C.dark },
  select: { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', background:'#fff', width:'100%', boxSizing:'border-box', color:C.dark },
  th:     { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:500, textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:     { padding:'5px 5px', verticalAlign:'middle' },
  calc:   { padding:'7px 10px', background:C.cream, border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, color:C.dark, textAlign:'right', minWidth:80 },
  calcGreen: { padding:'7px 10px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:6, fontSize:13, color:'#16a34a', fontWeight:600, textAlign:'right', minWidth:90 },
  addBtn: { padding:'6px 14px', background:'#fff7ed', color:C.orange, border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:500 },
  delBtn: { padding:'4px 8px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, fontSize:11, cursor:'pointer' },
  saveBtn:{ padding:'12px 28px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer' },
}

// ── Row factories ─────────────────────────────────────────────
const newMaterial  = () => ({ id:Date.now(), nama:'', material:'', gsm:'', plano:'79x109', plano_w:'', plano_h:'', luas_permukaan:'', plano_get:'', insheet:'', quantity:0, harga_lembar:0, harga_per_pcs:0 })
const newCetak     = () => ({ id:Date.now(), nama:'', mesin:'SM 74', warna:'4 warna', quantity:0, luas_permukaan:0, insheet:0, harga_per_lembar:0 })
const newEmboss    = () => ({ id:Date.now(), nama:'', proses:'Laminasi Doff', quantity:0, luas_permukaan:0, insheet:0, harga_per_cm2:0 })
const newMatProses = () => ({ id:Date.now(), nama:'', proses:'', harga_satuan:0, quantity:1 })
const newFinishing = () => ({ id:Date.now(), nama:'', proses:'', spesifik:'', harga_satuan:0 })
const newAdditional= () => ({ id:Date.now(), nama:'', keterangan:'', harga:0 })

export default function Calculator() {
  const { requestId } = useParams()
  const { profile }   = useAuth()
  const navigate      = useNavigate()

  const [request,  setRequest]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [margin,   setMargin]   = useState(15)
  const [dbMaterials, setDbMaterials] = useState([])
  const [dbMesin,     setDbMesin]     = useState([])
  const [dbEmboss,    setDbEmboss]    = useState([])
  const [dbMatProses, setDbMatProses] = useState([])
  const [dbFinishing, setDbFinishing] = useState([])

  const [material,   setMaterial]   = useState([])
  const [cetak,      setCetak]      = useState([])
  const [emboss,     setEmboss]     = useState([])
  const [matProses,  setMatProses]  = useState([])
  const [finishing,  setFinishing]  = useState([])
  const [additional, setAdditional] = useState([])

  useEffect(() => { loadAll() }, [requestId])

  async function loadAll() {
    setLoading(true)
    const [
      { data: req },
      { data: mats },
      { data: mesin },
      { data: emb },
      { data: mp },
      { data: fin },
    ] = await Promise.all([
      supabase.from('requests').select('*').eq('id', requestId).single(),
      supabase.from('raw_materials').select('*').eq('category','material').order('name'),
      supabase.from('raw_materials').select('*').eq('category','cetak').order('name'),
      supabase.from('raw_materials').select('*').eq('category','emboss_laminasi').order('name'),
      supabase.from('raw_materials').select('*').eq('category','material_proses').order('name'),
      supabase.from('raw_materials').select('*').eq('category','finishing_wo').order('name'),
    ])
    // Load existing quotation if any
    const { data: quot } = await supabase.from('quotations').select('*')
      .eq('request_id', requestId).eq('is_active', true).single()

    const normGsm = (rows) => (rows || []).map(r => ({
      ...r,
      gsm: String(r.gsm || '').toLowerCase().replace('gsm','').trim()
    }))

    // Set semua state sekaligus agar tidak ada race condition
    setRequest(req)
    setDbMaterials(mats || [])
    setDbMesin(mesin || [])
    setDbEmboss(emb || [])
    setDbMatProses(mp || [])
    setDbFinishing(fin || [])
    if (quot) {
      setMaterial(normGsm(quot.material_cost))
      setCetak(quot.cetak_cost || [])
      setEmboss(quot.emboss_laminasi || [])
      setMatProses(quot.material_proses || [])
      setFinishing(quot.finishing_wo || [])
      setAdditional(quot.additional_cost || [])
      setMargin(quot.margin_percent || 15)
    }
    setLoading(false)
  }

  // ── Lookup harga material dari DB ─────────────────────────
  function lookupMaterialPrice(materialName, plano, gsm) {
    if (!materialName || !plano || !gsm) return 0
    const normalizeGsmLocal = (notes) => (notes || '').toLowerCase().replace('gsm','').trim()
    const normGsm = String(gsm).trim()
    const normName = materialName.toLowerCase().trim()
    const normPlano = String(plano).trim()
    console.log('[lookup]', { normName, normPlano, normGsm, dbCount: dbMaterials.length })
    const match = dbMaterials.find(m => {
      const mName = m.name.toLowerCase().trim()
      const mSpec = (m.spec || '').trim()
      const mGsm  = normalizeGsmLocal(m.notes)
      const ok = mName === normName && mSpec === normPlano && mGsm === normGsm
      if (mName === normName) console.log('[candidate]', { mName, mSpec, mGsm, ok })
      return ok
    })
    return match ? match.price : 0
  }

  function lookupMesinPrice(mesinName) {
    const match = dbMesin.find(m => m.name === mesinName)
    return match ? match.price : 0
  }

  function lookupEmbossPrice(prosesName) {
    const match = dbEmboss.find(m => m.name === prosesName)
    return match ? match.price : 0
  }

  // ── Get unique values from DB ─────────────────────────────
  const materialNames  = [...new Set(dbMaterials.map(m => m.name))].sort()
  const normalizeGsm   = (notes) => (notes || '').toLowerCase().replace('gsm','').trim()
  const gsmOptions     = (matName) => [...new Set(dbMaterials.filter(m => m.name === matName).map(m => normalizeGsm(m.notes)))].filter(Boolean).sort((a,b)=>+a-+b)
  const planoOptions   = (matName, gsm) => [...new Set(dbMaterials.filter(m => m.name === matName && normalizeGsm(m.notes) === String(gsm).trim()).map(m => m.spec))].sort()
  const mesinNames     = [...new Set(dbMesin.map(m => m.name))].sort()
  const embossNames    = [...new Set(dbEmboss.map(m => m.name))].sort()
  const matProsesNames = [...new Set(dbMatProses.map(m => m.name))].sort()
  const finishingProses= [...new Set(dbFinishing.map(m => m.name))].sort()
  const finishingSpecs = (prosesName) => dbFinishing.filter(m => m.name === prosesName).map(m => m.spec).sort()

  // ── Row updater ───────────────────────────────────────────
  const updater = (setter) => (i, key, val) =>
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))

  // ── Kalkulasi per row ─────────────────────────────────────
  const calcMaterial = useCallback(() => material.map(r => {
    const planoGet     = num(r.plano_get)
    const insheet      = num(r.insheet)
    const quantity     = num(r.quantity)
    const harga        = lookupMaterialPrice(r.material, r.plano, r.gsm)
    // Rumus: =((qty + insheet) / plano_get * harga_lembar) / qty
    const harga_per_pcs = (planoGet > 0 && quantity > 0 && insheet > 0)
      ? ((quantity + insheet) / planoGet * harga) / quantity
      : 0
    const subtotal = harga_per_pcs * quantity
    return { ...r, harga_lembar: harga, harga_per_pcs, subtotal }
  }), [material, dbMaterials])

  const calcCetak = useCallback(() => cetak.map(r => {
    const harga    = num(r.harga_per_lembar) > 0 ? num(r.harga_per_lembar) : lookupMesinPrice(r.mesin)
    const subtotal = num(r.insheet) * harga
    return { ...r, harga_per_lembar: harga, subtotal }
  }), [cetak, dbMesin])

  const calcEmboss = useCallback(() => emboss.map(r => {
    const harga    = num(r.harga_per_cm2) > 0 ? num(r.harga_per_cm2) : lookupEmbossPrice(r.proses)
    const luasCm2  = num(r.luas_permukaan) * 10000 // m² → cm²
    const subtotal = num(r.quantity) * luasCm2 * harga
    return { ...r, harga_per_cm2: harga, subtotal }
  }), [emboss, dbEmboss])

  const calcMatProses = useCallback(() => matProses.map(r => {
    const match = dbMatProses.find(m => m.name === r.proses)
    const harga = match ? match.price : num(r.harga_satuan)
    return { ...r, harga_satuan: harga, subtotal: harga * num(r.quantity) }
  }), [matProses, dbMatProses])

  const calcFinishing = useCallback(() => finishing.map(r => {
    const match = dbFinishing.find(m => m.name === r.proses && m.spec === r.spesifik)
    const harga = match ? match.price : num(r.harga_satuan)
    return { ...r, harga_satuan: harga, subtotal: harga * num(request?.quantity || 0) }
  }), [finishing, dbFinishing, request])

  const matCalc  = calcMaterial()
  const cetakCalc= calcCetak()
  const embCalc  = calcEmboss()
  const mpCalc   = calcMatProses()
  const finCalc  = calcFinishing()

  const sub = {
    material:   matCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    cetak:      cetakCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    emboss:     embCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    matProses:  mpCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    finishing:  finCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    additional: additional.reduce((s, r) => s + num(r.harga), 0),
  }
  const total   = Object.values(sub).reduce((a, b) => a + b, 0)
  const selling = total * (1 + num(margin) / 100)
  const perUnit = request?.quantity ? selling / request.quantity : 0

  async function handleSave() {
    setSaving(true)
    await supabase.from('quotations').update({ is_active:false }).eq('request_id', requestId)
    const { error } = await supabase.from('quotations').insert({
      request_id: requestId, estimator_id: profile.id,
      customer_name: request.customer_name, product_type: request.product_type, quantity: request.quantity,
      material_cost: matCalc, cetak_cost: cetakCalc, emboss_laminasi: embCalc,
      material_proses: mpCalc, finishing_wo: finCalc, additional_cost: additional,
      subtotal_material: sub.material, subtotal_cetak: sub.cetak, subtotal_emboss: sub.emboss,
      subtotal_matproses: sub.matProses, subtotal_finishing: sub.finishing, subtotal_additional: sub.additional,
      total_cost: total, margin_percent: num(margin), selling_price: Math.round(selling),
      price_per_unit: perUnit, deal_status: 'quoted',
    })
    if (!error) {
      await supabase.from('requests').update({ status:'done', completed_at: new Date().toISOString() }).eq('id', requestId)
      navigate('/')
    }
    setSaving(false)
  }

  if (loading) return <Layout title="Kalkulator"><div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>Memuat data...</div></Layout>
  if (!request) return <Layout title="Kalkulator"><div style={{ padding:60, color:'#dc2626' }}>Request tidak ditemukan.</div></Layout>

  return (
    <Layout title={`Kalkulator — ${request.request_number}`}>
      {/* Info header */}
      <div style={{ ...s.card, borderLeft:`4px solid ${C.orange}`, padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12 }}>
          {[['Customer',request.customer_name],['Produk',request.product_type],['Qty',fmt(request.quantity)],
            ['Ukuran',request.product_size||'—'],['Material',request.material_spec||'—'],
            ['Print',request.print_spec||'—'],['Finishing',request.finishing_spec||'—']
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:500, color:C.dark }}>{v}</div>
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
              <img src={request.reference_image} alt="ref"
                style={{ maxHeight:120, maxWidth:200, borderRadius:8, border:`1px solid ${C.border}`, cursor:'pointer', objectFit:'cover' }}
                onClick={() => window.open(request.reference_image, '_blank')} />
            </div>
          )}
        </div>
      </div>

      {/* 1. MATERIAL COST */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>1. Material Cost</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.material > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.material)}</span>}
            <button style={s.addBtn} onClick={() => setMaterial(p => [...p, newMaterial()])}>+ Tambah Baris</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead><tr>
              {['Nama','Material','GSM','Plano','Luas Permukaan','Plano Get','Qty','Insheet','Harga/Lembar','Harga/pcs','Subtotal',''].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {material.length === 0 && <tr><td colSpan={12} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
              {matCalc.map((row, i) => (
                <tr key={row.id}>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setMaterial)(i,'nama',e.target.value)} placeholder="cover" /></td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:160 }} value={row.material}
                      onChange={e => setMaterial(p => p.map((r,idx) => idx===i ? {...r, material:e.target.value, gsm:'', plano:'79x109'} : r))}>
                      <option value="">-- pilih --</option>
                      {materialNames.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:80 }} value={row.gsm}
                      onChange={e => {
                        const newGsm = e.target.value
                        const opts = planoOptions(row.material, newGsm)
                        const newPlano = opts.length > 0 ? opts[0] : '79x109'
                        setMaterial(p => p.map((r,idx) => idx===i ? {...r, gsm:newGsm, plano:newPlano} : r))
                      }}>
                      <option value="">GSM</option>
                      {gsmOptions(row.material).map(g => <option key={g}>{g}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>
                    {row.plano === 'custom' ? (
                      <div style={{ display:'flex', gap:4 }}>
                        <select style={{ ...s.select, width:80 }} value={row.plano} onChange={e => updater(setMaterial)(i,'plano',e.target.value)}>
                          {PLANO_OPTIONS.map(p => <option key={p}>{p}</option>)}
                        </select>
                        <input style={{ ...s.input, width:55 }} placeholder="W" value={row.plano_w} onChange={e => updater(setMaterial)(i,'plano_w',e.target.value)} />
                        <input style={{ ...s.input, width:55 }} placeholder="H" value={row.plano_h} onChange={e => updater(setMaterial)(i,'plano_h',e.target.value)} />
                      </div>
                    ) : (
                      <select style={{ ...s.select, width:110 }} value={row.plano}
                        onChange={e => updater(setMaterial)(i,'plano',e.target.value)}>
                        {(planoOptions(row.material, row.gsm).length > 0 ? planoOptions(row.material, row.gsm) : PLANO_OPTIONS).map(p => <option key={p}>{p}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setMaterial)(i,'luas_permukaan',e.target.value)} placeholder="30x40" /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.plano_get} onChange={e => updater(setMaterial)(i,'plano_get',e.target.value)} placeholder="1" /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setMaterial)(i,'quantity',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setMaterial)(i,'insheet',e.target.value)} placeholder="500" /></td>
                  <td style={s.td}><div style={{ ...s.calc, color: row.harga_lembar > 0 ? '#16a34a' : '#9ca3af' }}>{row.harga_lembar > 0 ? idr(row.harga_lembar) : '—'}</div></td>
                  <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                  <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                  <td style={s.td}><button style={s.delBtn} onClick={() => setMaterial(p => p.filter((_,idx)=>idx!==i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. CETAK COST */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>2. Cetak Cost</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.cetak > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.cetak)}</span>}
            <button style={s.addBtn} onClick={() => setCetak(p => [...p, newCetak()])}>+ Tambah Baris</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Nama','Mesin','Warna','Insheet','Luas (m²)','Harga/Lembar','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {cetak.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
              {cetakCalc.map((row,i) => (
                <tr key={row.id}>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setCetak)(i,'nama',e.target.value)} /></td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:150 }} value={row.mesin} onChange={e => updater(setCetak)(i,'mesin',e.target.value)}>
                      {mesinNames.map(n=><option key={n}>{n}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:130 }} value={row.warna} onChange={e => updater(setCetak)(i,'warna',e.target.value)}>
                      {WARNA_OPTIONS.map(w=><option key={w}>{w}</option>)}
                    </select>
                  </td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setCetak)(i,'insheet',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} type="number" step="0.001" value={row.luas_permukaan} onChange={e => updater(setCetak)(i,'luas_permukaan',e.target.value)} /></td>
                  <td style={s.td}><div style={{ ...s.calc, color:'#16a34a' }}>{idr(row.harga_per_lembar)}</div></td>
                  <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                  <td style={s.td}><button style={s.delBtn} onClick={() => setCetak(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. EMBOSS / LAMINASI */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>3. Emboss / Laminasi</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.emboss > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.emboss)}</span>}
            <button style={s.addBtn} onClick={() => setEmboss(p=>[...p, newEmboss()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Qty','Luas (m²)','Harga/cm²','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {emboss.length === 0 && <tr><td colSpan={7} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {embCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setEmboss)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:160 }} value={row.proses} onChange={e => updater(setEmboss)(i,'proses',e.target.value)}>
                    {embossNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setEmboss)(i,'quantity',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:90 }} type="number" step="0.001" value={row.luas_permukaan} onChange={e => updater(setEmboss)(i,'luas_permukaan',e.target.value)} /></td>
                <td style={s.td}><div style={{ ...s.calc, color:'#16a34a' }}>{row.harga_per_cm2}</div></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setEmboss(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. MATERIAL PROSES */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>4. Material Proses</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.matProses > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.matProses)}</span>}
            <button style={s.addBtn} onClick={() => setMatProses(p=>[...p, newMatProses()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Harga Satuan','Qty','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {matProses.length === 0 && <tr><td colSpan={6} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {mpCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setMatProses)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:160 }} value={row.proses} onChange={e => updater(setMatProses)(i,'proses',e.target.value)}>
                    <option value="">-- pilih --</option>
                    {matProsesNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}><div style={{ ...s.calc, color:'#16a34a' }}>{idr(row.harga_satuan)}</div></td>
                <td style={s.td}><input style={{ ...s.input, width:70 }} type="number" value={row.quantity} onChange={e => updater(setMatProses)(i,'quantity',e.target.value)} /></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setMatProses(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. FINISHING WO */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>5. Finishing WO</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.finishing > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.finishing)}</span>}
            <button style={s.addBtn} onClick={() => setFinishing(p=>[...p, newFinishing()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Proses','Spesifik','Harga/pcs','Subtotal (×qty)',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {finishing.length === 0 && <tr><td colSpan={6} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {finCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setFinishing)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:150 }} value={row.proses}
                    onChange={e => { updater(setFinishing)(i,'proses',e.target.value); updater(setFinishing)(i,'spesifik','') }}>
                    <option value="">-- pilih --</option>
                    {finishingProses.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:220 }} value={row.spesifik} onChange={e => updater(setFinishing)(i,'spesifik',e.target.value)}>
                    <option value="">-- pilih spesifik --</option>
                    {finishingSpecs(row.proses).map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={s.td}><div style={{ ...s.calc, color:'#16a34a' }}>{idr(row.harga_satuan)}</div></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setFinishing(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6. ADDITIONAL COST */}
      <div style={s.card}>
        <div style={s.sTitle}>
          <span>6. Additional Cost</span>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {sub.additional > 0 && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>{idr(sub.additional)}</span>}
            <button style={s.addBtn} onClick={() => setAdditional(p=>[...p, newAdditional()])}>+ Tambah Baris</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nama','Keterangan','Harga',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {additional.length === 0 && <tr><td colSpan={4} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {additional.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:120 }} value={row.nama} onChange={e => updater(setAdditional)(i,'nama',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:220 }} value={row.keterangan} onChange={e => updater(setAdditional)(i,'keterangan',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:120 }} type="number" value={row.harga} onChange={e => updater(setAdditional)(i,'harga',e.target.value)} /></td>
                <td style={s.td}><button style={s.delBtn} onClick={() => setAdditional(p=>p.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SUMMARY */}
      <div style={{ ...s.card, borderTop:`3px solid #16a34a` }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.dark, marginBottom:12 }}>Ringkasan Biaya</div>
            {[['Material Cost',sub.material],['Cetak Cost',sub.cetak],['Emboss / Laminasi',sub.emboss],
              ['Material Proses',sub.matProses],['Finishing WO',sub.finishing],['Additional Cost',sub.additional]
            ].map(([label,val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.cream}`, fontSize:13, color:C.dark }}>
                <span>{label}</span><span style={{ fontFamily:'monospace' }}>{idr(val)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:14, fontWeight:700, color:C.dark, borderTop:`2px solid ${C.border}`, marginTop:4 }}>
              <span>Total Modal</span><span>{idr(total)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.dark, marginBottom:12 }}>Harga Jual</div>
            <label style={{ fontSize:13, color:C.brown, display:'block', marginBottom:6 }}>Margin (%)</label>
            <input type="number" min="0" max="100" value={margin}
              onChange={e => setMargin(e.target.value)}
              style={{ ...s.input, width:100, fontSize:16, fontWeight:600, marginBottom:16 }} />
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:16 }}>
              <div style={{ fontSize:12, color:'#16a34a', marginBottom:4 }}>Harga Jual Total</div>
              <div style={{ fontSize:26, fontWeight:700, color:'#15803d' }}>{idr(selling)}</div>
              <div style={{ fontSize:13, color:'#16a34a', marginTop:6 }}>
                Per unit: {idr(perUnit)} &nbsp;|&nbsp; Qty: {fmt(request.quantity)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop:24, display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button onClick={() => navigate('/')} style={{ padding:'10px 20px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:'pointer', color:C.dark }}>
            Kembali
          </button>
          <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
            {saving ? 'Menyimpan...' : '💾 Simpan & Selesai'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
