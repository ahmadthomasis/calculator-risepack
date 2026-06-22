import { useState, useEffect, useCallback, useRef } from 'react'
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
  input:  { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', color:C.dark, textAlign:'center' },
  select: { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, outline:'none', background:'#fff', width:'100%', boxSizing:'border-box', color:C.dark, textAlign:'center' },
  th:     { padding:'8px 10px', fontSize:11, color:'#9ca3af', fontWeight:500, textAlign:'center', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:     { padding:'5px 5px', verticalAlign:'middle', textAlign:'center', display:'table-cell' },
  calc:   { padding:'7px 10px', background:C.cream, border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, color:C.dark, textAlign:'center', minWidth:80 },
  calcGreen: { padding:'7px 10px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:6, fontSize:13, color:'#16a34a', fontWeight:600, textAlign:'center', minWidth:90 },
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

  // ── Pembanding harga vendor (opsional, TIDAK menggantikan hitung manual) ──
  const [hasVendorComparison, setHasVendorComparison] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [vendorPricePerPcs, setVendorPricePerPcs] = useState('')
  const [vendorNameSuggestions, setVendorNameSuggestions] = useState([])

  // ── Multi-quantity ──────────────────────────────────────────
  const [qtyList, setQtyList]         = useState([])   // daftar semua qty diminta sales, misal [200000, 400000]
  const [activeQty, setActiveQty]     = useState(null) // qty yang sedang dikerjakan estimator
  const [savedQtys, setSavedQtys]     = useState([])   // qty yang sudah punya quotation tersimpan
  const qtyCache = useRef({}).current                   // cache state per-qty di memori (tidak re-render saat diisi)

  // Snapshot state terkini, dipakai di cleanup function useEffect supaya
  // tidak baca closure basi (cleanup tidak re-register tiap keystroke)
  const latestRef = useRef({})
  useEffect(() => {
    latestRef.current = {
      requestId, profile, request, activeQty, savedQtys, qtyList,
      material, cetak, emboss, matProses, finishing, additional, margin,
      hasVendorComparison, vendorName, vendorPricePerPcs,
    }
  })

  const normGsm = (rows) => (rows || []).map(r => ({
    ...r,
    gsm: String(r.gsm || '').toLowerCase().replace('gsm','').trim()
  }))

  // ── Auto-save draft (dipanggil manual saat pindah qty, dan otomatis saat unmount) ──
  // PENTING: sengaja cuma 1 network call (INSERT langsung, tanpa cek existing dulu),
  // karena ini dipanggil dari cleanup function saat user pindah halaman — kalau ada
  // 2 call berantai (SELECT lalu INSERT/UPDATE), call kedua sering tidak sempat
  // terkirim sebelum browser pindah ke komponen halaman berikutnya.
  // Konsekuensi: bisa numpuk beberapa baris draft duplikat. Itu ditangani saat
  // loadAll() — ambil draft TERBARU saja, lalu hapus duplikat yang lebih lama.
  async function saveDraftFor(qty, state) {
    if (qty == null || !state.requestId || !state.profile) return
    // Jangan timpa draft kalau qty ini sudah punya quotation FINAL tersimpan
    if (state.savedQtys.includes(qty)) return
    // Jangan simpan draft kosong (tidak ada isian sama sekali di 6 section).
    // Vendor cuma data pembanding tambahan, tidak menggantikan isian 6 section,
    // jadi tidak relevan dipakai sebagai penentu kosong/tidaknya draft.
    const isEmpty = ['material','cetak','emboss','matProses','finishing','additional']
      .every(k => !Array.isArray(state[k]) || state[k].length === 0)
    if (isEmpty) return

    try {
      const { error } = await supabase.from('quotations').insert({
        request_id: state.requestId, estimator_id: state.profile.id, quantity: qty,
        customer_name: state.request?.customer_name || '', product_type: state.request?.product_type || '',
        is_draft: true, is_active: false, deal_status: 'quoted',
        material_cost: state.material, cetak_cost: state.cetak, emboss_laminasi: state.emboss,
        material_proses: state.matProses, finishing_wo: state.finishing, additional_cost: state.additional,
        margin_percent: num(state.margin), updated_at: new Date().toISOString(),
        cost_source: state.hasVendorComparison ? 'vendor' : 'internal',
        vendor_name: state.hasVendorComparison ? (state.vendorName || null) : null,
        vendor_price_per_pcs: state.hasVendorComparison ? (num(state.vendorPricePerPcs) || null) : null,
        // Draft belum final, jadi kalkulasi total belum relevan — isi 0 sebagai
        // default aman untuk berjaga-jaga kalau ada NOT NULL constraint di kolom ini.
        subtotal_material: 0, subtotal_cetak: 0, subtotal_emboss: 0,
        subtotal_matproses: 0, subtotal_finishing: 0, subtotal_additional: 0,
        total_cost: 0, selling_price: 0, price_per_unit: 0,
      })
      // PENTING: supabase-js TIDAK throw untuk error HTTP/database (mis. constraint
      // violation) — error dikembalikan sebagai field `error`, bukan exception.
      // Tanpa baris ini, kegagalan insert (mis. NOT NULL constraint) akan diam-diam
      // gagal tanpa pernah terlihat di console.
      if (error) console.error('Gagal auto-save draft (Supabase error):', error)
    } catch (e) {
      // Auto-save draft tidak boleh mengganggu alur utama kalau gagal (mis. offline).
      // Paling buruk: draft tidak tersimpan, kembali ke perilaku lama.
      console.error('Gagal auto-save draft (exception):', e)
    }
  }

  useEffect(() => { loadAll() }, [requestId])

  // Dipanggil dari Layout (lewat prop beforeNavigate) SEBELUM navigasi benar-benar
  // terjadi, supaya draft pasti selesai tersimpan dulu. Ini menggantikan pendekatan
  // lama (auto-save di cleanup function useEffect saat unmount), yang terbukti TIDAK
  // reliable: cleanup function tidak bisa di-await, jadi browser sering pindah render
  // sebelum request ke Supabase sempat benar-benar terkirim.
  async function handleBeforeNavigate() {
    await saveDraftFor(activeQty, latestRef.current)
  }

  useEffect(() => {
    if (requestId) localStorage.setItem('risepack_last_calculator_request', requestId)
  }, [requestId])

  // ── Pindah tab quantity ─────────────────────────────────────
  // savedQtysOverride: dipakai saat dipanggil tepat setelah handleSave, karena
  // latestRef.current.savedQtys mungkin belum sinkron (useEffect belum jalan ulang).
  async function switchQty(newQty, savedQtysOverride) {
    if (newQty === activeQty) return

    // Simpan state section saat ini ke cache sebelum pindah
    qtyCache[activeQty] = { material, cetak, emboss, matProses, finishing, additional, margin, hasVendorComparison, vendorName, vendorPricePerPcs }
    // Auto-save draft qty yang sedang ditinggalkan. DITUNGGU (await) supaya pasti
    // selesai tersimpan sebelum UI pindah ke tab qty berikutnya.
    await saveDraftFor(activeQty, { ...latestRef.current, savedQtys: savedQtysOverride || latestRef.current.savedQtys })

    if (qtyCache[newQty]) {
      // Qty ini sudah pernah dibuka/tersimpan, load dari cache
      const c = qtyCache[newQty]
      setMaterial(c.material); setCetak(c.cetak); setEmboss(c.emboss)
      setMatProses(c.matProses); setFinishing(c.finishing); setAdditional(c.additional)
      setMargin(c.margin)
      setHasVendorComparison(c.hasVendorComparison || false); setVendorName(c.vendorName || ''); setVendorPricePerPcs(c.vendorPricePerPcs ?? '')
    } else {
      // Qty ini belum pernah dibuka, prefill dari qty pertama (kalau ada),
      // qty & insheet dikosongkan ulang karena nilainya pasti beda untuk qty lain.
      // Sumber perhitungan (Internal/Vendor) SENGAJA tidak ikut di-prefill --
      // tiap qty bisa beda sumber, jadi qty baru selalu mulai dari Internal default,
      // bukan otomatis ikut sumber qty pertama yang bisa menyesatkan.
      const firstQty = qtyList[0]
      const base = qtyCache[firstQty]
      if (base) {
        const cloneRows = (rows) => rows.map(r => ({ ...r, id: Date.now() + Math.random(), quantity: '', insheet: '' }))
        setMaterial(cloneRows(base.material))
        setCetak(cloneRows(base.cetak))
        setEmboss(cloneRows(base.emboss))
        setMatProses(base.matProses.map(r => ({ ...r, id: Date.now() + Math.random(), quantity: 1 })))
        setFinishing(base.finishing.map(r => ({ ...r, id: Date.now() + Math.random() })))
        setAdditional(cloneRows(base.additional))
        setMargin(base.margin)
      } else {
        setMaterial([]); setCetak([]); setEmboss([]); setMatProses([]); setFinishing([]); setAdditional([])
        setMargin(15)
      }
      setHasVendorComparison(false); setVendorName(''); setVendorPricePerPcs('')
    }
    setActiveQty(newQty)
  }

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
    // Load semua quotation aktif untuk request ini (bisa lebih dari 1, satu per qty)
    const { data: quots } = await supabase.from('quotations').select('*')
      .eq('request_id', requestId).eq('is_active', true).eq('is_draft', false)

    // Daftar nama vendor unik yang pernah dipakai (untuk autocomplete), supaya
    // estimator konsisten penulisan nama vendor, bukan ketik bebas tiap kali.
    const { data: vendorRows } = await supabase.from('quotations')
      .select('vendor_name').not('vendor_name', 'is', null)
    const uniqueVendors = [...new Set((vendorRows || []).map(v => v.vendor_name).filter(Boolean))].sort()
    setVendorNameSuggestions(uniqueVendors)

    // Load draft milik estimator yang sedang login untuk request ini (auto-save dari sesi sebelumnya)
    // Urutkan terbaru dulu, supaya kalau ada duplikat (lihat catatan di saveDraftFor),
    // draft yang dipakai adalah yang paling baru.
    const { data: drafts } = profile
      ? await supabase.from('quotations').select('*')
          .eq('request_id', requestId).eq('estimator_id', profile.id).eq('is_draft', true)
          .order('updated_at', { ascending: false })
      : { data: [] }

    // Tentukan daftar qty: dari quantities (array baru) dengan fallback ke quantity (lama, tunggal)
    const qtys = Array.isArray(req?.quantities) && req.quantities.length > 0
      ? req.quantities
      : (req?.quantity ? [req.quantity] : [])

    // Set semua state sekaligus agar tidak ada race condition
    setRequest(req)
    setDbMaterials(mats || [])
    setDbMesin(mesin || [])
    setDbEmboss(emb || [])
    setDbMatProses(mp || [])
    setDbFinishing(fin || [])
    setDbAdditional(addl || [])
    setQtyList(qtys)

    const savedQtyNumbers = (quots || []).map(q => q.quantity)
    setSavedQtys(savedQtyNumbers)

    // Isi cache dari quotation FINAL yang sudah tersimpan (prioritas utama)
    ;(quots || []).forEach(q => {
      qtyCache[q.quantity] = {
        material: normGsm(q.material_cost), cetak: q.cetak_cost || [], emboss: q.emboss_laminasi || [],
        matProses: q.material_proses || [], finishing: q.finishing_wo || [], additional: q.additional_cost || [],
        margin: q.margin_percent || 15,
        hasVendorComparison: q.cost_source === 'vendor',
        vendorName: q.vendor_name || '',
        vendorPricePerPcs: q.vendor_price_per_pcs ?? '',
      }
    })
    // Isi cache dari DRAFT untuk qty yang BELUM punya quotation final.
    // Karena drafts sudah terurut terbaru dulu, draft pertama yang ditemukan
    // untuk tiap qty adalah yang dipakai; sisanya (duplikat lama) ditandai untuk dihapus.
    const staleDraftIds = []
    const seenDraftQtys = new Set()
    ;(drafts || []).forEach(d => {
      if (qtyCache[d.quantity]) { staleDraftIds.push(d.id); return } // sudah ada final, draft ini basi
      if (seenDraftQtys.has(d.quantity)) { staleDraftIds.push(d.id); return } // duplikat lebih lama, basi
      seenDraftQtys.add(d.quantity)
      qtyCache[d.quantity] = {
        material: normGsm(d.material_cost), cetak: d.cetak_cost || [], emboss: d.emboss_laminasi || [],
        matProses: d.material_proses || [], finishing: d.finishing_wo || [], additional: d.additional_cost || [],
        margin: d.margin_percent || 15,
        hasVendorComparison: d.cost_source === 'vendor',
        vendorName: d.vendor_name || '',
        vendorPricePerPcs: d.vendor_price_per_pcs ?? '',
      }
    })
    // Bersihkan draft basi di background, tidak perlu ditunggu (tidak mempengaruhi tampilan)
    if (staleDraftIds.length > 0) {
      supabase.from('quotations').delete().in('id', staleDraftIds)
        .then(({ error }) => { if (error) console.error('Gagal bersihkan draft basi:', error) })
    }

    // Mulai dari qty pertama yang belum tersimpan, atau qty pertama kalau semua sudah tersimpan
    const firstUnsaved = qtys.find(q => !savedQtyNumbers.includes(q))
    const startQty = firstUnsaved ?? qtys[0] ?? null
    setActiveQty(startQty)

    if (startQty != null && qtyCache[startQty]) {
      const c = qtyCache[startQty]
      setMaterial(c.material); setCetak(c.cetak); setEmboss(c.emboss)
      setMatProses(c.matProses); setFinishing(c.finishing); setAdditional(c.additional)
      setMargin(c.margin)
      setHasVendorComparison(c.hasVendorComparison || false); setVendorName(c.vendorName || ''); setVendorPricePerPcs(c.vendorPricePerPcs ?? '')
    } else {
      setMaterial([]); setCetak([]); setEmboss([]); setMatProses([]); setFinishing([]); setAdditional([])
      setMargin(15)
      setHasVendorComparison(false); setVendorName(''); setVendorPricePerPcs('')
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
  // Total SELALU dari 6 section (estimator wajib hitung manual). Harga vendor
  // adalah data PEMBANDING tambahan opsional, tidak pernah menggantikan total ini.
  const total   = Object.values(sub).reduce((a, b) => a + b, 0)
  const selling = total * (1 + num(margin) / 100)
  const perUnit = activeQty ? selling / activeQty : 0
  // Harga vendor per pcs × qty, murni untuk ditampilkan sebagai pembanding.
  const vendorTotal = activeQty ? num(vendorPricePerPcs) * activeQty : 0

  async function handleSave() {
    setSaving(true)
    // PENTING: hanya nonaktifkan quotation untuk qty yang SAMA dengan yang sedang disimpan,
    // supaya quotation qty lain yang sudah tersimpan sebelumnya tidak ikut hilang.
    await supabase.from('quotations').update({ is_active:false })
      .eq('request_id', requestId).eq('quantity', activeQty)

    const { error } = await supabase.from('quotations').insert({
      request_id: requestId, estimator_id: profile.id,
      customer_name: request.customer_name, product_type: request.product_type, quantity: activeQty,
      material_cost: matCalc, cetak_cost: cetakCalc, emboss_laminasi: embCalc,
      material_proses: mpCalc, finishing_wo: finCalc, additional_cost: addCalc,
      subtotal_material: sub.material, subtotal_cetak: sub.cetak, subtotal_emboss: sub.emboss,
      subtotal_matproses: sub.matProses, subtotal_finishing: sub.finishing, subtotal_additional: sub.additional,
      total_cost: total, margin_percent: num(margin),
      selling_price: Math.round(selling),
      price_per_unit: perUnit, deal_status: 'quoted',
      // Vendor: data PEMBANDING tambahan opsional, tidak pernah menggantikan
      // hasil hitung manual di atas. cost_source dipakai cuma sebagai penanda
      // "ada perbandingan vendor" untuk badge tampilan, bukan eksklusif lagi.
      cost_source: hasVendorComparison ? 'vendor' : 'internal',
      vendor_name: hasVendorComparison ? (vendorName || null) : null,
      vendor_price_per_pcs: hasVendorComparison ? (num(vendorPricePerPcs) || null) : null,
    })

    if (!error) {
      // Hapus draft (kalau ada) untuk qty ini karena sudah final tersimpan
      await supabase.from('quotations').delete()
        .eq('request_id', requestId).eq('quantity', activeQty)
        .eq('estimator_id', profile.id).eq('is_draft', true)

      qtyCache[activeQty] = { material, cetak, emboss, matProses, finishing, additional, margin, hasVendorComparison, vendorName, vendorPricePerPcs }
      const newSavedQtys = savedQtys.includes(activeQty) ? savedQtys : [...savedQtys, activeQty]
      setSavedQtys(newSavedQtys)

      const allDone = qtyList.every(q => newSavedQtys.includes(q))
      if (allDone) {
        await supabase.from('requests').update({ status:'done', completed_at: new Date().toISOString() }).eq('id', requestId)
        navigate('/')
      } else {
        const nextQty = qtyList.find(q => !newSavedQtys.includes(q))
        if (nextQty != null) switchQty(nextQty, newSavedQtys)
      }
    }
    setSaving(false)
  }

  if (loading) return <Layout title="Kalkulator"><div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>Memuat data...</div></Layout>
  if (!request) return <Layout title="Kalkulator"><div style={{ padding:60, color:'#dc2626' }}>Request tidak ditemukan.</div></Layout>

  return (
    <Layout title={`Kalkulator — ${request.request_number}`} beforeNavigate={handleBeforeNavigate}>
      {/* Tombol kembali */}
      <button
        onClick={async () => { await handleBeforeNavigate(); navigate('/') }}
        style={{
          display:'flex', alignItems:'center', gap:6, marginBottom:16,
          padding:'8px 14px', background:'#fff', border:`1px solid ${C.border}`,
          borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', color:C.brown,
        }}
      >
        ← Kembali ke Antrian
      </button>

      {/* Info header */}
      <div style={{ ...s.card, borderLeft:`4px solid ${C.orange}`, padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12 }}>
          {[['Customer',request.customer_name],['Produk',request.product_type],['Qty Diminta',qtyList.map(fmt).join(' / ')],
            ['Ukuran',request.product_size||'—'],['Luas Permukaan (m²)',request.plano_size||'—'],
            ['Material',request.material_spec||'—'],
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
          {(() => {
            const imgs = Array.isArray(request.reference_images) && request.reference_images.length > 0
              ? request.reference_images
              : (request.reference_image ? [request.reference_image] : [])
            if (imgs.length === 0) return null
            return (
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4, textAlign:'center' }}>🖼️ Gambar Referensi</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {imgs.map((url, i) => (
                    <img key={i} src={url} alt={`ref ${i+1}`}
                      style={{ height:120, width:120, borderRadius:8, border:`1px solid ${C.border}`, cursor:'pointer', objectFit:'cover' }}
                      onClick={() => window.open(url, '_blank')} />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Tab selector quantity — cuma muncul kalau request punya lebih dari 1 qty */}
      {qtyList.length > 1 && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {qtyList.map(q => {
            const isActive = q === activeQty
            const isSaved  = savedQtys.includes(q)
            return (
              <button
                key={q}
                onClick={() => switchQty(q)}
                style={{
                  padding:'10px 18px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer',
                  border: isActive ? `2px solid ${C.orange}` : `1px solid ${C.border}`,
                  background: isActive ? '#fff7ed' : '#fff',
                  color: isActive ? C.orange : C.dark,
                }}
              >
                {isSaved && <span style={{ color:'#16a34a', marginRight:6 }}>✓</span>}
                {fmt(q)} pcs
              </button>
            )
          })}
        </div>
      )}

      {/* Perbandingan Harga Vendor (opsional, TIDAK menggantikan hitung manual di bawah) */}
      <div style={s.card}>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom: hasVendorComparison ? 14 : 0 }}>
          <input
            type="checkbox"
            checked={hasVendorComparison}
            onChange={e => setHasVendorComparison(e.target.checked)}
            style={{ width:16, height:16, cursor:'pointer' }}
          />
          <span style={{ fontSize:14, fontWeight:600, color:C.dark }}>Ada Perbandingan Harga Vendor?</span>
        </label>
        <div style={{ fontSize:11, color:'#9ca3af', marginTop: hasVendorComparison ? 0 : 6, marginLeft: hasVendorComparison ? 0 : 26 }}>
          Perhitungan manual di bawah tetap wajib diisi. Vendor cuma data pembanding tambahan.
        </div>

        {hasVendorComparison && (
          <>
            <div style={{ marginTop:14, marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#9ca3af', display:'block', marginBottom:4 }}>Nama Vendor</label>
              <input
                list="vendor-name-suggestions"
                style={s.input}
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="cth. CV Mitra Cetak Jaya"
              />
              <datalist id="vendor-name-suggestions">
                {vendorNameSuggestions.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div style={{ background:C.cream, borderRadius:8, padding:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, alignItems:'end' }}>
              <div>
                <label style={{ fontSize:11, color:'#9ca3af', display:'block', marginBottom:4 }}>Harga per pcs (Rp)</label>
                <input
                  type="number"
                  style={{ ...s.input, textAlign:'right' }}
                  value={vendorPricePerPcs}
                  onChange={e => setVendorPricePerPcs(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Qty</div>
                <div style={{ padding:'9px 12px', background:'#f1efe8', borderRadius:7, fontSize:13, textAlign:'right', color:'#5f5e5a' }}>
                  {activeQty ? fmt(activeQty) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>Total Modal Vendor</div>
                <div style={{ padding:'9px 12px', background:C.border, borderRadius:7, fontSize:13, textAlign:'right', fontWeight:600, color:C.dark }}>
                  {idr(vendorTotal)}
                </div>
              </div>
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:10 }}>
              Murni sebagai pembanding — tidak mempengaruhi Total Modal & Harga Jual dari hitungan manual di bawah.
            </div>
          </>
        )}
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
            {hasVendorComparison && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.cream}`, fontSize:13, color:'#854F0B' }}>
                <span>Pembanding Vendor{vendorName ? ` (${vendorName})` : ''}</span><span style={{ fontFamily:'monospace' }}>{idr(vendorTotal)}</span>
              </div>
            )}
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
                Per unit: {idr(perUnit)} &nbsp;|&nbsp; Qty: {fmt(activeQty)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop:24, display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button onClick={() => navigate('/')} style={{ padding:'10px 20px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:'pointer', color:C.dark }}>
            Kembali
          </button>
          <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
            {saving ? 'Menyimpan...' : (() => {
              const remaining = qtyList.filter(q => q !== activeQty && !savedQtys.includes(q)).length
              if (qtyList.length <= 1) return '💾 Simpan & Selesai'
              return remaining > 0
                ? `💾 Simpan Qty ${fmt(activeQty)} & Lanjut`
                : `💾 Simpan Qty ${fmt(activeQty)} & Selesai Semua`
            })()}
          </button>
        </div>
      </div>
    </Layout>
  )
}



