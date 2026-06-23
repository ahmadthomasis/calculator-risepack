import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const PRODUCT_TYPES = {
  'Hardbox': [
    '2 Piece Box',
    '3 Piece Box',
    'Sleeve/Slip Box',
    'Foldable Box',
    'Flip Box/Magnet',
    'Double Flip Box (tengah)',
    'Neck Box (seperti box perhiasan)',
  ],
  'Corrugated': [
    'B1',
    'Dus Sepatu',
    'Seal-end',
    'Mailer Box',
  ],
  'Softbox': [
    'Manual-lockbottom',
    'Auto-lockbottom',
    'Gable Box',
    'Tuck-end',
    'Box Sambung',
    'Food-pail',
    'Food-tray',
    'Box Popcorn',
    'Seal-end (tidak ada clip)',
    'Mailer Box',
    'Amplop',
    'Pillow Box',
    'Paperbag',
    'Papercup',
    'Paperbowl',
    'Lunchbox Sekat',
    'Lunchbox Forming',
    'Slide Box',
    '2 Pcs',
  ],
}

const FINISHING_OPTIONS = [
  'Poly Gold','Poly Silver','Poly Biasa',
  'Laminasi Glossy','Laminasi Doff',
  'Varnish UV','Waterbase','Spot UV',
  'Emboss','Deboss',
  'Pond','Lem Samping',
]

const STATUS_LABEL = { pending:'Menunggu', in_progress:'Dikerjakan', done:'Selesai', cancelled:'Dibatalkan' }
const STATUS_COLOR = { pending:'#E8760A', in_progress:'#2563eb', done:'#2d6a2d', cancelled:'#9ca3af' }

const DEAL_LABEL = { quoted:'Belum Diisi', deal:'Deal ✅', no_deal:'No Deal ❌', followup:'Followup 🔄' }
const DEAL_COLOR = { quoted:'#9ca3af', deal:'#16a34a', no_deal:'#dc2626', followup:'#d97706' }

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

const MAX_IMAGES = 3

const MAX_QTYS = 5

const emptyForm = {
  customer_name:'', product_category:'Hardbox', product_type:'2 Piece Box',
  quantities:[''], priority:'normal', product_size:'',
  luas_permukaan:'', material_spec:'', print_spec:'',
  finishing:[], notes:'', image_urls:[],
}

export default function SalesDashboard() {
  const { profile } = useAuth()
  const [form, setForm]           = useState(emptyForm)
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingStatus, setEditingStatus] = useState(null)
  const fileRef = useRef()

  useEffect(() => { fetchRequests() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('sales-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
        fetchRequests()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchRequests() {
    const { data } = await supabase
      .from('requests')
      .select('*, quotations(id, quantity, deal_status, selling_price, price_per_unit, updated_at, is_draft, is_active, purchasing_status, purchasing_notes, cost_source, vendor_name)')
      .order('submitted_at', { ascending: false })
    setRequests(data || [])
  }

  async function updateDealStatus(quotationId, newStatus) {
    await supabase.from('quotations').update({ deal_status: newStatus, updated_at: new Date().toISOString() }).eq('id', quotationId)
    fetchRequests()
  }

  function toggleFinishing(item) {
    setForm(f => ({
      ...f,
      finishing: f.finishing.includes(item)
        ? f.finishing.filter(x => x !== item)
        : [...f.finishing, item]
    }))
  }

  function startEdit(r) {
    const images = Array.isArray(r.reference_images) && r.reference_images.length > 0
      ? r.reference_images
      : (r.reference_image ? [r.reference_image] : [])
    setForm({
      customer_name: r.customer_name || '',
      product_category: Object.keys(PRODUCT_TYPES).find(k => PRODUCT_TYPES[k].includes(r.product_type)) || 'Hardbox',
      product_type: r.product_type || '',
      quantities: Array.isArray(r.quantities) && r.quantities.length > 0
        ? r.quantities.map(String)
        : (r.quantity ? [String(r.quantity)] : ['']),
      priority: r.priority || 'normal',
      product_size: r.product_size || '',
      luas_permukaan: r.plano_size || '',
      material_spec: r.material_spec || '',
      print_spec: r.print_spec || '',
      finishing: r.finishing_spec ? r.finishing_spec.split(', ').filter(Boolean) : [],
      notes: r.notes || '',
      image_urls: images,
    })
    setEditingId(r.id)
    setEditingStatus(r.status)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingStatus(null)
    setForm(emptyForm)
    setShowForm(false)
  }

  async function uploadFile(file) {
    if (!file) return
    if (form.image_urls.length >= MAX_IMAGES) {
      alert(`Maksimal ${MAX_IMAGES} gambar per request.`)
      return
    }
    setUploading(true)
    const ext  = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'png'
    const path = `requests/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('request - image').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('request - image').getPublicUrl(path)
      setForm(f => ({ ...f, image_urls: [...f.image_urls, publicUrl] }))
    } else {
      alert('Upload gagal. Pastikan Supabase Storage bucket "request-images" sudah dibuat.')
    }
    setUploading(false)
  }

  function removeImage(index) {
    setForm(f => ({ ...f, image_urls: f.image_urls.filter((_, i) => i !== index) }))
  }

  async function handleImageUpload(e) {
    await uploadFile(e.target.files[0])
    e.target.value = '' // reset supaya bisa pilih file sama lagi kalau perlu
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) uploadFile(file)
        break
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const qtyNumbers = form.quantities.map(q => parseInt(q)).filter(q => !isNaN(q) && q > 0)
    if (qtyNumbers.length === 0) {
      alert('Isi minimal 1 quantity yang valid.')
      setLoading(false)
      return
    }
    const payload = {
      customer_name:  form.customer_name,
      product_type:   form.product_type,
      quantities:     qtyNumbers,
      quantity:       qtyNumbers[0],
      priority:       form.priority,
      product_size:   form.product_size,
      material_spec:  form.material_spec,
      print_spec:     form.print_spec,
      finishing_spec: form.finishing.join(', '),
      notes:          form.notes,
      reference_images: form.image_urls,
      reference_image: form.image_urls[0] || '',
      plano_size:     form.luas_permukaan,
      updated_at:     new Date().toISOString(),
      // spec_updated_at hanya diisi saat EDIT (bukan insert baru),
      // supaya estimator tahu ada revisi spesifikasi dari sales/manager.
      // Untuk insert baru, kolom ini dibiarkan null (belum ada revisi).
      ...(editingId ? { spec_updated_at: new Date().toISOString() } : {}),
    }

    const { data: updData, error } = editingId
      ? await supabase.from('requests').update(payload).eq('id', editingId).select()
      : { data: null, error: null }

    if (!editingId) {
      const { error: insertErr } = await supabase.from('requests').insert({ ...payload, sales_id: profile.id })
      if (!insertErr) {
        setSuccess(true)
        setForm(emptyForm)
        setShowForm(false)
        setEditingId(null)
        setEditingStatus(null)
        fetchRequests()
        setTimeout(() => setSuccess(false), 4000)
      } else {
        alert('Gagal kirim request: ' + insertErr.message)
      }
      setLoading(false)
      return
    }

    if (error) {
      alert('Gagal simpan perubahan: ' + error.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
    setEditingStatus(null)
    fetchRequests()
    setTimeout(() => setSuccess(false), 4000)
    setLoading(false)
  }

  const pending  = requests.filter(r => r.status === 'pending').length
  const progress = requests.filter(r => r.status === 'in_progress').length
  const done     = requests.filter(r => r.status === 'done').length
  const subtypes = PRODUCT_TYPES[form.product_category] || []
  const filteredRequests = requests.filter(r =>
    !searchTerm.trim() || (r.customer_name || '').toLowerCase().includes(searchTerm.trim().toLowerCase())
  )

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

      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div style={{ fontSize:16, fontWeight:600, color:C.dark }}>Request Harga Saya</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input
            type="text"
            placeholder="Cari nama customer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, width:200, outline:'none', color:C.dark }}
          />
          <button style={s.btnPrimary} onClick={() => showForm ? cancelEdit() : setShowForm(true)}>
            {showForm ? 'Tutup Form' : '+ Request Harga Baru'}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={s.card}>
          <div style={{ fontSize:16, fontWeight:600, color:C.dark, marginBottom:20, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
            {editingId ? 'Edit Request Harga' : 'Form Permintaan Harga'}
          </div>

          {editingId && (editingStatus === 'in_progress' || editingStatus === 'done') && (
            <div style={{
              background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'12px 16px',
              marginBottom:20, color:'#92400e', fontSize:13, lineHeight:1.5,
            }}>
              ⚠️ Request ini berstatus <b>{STATUS_LABEL[editingStatus]}</b> — estimator
              {editingStatus === 'done' ? ' sudah menyelesaikan' : ' sedang mengerjakan'} perhitungan harga
              berdasarkan data yang ada sekarang. Mengubah data di sini <b>tidak otomatis memperbarui harga</b> yang
              sudah dihitung. Informasikan ke estimator setelah menyimpan perubahan ini.
            </div>
          )}

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

              <div style={{ gridColumn:'1 / -1' }}>
                <label style={s.label}>Quantity * (bisa lebih dari satu, contoh: 5.000 / 10.000 / 20.000 pcs)</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {form.quantities.map((q, i) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input
                        style={{ ...s.input, maxWidth:200 }}
                        type="number" min="1" value={q}
                        onChange={e => {
                          const next = [...form.quantities]
                          next[i] = e.target.value
                          setForm({...form, quantities: next})
                        }}
                        required={i === 0}
                        placeholder="contoh: 5000"
                      />
                      {form.quantities.length > 1 && (
                        <button type="button"
                          onClick={() => setForm({...form, quantities: form.quantities.filter((_, idx) => idx !== i)})}
                          style={{ padding:'6px 10px', background:'#fff', border:'1px solid #fecaca', borderRadius:6, fontSize:12, cursor:'pointer', color:'#dc2626' }}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {form.quantities.length < MAX_QTYS && (
                    <button type="button"
                      onClick={() => setForm({...form, quantities: [...form.quantities, '']})}
                      style={{ alignSelf:'flex-start', padding:'6px 14px', background:'#fff7ed', color:C.orange, border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:500 }}>
                      + Tambah Quantity Lain
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={s.label}>Ukuran Produk (P×L×T)</label>
                <textarea style={s.textarea} value={form.product_size}
                  onChange={e => setForm({...form, product_size: e.target.value})} placeholder="contoh: 17×12×8 cm" rows={2} />
              </div>
              <div>
                <label style={s.label}>Luas Permukaan (m²)</label>
                <textarea style={s.textarea} value={form.luas_permukaan}
                  onChange={e => setForm({...form, luas_permukaan: e.target.value})} placeholder="contoh: 0.065" rows={2} />
              </div>
              <div>
                <label style={s.label}>Spesifikasi Material</label>
                <textarea style={s.textarea} value={form.material_spec}
                  onChange={e => setForm({...form, material_spec: e.target.value})} placeholder="contoh: Art Carton 260gsm" rows={2} />
              </div>
              <div>
                <label style={s.label}>Spesifikasi Print</label>
                <textarea style={s.textarea} value={form.print_spec}
                  onChange={e => setForm({...form, print_spec: e.target.value})} placeholder="contoh: 4 warna CMYK" rows={2} />
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

            {/* Upload gambar — galeri maks 3 */}
            <label style={s.label}>Gambar Referensi / Artwork ({form.image_urls.length}/{MAX_IMAGES})</label>

            {form.image_urls.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10, marginBottom:10 }}>
                {form.image_urls.map((url, i) => (
                  <div key={i} style={{ position:'relative', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', background:C.cream }}>
                    <img src={url} alt={`referensi ${i+1}`} style={{ width:'100%', height:120, objectFit:'cover', display:'block' }} />
                    <button type="button" onClick={() => removeImage(i)}
                      style={{
                        position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%',
                        background:'rgba(220,38,38,0.9)', color:'#fff', border:'none', cursor:'pointer',
                        fontSize:12, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center',
                      }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {form.image_urls.length < MAX_IMAGES ? (
              <div
                onPaste={handlePaste}
                tabIndex={0}
                style={{
                  border:`2px dashed ${C.border}`, borderRadius:8, padding:16, textAlign:'center',
                  background:C.cream, outline:'none', cursor:'text',
                }}
                onFocus={e => e.currentTarget.style.borderColor = C.orange}
                onBlur={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontSize:32, marginBottom:8 }}>🖼️</div>
                <div style={{ fontSize:13, color:C.brown, marginBottom:4 }}>
                  {uploading ? 'Mengupload...' : `Tambah gambar (boleh ${MAX_IMAGES - form.image_urls.length} lagi)`}
                </div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:12 }}>
                  Klik area ini lalu tekan Cmd+V (Mac) / Ctrl+V untuk paste gambar dari clipboard
                </div>
                <button type="button"
                  onClick={() => fileRef.current.click()}
                  disabled={uploading}
                  style={{ padding:'8px 16px', background:C.white, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, cursor:'pointer', color:C.dark }}>
                  {uploading ? 'Mengupload...' : 'Pilih File'}
                </button>
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
                  onChange={handleImageUpload} />
              </div>
            ) : (
              <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>
                Sudah mencapai batas {MAX_IMAGES} gambar. Hapus salah satu untuk menambah yang baru.
              </div>
            )}

            <label style={s.label}>Catatan Tambahan</label>
            <textarea style={s.textarea} rows={3} value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Informasi lain yang perlu diketahui estimator..." />

            <div style={{ marginTop:20, display:'flex', gap:10 }}>
              <button style={s.btnPrimary} type="submit" disabled={loading || uploading}>
                {loading ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Kirim Request'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit}
                  style={{ padding:'10px 20px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:'pointer', color:C.dark }}>
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={s.card}>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
          <div style={{ fontSize:12, color:'#9ca3af' }}>{filteredRequests.length} total — scroll untuk lihat semua</div>
        </div>
        <div style={{ maxHeight:560, overflowY:'auto', border:`1px solid ${C.border}`, borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['No. Request','Customer','Produk','Qty','Status','Prioritas','Tanggal','Harga','Status Deal','Sumber','Purchasing','Aksi'].map(h => (
                <th key={h} style={{ ...s.th, position:'sticky', top:0, background:'#fff', zIndex:1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 && (
              <tr><td colSpan={12} style={{ ...s.td, color:'#9ca3af', textAlign:'center', padding:32 }}>
                {requests.length === 0 ? 'Belum ada request. Klik "+ Request Harga Baru" untuk mulai.' : 'Tidak ada customer yang cocok dengan pencarian.'}
              </td></tr>
            )}
            {filteredRequests.map(r => {
              const qtys = Array.isArray(r.quantities) && r.quantities.length > 0
                ? r.quantities
                : (r.quantity ? [r.quantity] : [])
              const quotationsList = (Array.isArray(r.quotations) ? r.quotations : []).filter(q => !q.is_draft && q.is_active)
              // cocokkan tiap qty dengan quotation yang quantity-nya sama persis
              const rows = qtys.map(qty => ({
                qty,
                q: quotationsList.find(qt => qt.quantity === qty) || null,
              }))
              return (
                <tr key={r.id}>
                  <td style={s.td}><span style={{ fontFamily:'monospace', fontSize:12, color:C.brown }}>{r.request_number}</span></td>
                  <td style={s.td}><div style={{ fontWeight:500 }}>{r.customer_name}</div></td>
                  <td style={s.td}>
                    <div style={{ fontSize:13 }}>{r.product_type}</div>
                    {(() => {
                      const imgs = Array.isArray(r.reference_images) && r.reference_images.length > 0
                        ? r.reference_images
                        : (r.reference_image ? [r.reference_image] : [])
                      if (imgs.length === 0) return null
                      return (
                        <a href={imgs[0]} target="_blank" rel="noreferrer"
                          style={{ fontSize:11, color:C.orange }}>
                          🖼️ Lihat gambar{imgs.length > 1 ? ` (${imgs.length})` : ''}
                        </a>
                      )
                    })()}
                  </td>
                  <td style={s.td}>
                    {qtys.map(q => q.toLocaleString('id-ID')).join(' / ')}
                  </td>
                  <td style={s.td}><span style={s.badge(r.status)}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={s.td}>
                    {r.priority === 'urgent'
                      ? <span style={{ color:'#dc2626', fontSize:12, fontWeight:500 }}>🔴 Urgent</span>
                      : <span style={{ color:'#9ca3af', fontSize:12 }}>Normal</span>}
                  </td>
                  <td style={s.td}>{new Date(r.submitted_at).toLocaleDateString('id-ID')}</td>
                  <td style={s.td}>
                    {rows.some(row => row.q?.selling_price) ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {rows.map((row, i) => row.q?.selling_price ? (
                          <div key={i}>
                            {rows.length > 1 && (
                              <span style={{ fontSize:10, color:'#9ca3af', marginRight:4 }}>
                                {row.qty.toLocaleString('id-ID')}:
                              </span>
                            )}
                            <span style={{ fontWeight:600, color:'#2d6a2d' }}>Rp {row.q.selling_price.toLocaleString('id-ID')}</span>
                            {row.q.price_per_unit && (
                              <span style={{ fontSize:11, color:'#9ca3af', marginLeft:4 }}>
                                (Rp {Math.round(row.q.price_per_unit).toLocaleString('id-ID')}/pcs)
                              </span>
                            )}
                          </div>
                        ) : rows.length > 1 ? (
                          <div key={i} style={{ fontSize:11, color:'#d1d5db' }}>
                            {row.qty.toLocaleString('id-ID')}: belum dihitung
                          </div>
                        ) : null)}
                      </div>
                    ) : <span style={{ color:'#9ca3af' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {r.status === 'done' && rows.some(row => row.q) ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {rows.map((row, i) => row.q ? (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                            {rows.length > 1 && (
                              <span style={{ fontSize:10, color:'#9ca3af' }}>
                                {row.qty.toLocaleString('id-ID')}:
                              </span>
                            )}
                            <select
                              value={row.q.deal_status || 'quoted'}
                              onChange={e => updateDealStatus(row.q.id, e.target.value)}
                              style={{
                                padding:'5px 8px', borderRadius:6, fontSize:12, border:`1px solid ${C.border}`,
                                background:'#fff', color: DEAL_COLOR[row.q.deal_status] || '#9ca3af', fontWeight:500,
                              }}
                            >
                              <option value="quoted">Belum Diisi</option>
                              <option value="deal">Deal ✅</option>
                              <option value="no_deal">No Deal ❌</option>
                              <option value="followup">Followup 🔄</option>
                            </select>
                          </div>
                        ) : null)}
                      </div>
                    ) : <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {rows.some(row => row.q) ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {rows.map((row, i) => row.q ? (
                          <div key={i}>
                            {rows.length > 1 && (
                              <span style={{ fontSize:10, color:'#9ca3af', marginRight:4 }}>
                                {row.qty.toLocaleString('id-ID')}:
                              </span>
                            )}
                            {row.q.cost_source === 'vendor' ? (
                              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#FAEEDA', color:'#633806' }} title={row.q.vendor_name || ''}>
                                Vendor{row.q.vendor_name ? `: ${row.q.vendor_name}` : ''}
                              </span>
                            ) : (
                              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#f1efe8', color:'#5f5e5a' }}>Internal</span>
                            )}
                          </div>
                        ) : null)}
                      </div>
                    ) : <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {rows.some(row => row.q?.purchasing_status) ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {rows.map((row, i) => row.q?.purchasing_status ? (
                          <div key={i}>
                            {rows.length > 1 && (
                              <span style={{ fontSize:10, color:'#9ca3af', marginRight:4 }}>
                                {row.qty.toLocaleString('id-ID')}:
                              </span>
                            )}
                            <span style={{
                              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                              background: { pending:'#d9770618', approved:'#16a34a18', hold:'#d9770618', cancelled:'#dc262618' }[row.q.purchasing_status],
                              color: { pending:'#d97706', approved:'#16a34a', hold:'#d97706', cancelled:'#dc2626' }[row.q.purchasing_status],
                            }} title={row.q.purchasing_notes || ''}>
                              {{ pending:'Menunggu', approved:'Disetujui', hold:'Hold', cancelled:'Cancelled' }[row.q.purchasing_status]}
                            </span>
                          </div>
                        ) : null)}
                      </div>
                    ) : <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <button onClick={() => startEdit(r)}
                      style={{ padding:'5px 12px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', color:C.brown, fontWeight:500 }}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </Layout>
  )
}





