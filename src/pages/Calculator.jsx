import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const fmt  = n => (n || 0).toLocaleString('id-ID')
const num  = v => parseFloat(v) || 0
const idr  = n => 'Rp ' + fmt(Math.round(n))

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const PLANO_OPTIONS = ['79x109','65x100','90x120','90x100','77x66','75x100','70x100','120x200','custom']
const WARNA_OPTIONS = ['1 warna','2 warna','4 warna','4 warna + 1 spesial','5 warna']
const ADDITIONAL_PROSES = ['transport','film','potong','BBL','packing','jendela mika','mika','lem samping']

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
const newMaterial  = () => ({ id:Date.now(), nama:'', material:'', gsm:'', plano:'79x109', plano_w:'', plano_h:'', harga_kg:0, luas_permukaan:'', mata:1, plano_get:'', insheet:'', quantity:0, harga_lembar:0, harga_per_pcs:0 })
const newCetak     = () => ({ id:Date.now(), nama:'', mesin:'SM 74', warna:'4 warna', quantity:0, luas_permukaan:'', insheet:0, harga_per_lembar:0 })
const newEmboss    = () => ({ id:Date.now(), nama:'', proses:'Laminasi Doff', quantity:0, luas_permukaan:'', insheet:0, harga_per_cm2:0 })
const newMatProses = () => ({ id:Date.now(), nama:'', proses:'', harga_satuan:0, quantity:1, luas_permukaan:'' })
const newFinishing = () => ({ id:Date.now(), nama:'', proses:'', spesifik:'', harga_satuan:0 })
const newAdditional= () => ({ id:Date.now(), nama:'', proses:'', keterangan:'', luas_permukaan:'', gramasi:'', panjang_lem:'', quantity:0, harga:0 })

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
  const [dbAdditional,setDbAdditional]= useState([])

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
      { data: addl },
    ] = await Promise.all([
      supabase.from('requests').select('*').eq('id', requestId).single(),
      supabase.from('raw_materials').select('*').eq('category','material').order('name'),
      supabase.from('raw_materials').select('id,name,spec,notes,price,harga_mesin,qty_threshold').eq('category','cetak').order('name'),
      supabase.from('raw_materials').select('id,name,spec,notes,price,minimum_charge').eq('category','emboss_laminasi').order('name'),
      supabase.from('raw_materials').select('id,name,spec,notes,price,rate_per_cm').eq('category','material_proses').order('name'),
      supabase.from('raw_materials').select('*').eq('category','finishing_wo').order('name'),
      supabase.from('raw_materials').select('id,name,price,rate_per_kg,rate_a,rate_b,minimum_charge').eq('category','additional').order('name'),
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
    setDbAdditional(addl || [])
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
    const match = dbMaterials.find(m => {
      const mName = m.name.toLowerCase().trim()
      const mSpec = (m.spec || '').trim()
      const mGsm  = normalizeGsmLocal(m.notes)
      const ok = mName === normName && mSpec === normPlano && mGsm === normGsm
      return ok
    })
    return match ? match.price : 0
  }

  function lookupMesin(mesinName) {
    const match = dbMesin.find(m => m.name === mesinName)
    return match ? {
      per_drug: match.price || 0,
      harga_mesin: match.harga_mesin || 0,
      qty_threshold: match.qty_threshold || 0
    } : { per_drug: 0, harga_mesin: 0, qty_threshold: 0 }
  }

  function lookupEmboss(prosesName) {
    const match = dbEmboss.find(m => m.name === prosesName)
    return match ? { harga: match.price || 0, minimum_charge: match.minimum_charge || 0 } : { harga: 0, minimum_charge: 0 }
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
    const mata         = num(r.mata) || 1
    const isBusa       = r.material && r.material.toLowerCase().includes('busa')
    // Harga/lembar: busa → ketebalan x rate_per_cm; custom plano → harga/kg; lainnya → DB
    let harga
    if (isBusa) {
      const matchBusa = dbMaterials.find(m => m.name === r.material)
      const rate = matchBusa ? (matchBusa.rate_per_cm || matchBusa.price || 0) : 0
      harga = num(r.gsm) * rate
    } else if (r.plano === 'custom' && num(r.plano_w) > 0 && num(r.plano_h) > 0 && num(r.harga_kg) > 0) {
      harga = (num(r.plano_w) * num(r.plano_h) * num(r.gsm) * num(r.harga_kg)) / 20000 / 500
    } else {
      harga = lookupMaterialPrice(r.material, r.plano, r.gsm)
    }
    // Rumus: ((qty + insheet) / plano_get / mata * harga) / qty
    const harga_per_pcs = (planoGet > 0 && quantity > 0 && insheet > 0)
      ? ((quantity + insheet) / planoGet / mata * harga) / quantity
      : 0
    const subtotal_raw = harga_per_pcs * quantity
    const diskon = num(r.diskon)
    const subtotal = subtotal_raw * (1 - diskon/100)
    return { ...r, harga_lembar: harga, harga_per_pcs, subtotal_raw, subtotal }
  }), [material, dbMaterials])

  const calcCetak = useCallback(() => cetak.map(r => {
    const qty      = num(r.quantity)
    const insheet  = num(r.insheet)
    const mesin    = lookupMesin(r.mesin)
    // Rumus: kalau qty+insheet < threshold → minimum harga_mesin
    // kalau qty+insheet >= threshold → ((qty+insheet-threshold)*per_drug + harga_mesin) / qty
    const total_biaya = (qty + insheet) >= mesin.qty_threshold
      ? ((qty + insheet - mesin.qty_threshold) * mesin.per_drug + mesin.harga_mesin)
      : mesin.harga_mesin
    const harga_per_pcs = qty > 0 ? total_biaya / qty : 0
    const subtotal_raw = harga_per_pcs * qty
    const diskon = num(r.diskon)
    const subtotal = subtotal_raw * (1 - diskon/100)
    return { ...r, harga_per_pcs, harga_mesin: mesin.harga_mesin, per_drug: mesin.per_drug, qty_threshold: mesin.qty_threshold, subtotal_raw, subtotal }
  }), [cetak, dbMesin])

  const calcEmboss = useCallback(() => emboss.map(r => {
    const proc    = lookupEmboss(r.proses)
    const qty     = num(r.quantity)
    const insheet = num(r.insheet)
    // Parse luas_permukaan format "PxL" dalam cm
    const parts   = String(r.luas_permukaan || '').toLowerCase().split('x')
    const P       = num(parts[0])
    const L       = num(parts[1])
    // Rumus: (P x L x harga x (qty+insheet)) / qty, minimum dikunci ke minimum_charge
    const subtotal_calc = (P * L * proc.harga * (qty + insheet))
    const subtotal_raw = Math.max(subtotal_calc, proc.minimum_charge)
    const harga_per_pcs = qty > 0 ? subtotal_raw / qty : 0
    const diskon = num(r.diskon)
    const subtotal = subtotal_raw * (1 - diskon/100)
    return { ...r, harga_per_cm2: proc.harga, minimum_charge: proc.minimum_charge, harga_per_pcs, subtotal_raw, subtotal }
  }), [emboss, dbEmboss])

  const PROSES_LUAS = ['pisau pond', 'klise poly', 'klise emboss']
  const calcMatProses = useCallback(() => matProses.map(r => {
    const match = dbMatProses.find(m => m.name === r.proses)
    const isLuasBased = PROSES_LUAS.includes(r.proses)
    const qty = num(r.quantity)
    let harga_per_pcs, subtotal
    if (isLuasBased && match) {
      const parts = String(r.luas_permukaan || '').toLowerCase().split('x')
      const P = num(parts[0])
      const L = num(parts[1])
      const total_biaya = P * L * (match.rate_per_cm || 0)
      harga_per_pcs = qty > 0 ? total_biaya / qty : 0
      subtotal = total_biaya
    } else {
      harga_per_pcs = match ? match.price : num(r.harga_satuan)
      subtotal = harga_per_pcs * qty
    }
    const subtotal_raw = subtotal
    const diskon = num(r.diskon)
    const subtotal_final = subtotal_raw * (1 - diskon/100)
    return { ...r, harga_satuan: harga_per_pcs, subtotal_raw, subtotal: subtotal_final }
  }), [matProses, dbMatProses])

  const calcFinishing = useCallback(() => finishing.map(r => {
    const match = dbFinishing.find(m => m.name === r.proses && m.spec === r.spesifik)
    const harga = match ? match.price : num(r.harga_satuan)
    const subtotal_raw = harga * num(request?.quantity || 0)
    const diskon = num(r.diskon)
    const subtotal = subtotal_raw * (1 - diskon/100)
    return { ...r, harga_satuan: harga, subtotal_raw, subtotal }
  }), [finishing, dbFinishing, request])

  const calcAdditional = useCallback(() => additional.map(r => {
    const match = dbAdditional.find(m => m.name === r.proses)
    const qty = num(r.quantity)
    const diskon = num(r.diskon)
    if (r.proses === 'potong' && match) {
      const parts = String(r.luas_permukaan || '').toLowerCase().split('x')
      const P = num(parts[0])
      const L = num(parts[1])
      const gramasi = num(r.gramasi)
      const total_kg = (P * L * gramasi) / 10000
      const biaya_total = total_kg * (match.rate_per_kg || 0)
      const subtotal_raw = Math.max(biaya_total, match.minimum_charge || 0)
      const harga_per_pcs = qty > 0 ? subtotal_raw / qty : 0
      const subtotal = subtotal_raw * (1 - diskon/100)
      return { ...r, harga: harga_per_pcs, subtotal_raw, subtotal }
    }
    if (r.proses === 'lem samping' && match) {
      const panjang = num(r.panjang_lem)
      const harga_per_pcs_calc = (panjang * (match.rate_a || 0)) + (match.rate_b || 0)
      const subtotal_calc = harga_per_pcs_calc * qty
      const subtotal_raw = Math.max(subtotal_calc, match.minimum_charge || 0)
      const harga_per_pcs = qty > 0 ? subtotal_raw / qty : 0
      const subtotal = subtotal_raw * (1 - diskon/100)
      return { ...r, harga: harga_per_pcs, subtotal_raw, subtotal }
    }
    // Proses manual lainnya - harga diisi per pcs, subtotal = harga x qty
    const subtotal_raw = num(r.harga) * qty
    const subtotal = subtotal_raw * (1 - diskon/100)
    return { ...r, subtotal_raw, subtotal }
  }), [additional, dbAdditional])

  const matCalc  = calcMaterial()
  const cetakCalc= calcCetak()
  const embCalc  = calcEmboss()
  const mpCalc   = calcMatProses()
  const finCalc  = calcFinishing()
  const addCalc  = calcAdditional()

  const sub = {
    material:   matCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    cetak:      cetakCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    emboss:     embCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    matProses:  mpCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    finishing:  finCalc.reduce((s, r) => s + (r.subtotal||0), 0),
    additional: addCalc.reduce((s, r) => s + (r.subtotal||0), 0),
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
      total_cost: total, margin_percent: num(margin),
      selling_price: Math.round(selling),
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
              {['Nama','Material','GSM','Plano','Luas Permukaan','Mata','Plano Get','Qty','Insheet','Harga/Lembar','Harga/pcs','Diskon%','Subtotal',''].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {material.length === 0 && <tr><td colSpan={14} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
              {matCalc.map((row, i) => (
                <tr key={row.id}>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setMaterial)(i,'nama',e.target.value)} placeholder="cover" /></td>
                  <td style={s.td}>
                    <select style={{ ...s.select, width:160 }} value={row.material}
                      onChange={e => {
                        const val = e.target.value
                        const isBusaSel = val.toLowerCase().includes('busa')
                        setMaterial(p => p.map((r,idx) => idx===i ? {...r, material:val, gsm:'', plano: isBusaSel ? '120x200' : '79x109'} : r))
                      }}>
                      <option value="">-- pilih --</option>
                      {materialNames.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>
                    {(row.plano === 'custom' || (row.material && row.material.toLowerCase().includes('busa'))) ? (
                      <input style={{ ...s.input, width:80 }} type="number" step="0.1" value={row.gsm} onChange={e => updater(setMaterial)(i,'gsm',e.target.value)} placeholder={row.material && row.material.toLowerCase().includes('busa') ? 'tebal(cm)' : 'GSM'} />
                    ) : (
                      <select style={{ ...s.select, width:80 }} value={row.gsm}
                        onChange={e => {
                          const newGsm = e.target.value
                          const opts = planoOptions(row.material, newGsm)
                          const newPlano = row.plano === 'custom' ? 'custom' : (opts.length > 0 ? opts[0] : '79x109')
                          setMaterial(p => p.map((r,idx) => idx===i ? {...r, gsm:newGsm, plano:newPlano} : r))
                        }}>
                        <option value="">GSM</option>
                        {gsmOptions(row.material).map(g => <option key={g}>{g}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={s.td}>
                    {(row.material && row.material.toLowerCase().includes('busa')) ? (
                      <div style={s.calc}>120x200</div>
                    ) : row.plano === 'custom' ? (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <select style={{ ...s.select, width:80 }} value={row.plano} onChange={e => updater(setMaterial)(i,'plano',e.target.value)}>
                          {PLANO_OPTIONS.map(p => <option key={p}>{p}</option>)}
                        </select>
                        <input style={{ ...s.input, width:50 }} placeholder="P(cm)" type="number" value={row.plano_w} onChange={e => updater(setMaterial)(i,'plano_w',e.target.value)} />
                        <input style={{ ...s.input, width:50 }} placeholder="L(cm)" type="number" value={row.plano_h} onChange={e => updater(setMaterial)(i,'plano_h',e.target.value)} />
                        <input style={{ ...s.input, width:80 }} placeholder="Rp/kg" type="number" value={row.harga_kg||''} onChange={e => updater(setMaterial)(i,'harga_kg',e.target.value)} />
                      </div>
                    ) : (
                      <select style={{ ...s.select, width:110 }} value={row.plano}
                        onChange={e => updater(setMaterial)(i,'plano',e.target.value)}>
                        {(planoOptions(row.material, row.gsm).length > 0 ? planoOptions(row.material, row.gsm) : PLANO_OPTIONS).map(p => <option key={p}>{p}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setMaterial)(i,'luas_permukaan',e.target.value)} placeholder="30x40" /></td>
                  <td style={s.td}><input style={{ ...s.input, width:60 }} type="number" min="1" value={row.mata||1} onChange={e => updater(setMaterial)(i,'mata',e.target.value)} placeholder="1" /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.plano_get} onChange={e => updater(setMaterial)(i,'plano_get',e.target.value)} placeholder="1" /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setMaterial)(i,'quantity',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setMaterial)(i,'insheet',e.target.value)} placeholder="500" /></td>
                  <td style={s.td}><div style={{ ...s.calc, color: row.harga_lembar > 0 ? '#16a34a' : '#9ca3af' }}>{row.harga_lembar > 0 ? idr(row.harga_lembar) : '—'}</div></td>
                  <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                  <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setMaterial)(i,'diskon',e.target.value)} placeholder="0" /></td>
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
              {['Nama','Mesin','Warna','Qty','Insheet','Luas Permukaan','Harga/pcs','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {cetak.length === 0 && <tr><td colSpan={10} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
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
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setCetak)(i,'quantity',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setCetak)(i,'insheet',e.target.value)} /></td>
                  <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setCetak)(i,'luas_permukaan',e.target.value)} placeholder="30x40" /></td>
                  <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                  <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setCetak)(i,'diskon',e.target.value)} placeholder="0" /></td>
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
            {['Nama','Proses','Qty','Insheet','Luas Permukaan','Harga/pcs','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {emboss.length === 0 && <tr><td colSpan={9} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {embCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:90 }} value={row.nama} onChange={e => updater(setEmboss)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:160 }} value={row.proses} onChange={e => updater(setEmboss)(i,'proses',e.target.value)}>
                    {embossNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.quantity} onChange={e => updater(setEmboss)(i,'quantity',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:80 }} type="number" value={row.insheet} onChange={e => updater(setEmboss)(i,'insheet',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setEmboss)(i,'luas_permukaan',e.target.value)} placeholder="20x20" /></td>
                <td style={s.td}><div style={s.calcGreen}>{row.harga_per_pcs > 0 ? idr(row.harga_per_pcs) : '—'}</div></td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setEmboss)(i,'diskon',e.target.value)} placeholder="0" /></td>
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
            {['Nama','Proses','Luas Permukaan','Harga Satuan','Qty','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {matProses.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {mpCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setMatProses)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:160 }} value={row.proses} onChange={e => updater(setMatProses)(i,'proses',e.target.value)}>
                    <option value="">-- pilih --</option>
                    {matProsesNames.map(n=><option key={n}>{n}</option>)}
                  </select>
                </td>
                <td style={s.td}><input style={{ ...s.input, width:90 }} type="text" value={row.luas_permukaan} onChange={e => updater(setMatProses)(i,'luas_permukaan',e.target.value)} placeholder="20x20" /></td>
                <td style={s.td}><div style={{ ...s.calc, color:'#16a34a' }}>{idr(row.harga_satuan)}</div></td>
                <td style={s.td}><input style={{ ...s.input, width:70 }} type="number" value={row.quantity} onChange={e => updater(setMatProses)(i,'quantity',e.target.value)} /></td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setMatProses)(i,'diskon',e.target.value)} placeholder="0" /></td>
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
            {['Nama','Proses','Spesifik','Harga/pcs','Diskon%','Subtotal (×qty)',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {finishing.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
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
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setFinishing)(i,'diskon',e.target.value)} placeholder="0" /></td>
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
            {['Nama','Proses','Detail','Qty','Harga/pcs','Diskon%','Subtotal',''].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {additional.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#d1d5db', fontSize:13 }}>Klik "+ Tambah Baris"</td></tr>}
            {addCalc.map((row,i) => (
              <tr key={row.id}>
                <td style={s.td}><input style={{ ...s.input, width:100 }} value={row.nama} onChange={e => updater(setAdditional)(i,'nama',e.target.value)} /></td>
                <td style={s.td}>
                  <select style={{ ...s.select, width:130 }} value={row.proses} onChange={e => updater(setAdditional)(i,'proses',e.target.value)}>
                    <option value="">-- pilih --</option>
                    {ADDITIONAL_PROSES.map(p=><option key={p}>{p}</option>)}
                  </select>
                </td>
                <td style={s.td}>
                  {row.proses === 'potong' ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input style={{ ...s.input, width:70 }} type="text" placeholder="PxL cm" value={row.luas_permukaan} onChange={e => updater(setAdditional)(i,'luas_permukaan',e.target.value)} />
                      <input style={{ ...s.input, width:80 }} type="number" placeholder="gsm" value={row.gramasi} onChange={e => updater(setAdditional)(i,'gramasi',e.target.value)} />
                    </div>
                  ) : row.proses === 'lem samping' ? (
                    <input style={{ ...s.input, width:100 }} type="number" placeholder="panjang(cm)" value={row.panjang_lem} onChange={e => updater(setAdditional)(i,'panjang_lem',e.target.value)} />
                  ) : (
                    <input style={{ ...s.input, width:180 }} value={row.keterangan} onChange={e => updater(setAdditional)(i,'keterangan',e.target.value)} placeholder="keterangan" />
                  )}
                </td>
                <td style={s.td}>
                  <input style={{ ...s.input, width:70 }} type="number" value={row.quantity} onChange={e => updater(setAdditional)(i,'quantity',e.target.value)} />
                </td>
                <td style={s.td}>
                  {(row.proses === 'potong' || row.proses === 'lem samping') ? (
                    <div style={s.calcGreen}>{row.harga > 0 ? idr(row.harga) : '—'}</div>
                  ) : (
                    <input style={{ ...s.input, width:110 }} type="number" value={row.harga} onChange={e => updater(setAdditional)(i,'harga',e.target.value)} placeholder="harga/pcs" />
                  )}
                </td>
                <td style={s.td}><input style={{ ...s.input, width:55 }} type="number" min="0" max="100" value={row.diskon||""} onChange={e => updater(setAdditional)(i,'diskon',e.target.value)} placeholder="0" /></td>
                <td style={s.td}><div style={s.calcGreen}>{idr(row.subtotal||0)}</div></td>
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
