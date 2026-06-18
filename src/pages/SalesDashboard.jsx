import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const PRODUCT_TYPES = {
  'Hardbox': ['Hardbox Two Pieces','Hardbox Slide','Hardbox Three Pieces','Hardbox Magnet','Hardbox Lainnya'],
  'Softbox': ['Tuckend','Sleeve','Softbox Lainnya'],
  'Corrugated': ['Corrugated Box','Corrugated Mailer','Corrugated Lainnya'],
  'Paper Bag': ['Paper Bag Handle','Paper Bag Twist','Paper Bag Lainnya'],
  'Lainnya': ['Lainnya'],
}

const FINISHING_OPTIONS = [
  'Poly Gold','Poly Silver','Poly Biasa',
  'Laminasi Glossy','Laminasi Doff',
  'Varnish UV','Waterbase',
  'Emboss','Deboss',
  'Pond','Lem Samping',
]

const STATUS_LABEL = { pending:'Menunggu', in_progress:'Dikerjakan', done:'Selesai', cancelled:'Dibatalkan' }
const STATUS_COLOR = { pending:'#E8760A', in_progress:'#2563eb', done:'#2d6a2d', cancelled:'#9ca3af' }

// Brand colors
const C = {
  dark:   '#2C1810',
  orange: '#E8760A',
  brown:  '#5C3D2E',
  cream:  '#FDF6EC',
  border: '#E8D5BC',
  white:  '#FFFFFF',
}

const s = {
  card:    { background: C.white, borderRadius:12, padding:24, boxShadow:'0 1px 6px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  label:   { display:'block', fontSize:13, fontWeight:500, color:C.brown, marginBottom:6, marginTop:16 },
  input:   { width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box', background:C.white, color:C.dark },
  select:  { width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, outline:'none', background:C.white, color:C.dark, boxSizing:'border-box' },
  textarea:{ width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', color:C.dark },
  btnPrimary: { padding:'10px 20px', background:C.orange, color:C.white, border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
  badge: (status) => ({
    display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500,
    background: STATUS_COLOR[status] + '20', color: STATUS_COLOR[status]
  }),
  th: { textAlign:'left', padding:'10px 12px', fontSize:12, color:C.brown, borderBottom:`2px solid ${C.border}`, fontWeight:500 },
  td: { padding:'12px', fontSize:13, color:C.dark, borderBottom:`1px solid ${C.cream}` },
  finishingChip: (selected) => ({
    padding:'6px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
    background: selected ? C.orange : C.cream,
    color: selected ? C.white : C.brown,
    border: `1px solid ${selected ? C.orange : C.border}`,
    userSelect:'none',
  }),
}

const emptyForm = {
  customer_name:'', product_category:'Hardbox', product_type:'Hardbox Two Pieces',
  quantity:'', priority:'normal', product_size:'',
  luas_permukaan:'', material_spec:'', print_spec:'',
  finishing:[], notes:'', image_url:'',
}

export default function SalesDashboard() {
  const { profile } = useAuth()
  const [form, setForm]           = useState(emptyForm)
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const fileRef = useRef()

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    const { data } = await supabase
      .from('requests')
      .select('*, quotations(deal_status, selling_price)')
      .order('submitted_at', { ascending: false })
    setRequests(data || [])
  }

  function toggleFinishing(item) {
    setForm(f => ({
      ...f,
      finishing: f.finishing.includes(item)
        ? f.finishing.filter(x => x !== item)
        : [...f.finishing, item]
    }))
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `requests/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('request - image').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('request - image').getPublicUrl(path)
      setForm(f => ({ ...f, image_url: publicUrl }))
      setPreviewUrl(publicUrl)
    } else {
      alert('Upload gagal. Pastikan Supabase Storage bucket "request-images" sudah dibuat.')
    }
    setUploading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('requests').insert({
      customer_name:  form.customer_name,
      product_type:   form.product_type,
      quantity:       parseInt(form.quantity),
      priority:       form.priority,
      product_size:   form.product_size,
      material_spec:  form.material_spec,
      print_spec:     form.print_spec,
      finishing_spec: form.finishing.join(', '),
      notes:          form.notes,
      reference_image: form.image_url,
      plano_size:     form.luas_permukaan,
      sales_id:       profile.id,
    })
    if (!error) {
      setSuccess(true)
      setForm(emptyForm)
      setPreviewUrl('')
      setShowForm(false)
      fetchRequests()
      setTimeout(() => setSuccess(false), 4000)
    }
    setLoading(false)
  }

  const pending  = requests.filter(r => r.status === 'pending').length
  const progress = requests.filter(r => r.status === 'in_progress').length
  const done     = requests.filter(r => r.status === 'done').length
  const subtypes = PRODUCT_TYPES[form.product_category] || []

  return (
    <Layout title="Request Harga">
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Menunggu',   value:pending,  color:C.orange },
          { label:'Dikerjakan', value:progress, color:'#2563eb' },
          { label:'Selesai',    value:done,     color:'#2d6a2d' },
        ].map(st => (
          <div key={st.label} style={{ background:C.white, borderRadius:12, padding:'20px 24px', boxShadow:'0 1px 4px rgba(44,24,16,0.08)', border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:28, fontWeight:700, color:st.color }}>{st.value}</div>
            <div style={{ fontSize:13, color:C.brown, marginTop:4 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {success && (
        <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'12px 16px', marginBottom:20, color:'#16a34a', fontSize:14 }}>
          ✅ Request berhasil dikirim! Estimator akan segera memproses.
        </div>
      )}

      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:16, fontWeight:600, color:C.dark }}>Request Harga Saya</div>
        <button style={s.btnPrimary} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Tutup Form' : '+ Request Harga Baru'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={s.card}>
          <div style={{ fontSize:16, fontWeight:600, color:C.dark, marginBottom:20, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
            Form Permintaan Harga
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label style={s.label}>Nama Customer *</label>
                <input style={s.input} value={form.customer_name}
                  onChange={e => setForm({...form, customer_name: e.target.value})} required />
              </div>
              <div>
                <label style={s.label}>Prioritas</label>
                <select style={s.select} value={form.priority}
                  onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="normal">Normal</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>

              {/* Jenis produk berjenjang */}
              <div>
                <label style={s.label}>Kategori Produk *</label>
                <select style={s.select} value={form.product_category}
                  onChange={e => {
                    const cat = e.target.value
                    setForm({...form, product_category: cat, product_type: PRODUCT_TYPES[cat][0]})
                  }}>
                  {Object.keys(PRODUCT_TYPES).map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Tipe Produk *</label>
                <select style={s.select} value={form.product_type}
                  onChange={e => setForm({...form, product_type: e.target.value})}>
                  {subtypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={s.label}>Quantity *</label>
                <input style={s.input} type="number" min="1" value={form.quantity}
                  onChange={e => setForm({...form, quantity: e.target.value})} required placeholder="contoh: 5000" />
              </div>
              <div>
                <label style={s.label}>Ukuran Produk (P×L×T)</label>
                <input style={s.input} value={form.product_size}
                  onChange={e => setForm({...form, product_size: e.target.value})} placeholder="contoh: 17×12×8 cm" />
              </div>
              <div>
                <label style={s.label}>Luas Permukaan (m²)</label>
                <input style={s.input} value={form.luas_permukaan}
                  onChange={e => setForm({...form, luas_permukaan: e.target.value})} placeholder="contoh: 0.065" />
              </div>
              <div>
                <label style={s.label}>Spesifikasi Material</label>
                <input style={s.input} value={form.material_spec}
                  onChange={e => setForm({...form, material_spec: e.target.value})} placeholder="contoh: Art Carton 260gsm" />
              </div>
              <div>
                <label style={s.label}>Spesifikasi Print</label>
                <input style={s.input} value={form.print_spec}
                  onChange={e => setForm({...form, print_spec: e.target.value})} placeholder="contoh: 4 warna CMYK" />
              </div>
            </div>

            {/* Finishing multi-choice */}
            <label style={s.label}>Finishing (bisa pilih lebih dari satu)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
              {FINISHING_OPTIONS.map(item => (
                <span key={item} style={s.finishingChip(form.finishing.includes(item))}
                  onClick={() => toggleFinishing(item)}>
                  {form.finishing.includes(item) ? '✓ ' : ''}{item}
                </span>
              ))}
            </div>
            {form.finishing.length > 0 && (
              <div style={{ marginTop:8, fontSize:12, color:C.brown }}>
                Dipilih: {form.finishing.join(' · ')}
              </div>
            )}

            {/* Upload gambar */}
            <label style={s.label}>Gambar Referensi / Artwork</label>
            <div style={{ border:`2px dashed ${C.border}`, borderRadius:8, padding:16, textAlign:'center', background:C.cream }}>
              {previewUrl ? (
                <div>
                  <img src={previewUrl} alt="preview"
                    style={{ maxHeight:200, maxWidth:'100%', borderRadius:8, marginBottom:8 }} />
                  <div>
                    <button type="button" onClick={() => { setPreviewUrl(''); setForm(f => ({...f, image_url:''})) }}
                      style={{ fontSize:12, color:'#dc2626', background:'none', border:'none', cursor:'pointer' }}>
                      Hapus gambar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:32, marginBottom:8 }}>🖼️</div>
                  <div style={{ fontSize:13, color:C.brown, marginBottom:12 }}>
                    Upload gambar referensi (JPG, PNG, PDF)
                  </div>
                  <button type="button"
                    onClick={() => fileRef.current.click()}
                    style={{ padding:'8px 16px', background:C.white, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, cursor:'pointer', color:C.dark }}>
                    {uploading ? 'Mengupload...' : 'Pilih File'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
                    onChange={handleImageUpload} />
                </div>
              )}
            </div>

            <label style={s.label}>Catatan Tambahan</label>
            <textarea style={s.textarea} rows={3} value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Informasi lain yang perlu diketahui estimator..." />

            <div style={{ marginTop:20 }}>
              <button style={s.btnPrimary} type="submit" disabled={loading || uploading}>
                {loading ? 'Mengirim...' : 'Kirim Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={s.card}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['No. Request','Customer','Produk','Qty','Status','Prioritas','Tanggal','Harga'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr><td colSpan={8} style={{ ...s.td, color:'#9ca3af', textAlign:'center', padding:32 }}>
                Belum ada request. Klik "+ Request Harga Baru" untuk mulai.
              </td></tr>
            )}
            {requests.map(r => (
              <tr key={r.id}>
                <td style={s.td}><span style={{ fontFamily:'monospace', fontSize:12, color:C.brown }}>{r.request_number}</span></td>
                <td style={s.td}><div style={{ fontWeight:500 }}>{r.customer_name}</div></td>
                <td style={s.td}>
                  <div style={{ fontSize:13 }}>{r.product_type}</div>
                  {r.reference_image && (
                    <a href={r.reference_image} target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:C.orange }}>🖼️ Lihat gambar</a>
                  )}
                </td>
                <td style={s.td}>{r.quantity?.toLocaleString('id-ID')}</td>
                <td style={s.td}><span style={s.badge(r.status)}>{STATUS_LABEL[r.status]}</span></td>
                <td style={s.td}>
                  {r.priority === 'urgent'
                    ? <span style={{ color:'#dc2626', fontSize:12, fontWeight:500 }}>🔴 Urgent</span>
                    : <span style={{ color:'#9ca3af', fontSize:12 }}>Normal</span>}
                </td>
                <td style={s.td}>{new Date(r.submitted_at).toLocaleDateString('id-ID')}</td>
                <td style={s.td}>
                  {r.quotations?.[0]?.selling_price
                    ? <span style={{ fontWeight:600, color:'#2d6a2d' }}>
                        Rp {r.quotations[0].selling_price.toLocaleString('id-ID')}
                      </span>
                    : <span style={{ color:'#9ca3af' }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
