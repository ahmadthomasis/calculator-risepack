import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const idr = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')
const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
}
const fmtQty = n => (n || 0).toLocaleString('id-ID')

const CATEGORY_BADGE = {
  Hardbox:    { bg:'#FDF6EC', color:'#5C3D2E' },
  Softbox:    { bg:'#EDF4FF', color:'#1251A3' },
  Corrugated: { bg:'#F0FDF4', color:'#166534' },
}

const PRODUCT_TYPES = {
  'Hardbox': ['2 Piece Box','3 Piece Box','Sleeve/Slip Box','Foldable Box','Flip Box/Magnet','Double Flip Box (tengah)','Neck Box (seperti box perhiasan)'],
  'Corrugated': ['B1','Dus Sepatu','Seal-end','Mailer Box'],
  'Softbox': ['Manual-lockbottom','Auto-lockbottom','Gable Box','Tuck-end','Box Sambung','Food-pail','Food-tray','Box Popcorn','Seal-end (tidak ada clip)','Mailer Box','Amplop','Pillow Box','Paperbag','Papercup','Paperbowl','Lunchbox Sekat','Lunchbox Forming','Slide Box','2 Pcs'],
}

const s = {
  input:  { height:36, padding:'0 10px', fontSize:13, borderRadius:8, border:`0.5px solid #d1d5db`, background:'#fff', color:'#111', outline:'none', boxSizing:'border-box' },
  select: { height:36, padding:'0 10px', fontSize:13, borderRadius:8, border:`0.5px solid #d1d5db`, background:'#fff', color:'#111', outline:'none', boxSizing:'border-box' },
}

function ImageViewer({ images, onClose }) {
  const [idx, setIdx] = useState(0)
  if (!images || images.length === 0) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
        <img src={images[idx]} alt="referensi" style={{ maxWidth:'80vw', maxHeight:'80vh', objectFit:'contain', borderRadius:8 }} />
        {images.length > 1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:10 }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                style={{ width:8, height:8, borderRadius:'50%', background: i===idx ? '#fff' : 'rgba(255,255,255,0.4)', border:'none', cursor:'pointer', padding:0 }} />
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ position:'absolute', top:-12, right:-12, background:'#fff', border:'none', borderRadius:'50%', width:28, height:28, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'#111' }}>×</button>
      </div>
    </div>
  )
}

function DetailModal({ item, onClose }) {
  const [imgOpen, setImgOpen] = useState(false)
  if (!item) return null

  const images = item.reference_images?.length ? item.reference_images : (item.reference_image ? [item.reference_image] : [])
  const catStyle = CATEGORY_BADGE[item.category] || { bg:'#f3f4f6', color:'#6b7280' }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, border:`0.5px solid ${C.border}`, width:'100%', maxWidth:560, margin:'auto', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'14px 16px', borderBottom:`0.5px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:500, color:C.dark }}>{item.product_type}</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{item.customer_name}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ background:catStyle.bg, color:catStyle.color, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:500 }}>{item.category}</span>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#9ca3af', lineHeight:1, padding:0 }}>×</button>
          </div>
        </div>

        {/* Gambar */}
        {images.length > 0 ? (
          <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setImgOpen(true)}>
            <img src={images[0]} alt="referensi" style={{ width:'100%', height:200, objectFit:'cover', display:'block' }} />
            {images.length > 1 && (
              <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:11, padding:'3px 8px', borderRadius:20 }}>
                +{images.length - 1} foto
              </div>
            )}
            <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:11, padding:'3px 8px', borderRadius:20 }}>
              Klik untuk perbesar
            </div>
          </div>
        ) : (
          <div style={{ height:140, background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', color:'#d1d5db', fontSize:13 }}>
            Tidak ada gambar referensi
          </div>
        )}

        <div style={{ padding:16 }}>
          {/* Grid info */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            {[
              ['Ukuran (P×L×T)', item.product_size || '—'],
              ['Quantity', item.quantity ? fmtQty(item.quantity) + ' pcs' : '—'],
              ['Material', item.material_spec || '—'],
              ['Print', item.print_spec || '—'],
              ['Finishing', item.finishing_spec || '—'],
              ['Luas Permukaan', item.plano_size || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:13, fontWeight:500, color:C.dark, lineHeight:1.4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Harga */}
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <div style={{ flex:1, background:C.cream, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.brown, marginBottom:4 }}>Total Harga Jual</div>
              <div style={{ fontSize:16, fontWeight:500, color:C.orange }}>{idr(item.selling_price)}</div>
            </div>
            <div style={{ flex:1, background:C.cream, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.brown, marginBottom:4 }}>Harga per pcs</div>
              <div style={{ fontSize:16, fontWeight:500, color:C.orange }}>{idr(item.price_per_unit)}</div>
            </div>
          </div>

          <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#6b7280', lineHeight:1.5 }}>
            ⓘ Harga ini adalah referensi dari quotation <strong style={{ color:C.dark }}>{item.customer_name}</strong>. Harga aktual bisa berbeda tergantung spesifikasi, qty, dan kondisi pasar saat ini.
          </div>
        </div>
      </div>

      {imgOpen && <ImageViewer images={images} onClose={() => setImgOpen(false)} />}
    </div>
  )
}

export default function DirectoryHarga() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [qtyFilter, setQtyFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    // Ambil quotation yang deal + request yang sudah done, join ke requests untuk spesifikasi
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        id, quantity, selling_price, price_per_unit, deal_status, updated_at,
        requests (
          id, customer_name, product_type, product_size, plano_size,
          material_spec, print_spec, finishing_spec,
          reference_image, reference_images, status
        )
      `)
      .eq('deal_status', 'deal')
      .eq('is_active', true)
      .eq('is_draft', false)
      .not('selling_price', 'is', null)
      .order('updated_at', { ascending: false })

    if (!error && data) {
      // Flatten dan tambahkan category
      const flat = data
        .filter(q => q.requests)
        .map(q => {
          const r = q.requests
          const category = Object.keys(PRODUCT_TYPES).find(k =>
            PRODUCT_TYPES[k].includes(r.product_type)
          ) || 'Lainnya'
          return {
            id: q.id,
            customer_name: r.customer_name,
            product_type: r.product_type,
            category,
            product_size: r.product_size,
            plano_size: r.plano_size,
            material_spec: r.material_spec,
            print_spec: r.print_spec,
            finishing_spec: r.finishing_spec,
            reference_image: r.reference_image,
            reference_images: r.reference_images,
            quantity: q.quantity,
            selling_price: q.selling_price,
            price_per_unit: q.price_per_unit,
            updated_at: q.updated_at,
          }
        })
      setItems(flat)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Daftar tipe unik berdasarkan category yang dipilih
  const typeOptions = useMemo(() => {
    if (catFilter && PRODUCT_TYPES[catFilter]) return PRODUCT_TYPES[catFilter]
    return [...new Set(items.map(i => i.product_type).filter(Boolean))].sort()
  }, [catFilter, items])

  const filtered = useMemo(() => {
    return items.filter(d => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!d.customer_name?.toLowerCase().includes(q) &&
            !d.product_type?.toLowerCase().includes(q) &&
            !d.product_size?.toLowerCase().includes(q) &&
            !d.material_spec?.toLowerCase().includes(q)) return false
      }
      if (catFilter && d.category !== catFilter) return false
      if (typeFilter && d.product_type !== typeFilter) return false
      if (qtyFilter) {
        const qty = d.quantity || 0
        if (qtyFilter === 'small' && qty >= 1000) return false
        if (qtyFilter === 'mid' && (qty < 1000 || qty > 5000)) return false
        if (qtyFilter === 'large' && qty <= 5000) return false
      }
      if (priceFilter) {
        const ppu = d.price_per_unit || 0
        if (priceFilter === 'cheap' && ppu >= 2000) return false
        if (priceFilter === 'mid' && (ppu < 2000 || ppu > 10000)) return false
        if (priceFilter === 'exp' && ppu <= 10000) return false
      }
      return true
    })
  }, [items, search, catFilter, typeFilter, qtyFilter, priceFilter])

  const catStyle = cat => CATEGORY_BADGE[cat] || { bg:'#f3f4f6', color:'#6b7280' }

  return (
    <Layout title="Direktori Harga">
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:4 }}>Direktori Harga</h2>
          <p style={{ fontSize:13, color:'#9ca3af' }}>Referensi harga dari quotation yang sudah deal. Klik kartu untuk lihat detail spesifikasi dan gambar.</p>
        </div>

        {/* Filter bar */}
        <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <input style={{ ...s.input, flex:1, minWidth:180 }}
            placeholder="Cari customer, produk, ukuran, material..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select style={s.select} value={catFilter} onChange={e => { setCatFilter(e.target.value); setTypeFilter('') }}>
            <option value="">Semua Kategori</option>
            {Object.keys(PRODUCT_TYPES).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select style={s.select} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Semua Tipe</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={s.select} value={qtyFilter} onChange={e => setQtyFilter(e.target.value)}>
            <option value="">Semua Qty</option>
            <option value="small">{'< 1.000'}</option>
            <option value="mid">1.000 – 5.000</option>
            <option value="large">{'> 5.000'}</option>
          </select>
          <select style={s.select} value={priceFilter} onChange={e => setPriceFilter(e.target.value)}>
            <option value="">Semua Harga/pcs</option>
            <option value="cheap">{'< Rp 2.000'}</option>
            <option value="mid">Rp 2.000 – 10.000</option>
            <option value="exp">{'> Rp 10.000'}</option>
          </select>
        </div>

        <div style={{ fontSize:12, color:'#9ca3af', marginBottom:16 }}>
          {loading ? 'Memuat...' : `Menampilkan ${filtered.length} dari ${items.length} referensi harga`}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
            <div>Tidak ada hasil yang cocok</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
            {filtered.map(item => {
              const images = item.reference_images?.length ? item.reference_images : (item.reference_image ? [item.reference_image] : [])
              const cs = catStyle(item.category)
              return (
                <div key={item.id} onClick={() => setSelected(item)}
                  style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#d97706'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  {/* Gambar */}
                  <div style={{ width:'100%', height:140, background:'#f9fafb', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {images.length > 0 ? (
                      <img src={images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : (
                      <span style={{ fontSize:36, opacity:0.15 }}>📦</span>
                    )}
                    <span style={{ position:'absolute', top:8, left:8, background:'rgba(255,255,255,0.92)', border:`0.5px solid ${C.border}`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:500, color:C.brown }}>
                      {item.product_size || '—'}
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{ padding:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:C.dark, flex:1, marginRight:8 }}>{item.product_type}</div>
                      <span style={{ background:cs.bg, color:cs.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, whiteSpace:'nowrap' }}>{item.category}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>👤 {item.customer_name} · Qty {fmtQty(item.quantity)}</div>
                    {item.finishing_spec && (
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:8, lineHeight:1.4 }}>{item.finishing_spec}</div>
                    )}
                    <div style={{ borderTop:`0.5px solid ${C.cream}`, paddingTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>Harga/pcs</span>
                      <span style={{ fontSize:14, fontWeight:500, color:C.orange }}>{idr(item.price_per_unit)}</span>
                    </div>
                    <div style={{ marginTop:6, fontSize:11, color:'#9ca3af' }}>
                      📅 {fmtDate(item.updated_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </Layout>
  )
}
