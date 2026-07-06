import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import Layout from '../../components/Layout'
import {
  FORM_TYPE_LABEL, JENIS_KEMASAN_OPTIONS, URGENSI_OPTIONS, STATUS_JASA_LABEL,
  PRODEV_BUCKET, DESIGN_FILE_ACCEPT, fileNameFromUrl,
} from '../../lib/prodev'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:    { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 6px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  sTitle:  { fontSize:15, fontWeight:700, color:C.dark, marginBottom:4 },
  sSub:    { fontSize:12, color:'#9ca3af', marginBottom:16 },
  label:   { display:'block', fontSize:13, fontWeight:500, color:C.brown, marginBottom:6 },
  input:   { width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box', background:'#fff', color:C.dark },
  select:  { width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, outline:'none', background:'#fff', color:C.dark, boxSizing:'border-box' },
  textarea:{ width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', color:C.dark },
  grid2:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  grid3:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 },
  chip: (selected) => ({
    padding:'7px 14px', borderRadius:20, fontSize:13, cursor:'pointer', fontWeight:500,
    background: selected ? C.orange : C.cream,
    color: selected ? '#fff' : C.brown,
    border: `1px solid ${selected ? C.orange : C.border}`,
    userSelect:'none',
  }),
  addBtn:  { padding:'6px 14px', background:'#fff7ed', color:C.orange, border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:500 },
  delBtn:  { padding:'6px 10px', background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, fontSize:12, cursor:'pointer' },
}

const MAX_IMAGES = 5

const emptyForm = {
  kode_order:'', customer_name:'', nama_customer:'', contact:'', brand_name:'',
  tanggal_pengajuan:'', deadline:'', pic_sales:'',
  jenis_kemasan:'Softbox', model_layout:'', template_url:'', status_jasa:'non_jasa_desain',
  urgensi:'Dikirim', jumlah_part:'1', jumlah_kebutuhan:'', potensial_omzet:'',
  dimensi_produk:'', lp_layout:[''], dimensi_kemasan:[''],
  bahan_kemasan:'', berat_produk:'', finishing:[''],
  jenis_sambungan:'', finishing_lainnya:'',
  lampiran_text:'', lampiran_link:'', lampiran_images:[], design_files:[],
  layouter_id:'',
}

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function ProdevForm() {
  // Mode create: /prodev/new/:formType  — mode edit: /prodev/edit/:id
  const { formType: formTypeParam, id: editId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const fileRef     = useRef()
  const designRef   = useRef()

  const [formType, setFormType]   = useState(formTypeParam === 'fsa' ? 'fsa' : 'fps')
  const [form, setForm]           = useState({ ...emptyForm, tanggal_pengajuan: localToday() })
  const [layouters, setLayouters] = useState([])
  const [templates, setTemplates] = useState([])
  const [modelManual, setModelManual] = useState(false)   // true = ketik model manual (bukan dari library)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingDesign, setUploadingDesign] = useState(false)
  const [loading, setLoading]     = useState(!!editId)

  useEffect(() => { init() }, [editId])

  async function init() {
    // Daftar user prodev untuk pilihan PIC Layouter
    const { data: prodevUsers } = await supabase
      .from('profiles').select('id, full_name').eq('role', 'prodev').order('full_name')
    setLayouters(prodevUsers || [])

    // Template Library (model layout → link Pacdora)
    const { data: tpl } = await supabase
      .from('prodev_templates').select('*').order('sort').order('nama_model')
    setTemplates(tpl || [])

    if (editId) {
      const { data: o } = await supabase.from('prodev_orders').select('*').eq('id', editId).single()
      if (o) {
        setFormType(o.form_type)
        // Kalau model tersimpan tidak ada di library, buka mode manual
        const inLib = (tpl || []).some(t => t.nama_model === o.model_layout)
        setModelManual(!!o.model_layout && !inLib)
        setForm({
          kode_order: o.kode_order || '', customer_name: o.customer_name || '',
          nama_customer: o.nama_customer || '',
          contact: o.contact || '', brand_name: o.brand_name || '',
          tanggal_pengajuan: o.tanggal_pengajuan || localToday(), deadline: o.deadline || '',
          pic_sales: o.pic_sales || '', jenis_kemasan: o.jenis_kemasan || 'Softbox',
          model_layout: o.model_layout || '', template_url: o.template_url || '',
          status_jasa: o.status_jasa || 'non_jasa_desain',
          urgensi: o.urgensi || 'Dikirim', jumlah_part: String(o.jumlah_part ?? '1'),
          jumlah_kebutuhan: o.jumlah_kebutuhan || '', potensial_omzet: o.potensial_omzet || '',
          dimensi_produk: o.dimensi_produk || '',
          lp_layout: (o.lp_layout || []).length ? o.lp_layout : [''],
          dimensi_kemasan: (o.dimensi_kemasan || []).length ? o.dimensi_kemasan : [''],
          bahan_kemasan: o.bahan_kemasan || '', berat_produk: o.berat_produk || '',
          finishing: (o.finishing || []).length ? o.finishing : [''],
          jenis_sambungan: o.jenis_sambungan || '', finishing_lainnya: o.finishing_lainnya || '',
          lampiran_text: o.lampiran_text || '', lampiran_link: o.lampiran_link || '',
          lampiran_images: o.lampiran_images || [], design_files: o.design_files || [],
          layouter_id: o.layouter_id || '',
        })
      }
      setLoading(false)
    } else {
      // Auto-assign layouter dari pemetaan innersales → layouter di profil.
      // Tetap bisa diganti manual di form (mis. layouter sedang cuti).
      setForm(f => ({
        ...f,
        layouter_id: profile?.default_layouter_id || '',
        pic_sales: f.pic_sales || '',
      }))
    }
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  // ── Dynamic list (LP layout / dimensi kemasan / finishing) ──
  const listSet = (key, i, val) => setForm(f => ({ ...f, [key]: f[key].map((v, idx) => idx === i ? val : v) }))
  const listAdd = (key) => setForm(f => ({ ...f, [key]: [...f[key], ''] }))
  const listDel = (key, i) => setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }))

  // ── Upload gambar (bucket sama dengan request harga) ──
  async function uploadFile(file) {
    if (!file) return
    if (form.lampiran_images.length >= MAX_IMAGES) {
      alert(`Maksimal ${MAX_IMAGES} gambar.`)
      return
    }
    setUploading(true)
    const ext  = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'png'
    const path = `prodev/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('request - image').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('request - image').getPublicUrl(path)
      setForm(f => ({ ...f, lampiran_images: [...f.lampiran_images, publicUrl] }))
    } else {
      alert('Upload gagal: ' + error.message)
    }
    setUploading(false)
  }

  // ── Upload file desain konsumen (pdf/ai/cdr/eps/zip/gambar) ──
  async function uploadDesignFile(file) {
    if (!file) return
    setUploadingDesign(true)
    const safe = (file.name || 'file').replace(/[^\w.\-]+/g, '_')
    const path = `prodev/design/${Date.now()}_${safe}`
    const { error } = await supabase.storage.from(PRODEV_BUCKET).upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from(PRODEV_BUCKET).getPublicUrl(path)
      setForm(f => ({ ...f, design_files: [...f.design_files, { url: publicUrl, name: file.name || fileNameFromUrl(publicUrl) }] }))
    } else {
      alert('Upload gagal: ' + error.message + '\n(Pastikan bucket "prodev-files" & migration Pacdora sudah dijalankan.)')
    }
    setUploadingDesign(false)
  }

  // ── Pilih model dari Template Library → set model + template_url otomatis ──
  function selectModel(nama) {
    if (nama === '__manual__') { setModelManual(true); setForm(f => ({ ...f, model_layout:'', template_url:'' })); return }
    const t = templates.find(x => x.nama_model === nama)
    setModelManual(false)
    setForm(f => ({ ...f, model_layout: nama, template_url: t?.pacdora_url || '' }))
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
    if (!form.customer_name.trim()) { alert('Nama perusahaan wajib diisi.'); return }
    if (!form.deadline) { alert('Deadline wajib diisi.'); return }
    if (!form.layouter_id) { alert('PIC Layouter wajib dipilih. Kalau daftar kosong, minta manager membuat user role Prodev dulu.'); return }

    setSaving(true)
    const cleanList = (arr) => arr.map(v => v.trim()).filter(Boolean)
    const payload = {
      form_type: formType,
      kode_order: form.kode_order.trim() || null,
      customer_name: form.customer_name.trim(),
      nama_customer: form.nama_customer.trim() || null,
      contact: form.contact.trim() || null,
      brand_name: form.brand_name.trim() || null,
      tanggal_pengajuan: form.tanggal_pengajuan || localToday(),
      deadline: form.deadline,
      pic_sales: form.pic_sales.trim() || null,
      jenis_kemasan: form.jenis_kemasan,
      model_layout: form.model_layout.trim() || null,
      template_url: form.template_url.trim() || null,
      status_jasa: form.status_jasa,
      urgensi: form.urgensi,
      jumlah_part: parseInt(form.jumlah_part) || null,
      jumlah_kebutuhan: form.jumlah_kebutuhan.trim() || null,
      potensial_omzet: form.potensial_omzet.trim() || null,
      dimensi_produk: form.dimensi_produk.trim() || null,
      lp_layout: cleanList(form.lp_layout),
      dimensi_kemasan: cleanList(form.dimensi_kemasan),
      bahan_kemasan: form.bahan_kemasan.trim() || null,
      berat_produk: form.berat_produk.trim() || null,
      finishing: cleanList(form.finishing),
      jenis_sambungan: form.jenis_sambungan.trim() || null,
      finishing_lainnya: form.finishing_lainnya.trim() || null,
      lampiran_text: form.lampiran_text.trim() || null,
      lampiran_link: form.lampiran_link.trim() || null,
      lampiran_images: form.lampiran_images,
      design_files: form.design_files,
      layouter_id: form.layouter_id || null,
    }

    let error
    if (editId) {
      ;({ error } = await supabase.from('prodev_orders').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('prodev_orders').insert({ ...payload, created_by: profile.id }))
    }
    setSaving(false)
    if (error) { alert('Gagal menyimpan: ' + error.message); return }
    navigate('/prodev')
  }

  if (loading) return <Layout title="Form Prodev"><div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>Memuat...</div></Layout>

  const title = (editId ? 'Edit ' : '') + FORM_TYPE_LABEL[formType]

  return (
    <Layout title={title}>
      <button onClick={() => navigate('/prodev')} style={{
        display:'flex', alignItems:'center', gap:6, marginBottom:16, padding:'8px 14px',
        background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13,
        fontWeight:500, cursor:'pointer', color:C.brown,
      }}>← Kembali ke Prodev</button>

      <form onSubmit={handleSubmit} style={{ maxWidth:980 }}>

        {/* ── Pilih jenis form (hanya saat buat baru) ── */}
        {!editId && (
          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            {['fps','fsa'].map(t => (
              <button key={t} type="button" onClick={() => setFormType(t)} style={{
                padding:'12px 22px', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer',
                border: formType === t ? `2px solid ${C.orange}` : `1px solid ${C.border}`,
                background: formType === t ? '#fff7ed' : '#fff',
                color: formType === t ? C.orange : C.brown,
              }}>{FORM_TYPE_LABEL[t]}</button>
            ))}
          </div>
        )}

        {/* ── Informasi Konsumen ── */}
        <div style={s.card}>
          <div style={s.sTitle}>Informasi Konsumen</div>
          <div style={s.sSub}>Data dasar seperti bagian atas formulir kertas.</div>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Nama Perusahaan *</label>
              <input style={s.input} value={form.customer_name} onChange={set('customer_name')} placeholder="cth. Bumbu Bunda" required />
            </div>
            <div>
              <label style={s.label}>Nama Customer</label>
              <input style={s.input} value={form.nama_customer} onChange={set('nama_customer')} placeholder="cth. Eko (PIC konsumen)" />
            </div>
            <div>
              <label style={s.label}>Nama Product/Brand</label>
              <input style={s.input} value={form.brand_name} onChange={set('brand_name')} placeholder="cth. Box Kaldu" />
            </div>
            <div>
              <label style={s.label}>Email / No. WA</label>
              <input style={s.input} value={form.contact} onChange={set('contact')} placeholder="cth. eko@bumbubunda.co.id / 0812..." />
            </div>
            <div>
              <label style={s.label}>Kode Order</label>
              <input style={s.input} value={form.kode_order} onChange={set('kode_order')} placeholder="cth. 03/RSP23944/4670/I/2404/D" />
            </div>
            <div>
              <label style={s.label}>Tanggal Pengajuan</label>
              <input type="date" style={s.input} value={form.tanggal_pengajuan} onChange={set('tanggal_pengajuan')} />
            </div>
            <div>
              <label style={s.label}>Deadline (Permintaan) *</label>
              <input type="date" style={s.input} value={form.deadline} onChange={set('deadline')} required />
            </div>
            <div>
              <label style={s.label}>PIC Sales</label>
              <input style={s.input} value={form.pic_sales} onChange={set('pic_sales')} placeholder="cth. M. Ma'ruf Muqoddas" />
            </div>
            <div>
              <label style={s.label}>PIC Layouter *</label>
              <select style={s.select} value={form.layouter_id} onChange={set('layouter_id')} required>
                <option value="">— Pilih layouter —</option>
                {layouters.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                Terisi otomatis dari pemetaan innersales-mu. Ganti hanya kalau perlu.
              </div>
            </div>
            <div>
              <label style={s.label}>Jenis Kemasan</label>
              <select style={s.select} value={form.jenis_kemasan} onChange={set('jenis_kemasan')}>
                {JENIS_KEMASAN_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Model Layout</label>
              {!modelManual ? (
                <select style={s.select} value={form.model_layout} onChange={e => selectModel(e.target.value)}>
                  <option value="">— pilih model —</option>
                  {Object.entries(
                    templates.reduce((acc, t) => { (acc[t.kategori] ||= []).push(t); return acc }, {})
                  ).map(([kat, list]) => (
                    <optgroup key={kat} label={kat}>
                      {list.map(t => <option key={t.id} value={t.nama_model}>{t.nama_model}</option>)}
                    </optgroup>
                  ))}
                  <option value="__manual__">+ Model lain (ketik manual)…</option>
                </select>
              ) : (
                <>
                  <input style={s.input} value={form.model_layout} onChange={set('model_layout')} placeholder="cth. Tuck end snaplock" />
                  <input style={{ ...s.input, marginTop:6 }} value={form.template_url} onChange={set('template_url')} placeholder="Link template Pacdora (opsional)" />
                  <div style={{ fontSize:11, marginTop:4 }}>
                    <span onClick={() => { setModelManual(false); setForm(f => ({ ...f, model_layout:'', template_url:'' })) }}
                      style={{ color:C.orange, cursor:'pointer' }}>← pilih dari Template Library</span>
                  </div>
                </>
              )}
              {!modelManual && form.template_url && (
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                  Template Pacdora terhubung otomatis ✓
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop:16, ...s.grid2 }}>
            <div>
              <label style={s.label}>Status Jasa</label>
              <div style={{ display:'flex', gap:8 }}>
                {Object.entries(STATUS_JASA_LABEL).map(([val, lbl]) => (
                  <span key={val} style={s.chip(form.status_jasa === val)}
                    onClick={() => setForm(f => ({ ...f, status_jasa: val }))}>{lbl}</span>
                ))}
              </div>
            </div>
            <div>
              <label style={s.label}>Urgensi / Kebutuhan Konsumen</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {URGENSI_OPTIONS.map(u => (
                  <span key={u} style={s.chip(form.urgensi === u)}
                    onClick={() => setForm(f => ({ ...f, urgensi: u }))}>{u}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop:16, ...s.grid3 }}>
            <div>
              <label style={s.label}>Jumlah Part dengan Sekat</label>
              <input type="number" min="1" style={s.input} value={form.jumlah_part} onChange={set('jumlah_part')} placeholder="1" />
            </div>
            <div>
              <label style={s.label}>Jumlah Kebutuhan</label>
              <input style={s.input} value={form.jumlah_kebutuhan} onChange={set('jumlah_kebutuhan')} placeholder="cth. 1 pcs (total 5 pcs)" />
            </div>
            <div>
              <label style={s.label}>Potensial Omzet</label>
              <input style={s.input} value={form.potensial_omzet} onChange={set('potensial_omzet')} placeholder="opsional" />
            </div>
          </div>
        </div>

        {/* ── Deskripsi Produk ── */}
        <div style={s.card}>
          <div style={s.sTitle}>Deskripsi Produk</div>
          <div style={s.sSub}>Spesifikasi item + spesifikasi material & finishing.</div>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Dimensi Produk — P × L × T (cm)</label>
              <input style={s.input} value={form.dimensi_produk} onChange={set('dimensi_produk')} placeholder="cth. 10 x 7.7 x 12" />
            </div>
            <div>
              <label style={s.label}>Bahan Kemasan</label>
              <input style={s.input} value={form.bahan_kemasan} onChange={set('bahan_kemasan')} placeholder="cth. Ivory 300 gsm polos cetak full color" />
            </div>
            <div>
              <label style={s.label}>Berat Produk</label>
              <input style={s.input} value={form.berat_produk} onChange={set('berat_produk')} placeholder="opsional" />
            </div>
            <div>
              <label style={s.label}>Jenis Sambungan (titik & type lem)</label>
              <input style={s.input} value={form.jenis_sambungan} onChange={set('jenis_sambungan')} placeholder="opsional" />
            </div>
          </div>

          {/* Dynamic list: LP layout per part */}
          {[
            ['lp_layout',       'LP Layout/Area Desain per Part — P × L (cm)', 'cth. 37.1 x 34.2'],
            ['dimensi_kemasan', 'Dimensi Kemasan per Part — P × L × T (cm)',   'cth. 10 x 7.7 x 12'],
            ['finishing',       'Finishing (spesifikasi, kode foil, ukuran, dll)', 'cth. Laminasi Varnish wb 2 sisi'],
          ].map(([key, label, ph]) => (
            <div key={key} style={{ marginTop:16 }}>
              <label style={s.label}>{label}</label>
              {form[key].map((v, i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <input style={{ ...s.input, flex:1 }} value={v} onChange={e => listSet(key, i, e.target.value)} placeholder={`${ph}${form[key].length > 1 ? ` (part ${i+1})` : ''}`} />
                  {form[key].length > 1 && (
                    <button type="button" style={s.delBtn} onClick={() => listDel(key, i)}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" style={s.addBtn} onClick={() => listAdd(key)}>+ Tambah baris</button>
            </div>
          ))}

          <div style={{ marginTop:16 }}>
            <label style={s.label}>Finishing Lainnya</label>
            <input style={s.input} value={form.finishing_lainnya} onChange={set('finishing_lainnya')} placeholder="cth. Pond, perforasi, lem samping dan lock" />
          </div>
        </div>

        {/* ── File Desain Konsumen ── */}
        <div style={s.card}>
          <div style={s.sTitle}>File Desain Konsumen</div>
          <div style={s.sSub}>
            File desain dari konsumen (PDF / AI / CDR / EPS / ZIP). Ganti kiriman WhatsApp — prodev download langsung dari sini.
            Catatan: .cdr/.ai tetap perlu dibuka di CorelDRAW/Illustrator (tidak bisa preview di browser).
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {form.design_files.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:C.cream, borderRadius:8, border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, color:C.dark, flex:1, wordBreak:'break-all' }}>📄 {f.name || fileNameFromUrl(f.url)}</span>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#2563eb' }}>Buka ↗</a>
                <button type="button" style={s.delBtn} onClick={() => setForm(fm => ({ ...fm, design_files: fm.design_files.filter((_, idx) => idx !== i) }))}>✕</button>
              </div>
            ))}
            <div>
              <button type="button" disabled={uploadingDesign} onClick={() => designRef.current?.click()}
                style={{ ...s.addBtn, padding:'8px 16px' }}>
                {uploadingDesign ? 'Mengunggah...' : '+ Upload File Desain'}
              </button>
              <input ref={designRef} type="file" accept={DESIGN_FILE_ACCEPT} style={{ display:'none' }}
                onChange={async e => { await uploadDesignFile(e.target.files[0]); e.target.value = '' }} />
            </div>
          </div>
        </div>

        {/* ── Lampiran ── */}
        <div style={s.card} onPaste={handlePaste}>
          <div style={s.sTitle}>Lampiran</div>
          <div style={s.sSub}>
            {formType === 'fsa'
              ? 'FSA: lampiran bisa berupa gambar artwork dan/atau link Google Drive.'
              : 'FPS: catatan spesifikasi + gambar referensi dan/atau link Google Drive.'}
          </div>
          <label style={s.label}>Catatan / Keterangan Lampiran</label>
          <textarea rows={3} style={s.textarea} value={form.lampiran_text} onChange={set('lampiran_text')}
            placeholder="cth. Ukuran 10 x 7.7 x 12 cm, LP: 37.1 x 34.2, Bahan: Ivory 300 gsm... nanti sebelum cetak dibuat SS layout dulu." />

          <div style={{ marginTop:14 }}>
            <label style={s.label}>Link Google Drive</label>
            <input style={s.input} value={form.lampiran_link} onChange={set('lampiran_link')} placeholder="https://drive.google.com/..." />
          </div>

          <div style={{ marginTop:14 }}>
            <label style={s.label}>Gambar (maks. {MAX_IMAGES} — bisa juga paste screenshot di area ini)</label>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              {form.lampiran_images.map((url, i) => (
                <div key={i} style={{ position:'relative' }}>
                  <img src={url} alt={`lampiran ${i+1}`} style={{ height:90, width:90, objectFit:'cover', borderRadius:8, border:`1px solid ${C.border}` }} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, lampiran_images: f.lampiran_images.filter((_, idx) => idx !== i) }))}
                    style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', border:'none', background:'#dc2626', color:'#fff', fontSize:11, cursor:'pointer', lineHeight:'20px', padding:0 }}>✕</button>
                </div>
              ))}
              {form.lampiran_images.length < MAX_IMAGES && (
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                  style={{ height:90, width:90, borderRadius:8, border:`2px dashed ${C.border}`, background:C.cream, color:C.brown, fontSize:12, cursor:'pointer' }}>
                  {uploading ? 'Upload...' : '+ Gambar'}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={async e => { await uploadFile(e.target.files[0]); e.target.value = '' }} />
            </div>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginBottom:40 }}>
          <button type="submit" disabled={saving} style={{
            padding:'12px 28px', background:C.orange, color:'#fff', border:'none',
            borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer', opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Menyimpan...' : (editId ? 'Simpan Perubahan' : `Kirim ${formType.toUpperCase()}`)}</button>
        </div>
      </form>
    </Layout>
  )
}
