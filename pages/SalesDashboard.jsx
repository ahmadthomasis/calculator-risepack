import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const PRODUCT_TYPES = ['Softbox','Hardbox','Corrugated Box','Corrugated Mailer','Paper Bag','Rigid Box','Lainnya']
const STATUS_LABEL  = { pending:'Menunggu', in_progress:'Dikerjakan', done:'Selesai', cancelled:'Dibatalkan' }
const STATUS_COLOR  = { pending:'#f59e0b', in_progress:'#2563eb', done:'#16a34a', cancelled:'#9ca3af' }

const s = {
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  card:  { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', marginBottom:24 },
  h2:    { fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:20 },
  label: { display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6, marginTop:16 },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' },
  select:{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box' },
  textarea:{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box' },
  btn:   { padding:'10px 20px', background:'#2563eb', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer' },
  btnSm: { padding:'6px 12px', background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12, cursor:'pointer' },
  badge: (status) => ({
    display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500,
    background: STATUS_COLOR[status] + '18', color: STATUS_COLOR[status]
  }),
  table:  { width:'100%', borderCollapse:'collapse' },
  th:     { textAlign:'left', padding:'10px 12px', fontSize:12, color:'#6b7280', borderBottom:'1px solid #f3f4f6', fontWeight:500 },
  td:     { padding:'12px', fontSize:13, color:'#374151', borderBottom:'1px solid #f9fafb' },
}

const emptyForm = {
  customer_name:'', product_type:'Softbox', quantity:'',
  product_size:'', plano_size:'', material_spec:'',
  print_spec:'', finishing_spec:'', notes:'', priority:'normal'
}

export default function SalesDashboard() {
  const { profile } = useAuth()
  const [form, setForm]         = useState(emptyForm)
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    const { data } = await supabase
      .from('requests')
      .select(`*, quotations(deal_status, selling_price)`)
      .order('submitted_at', { ascending: false })
    setRequests(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('requests').insert({
      ...form,
      quantity: parseInt(form.quantity),
      sales_id: profile.id,
    })
    if (!error) {
      setSuccess(true)
      setForm(emptyForm)
      setShowForm(false)
      fetchRequests()
      setTimeout(() => setSuccess(false), 4000)
    }
    setLoading(false)
  }

  const pending  = requests.filter(r => r.status === 'pending').length
  const progress = requests.filter(r => r.status === 'in_progress').length
  const done     = requests.filter(r => r.status === 'done').length

  return (
    <Layout title="Request Harga">
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Menunggu',   value:pending,  color:'#f59e0b' },
          { label:'Dikerjakan', value:progress, color:'#2563eb' },
          { label:'Selesai',    value:done,     color:'#16a34a' },
        ].map(st => (
          <div key={st.label} style={{ background:'#fff', borderRadius:12, padding:'20px 24px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:28, fontWeight:700, color:st.color }}>{st.value}</div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {success && (
        <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'12px 16px', marginBottom:20, color:'#16a34a', fontSize:14 }}>
          Request berhasil dikirim! Estimator akan segera memproses.
        </div>
      )}

      {/* Form toggle */}
      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:16, fontWeight:600, color:'#1a1a1a' }}>Request Harga Saya</div>
        <button style={s.btn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Tutup Form' : '+ Request Harga Baru'}
        </button>
      </div>

      {/* Request form */}
      {showForm && (
        <div style={s.card}>
          <div style={s.h2}>Form Permintaan Harga</div>
          <form onSubmit={handleSubmit}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Nama Customer *</label>
                <input style={s.input} value={form.customer_name}
                  onChange={e => setForm({...form, customer_name: e.target.value})} required />
              </div>
              <div>
                <label style={s.label}>Jenis Produk *</label>
                <select style={s.select} value={form.product_type}
                  onChange={e => setForm({...form, product_type: e.target.value})}>
                  {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Quantity *</label>
                <input style={s.input} type="number" min="1" value={form.quantity}
                  onChange={e => setForm({...form, quantity: e.target.value})} required placeholder="contoh: 5000" />
              </div>
              <div>
                <label style={s.label}>Prioritas</label>
                <select style={s.select} value={form.priority}
                  onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Ukuran Produk</label>
                <input style={s.input} value={form.product_size}
                  onChange={e => setForm({...form, product_size: e.target.value})} placeholder="contoh: 17x12x8 cm" />
              </div>
              <div>
                <label style={s.label}>Ukuran Plano</label>
                <input style={s.input} value={form.plano_size}
                  onChange={e => setForm({...form, plano_size: e.target.value})} placeholder="contoh: 48x51 cm" />
              </div>
              <div>
                <label style={s.label}>Spesifikasi Material</label>
                <input style={s.input} value={form.material_spec}
                  onChange={e => setForm({...form, material_spec: e.target.value})} placeholder="contoh: K125/m125/k125 e/f" />
              </div>
              <div>
                <label style={s.label}>Spesifikasi Print</label>
                <input style={s.input} value={form.print_spec}
                  onChange={e => setForm({...form, print_spec: e.target.value})} placeholder="contoh: 1 warna bagian luar" />
              </div>
            </div>
            <label style={s.label}>Finishing</label>
            <input style={s.input} value={form.finishing_spec}
              onChange={e => setForm({...form, finishing_spec: e.target.value})} placeholder="contoh: pond + die cut, laminasi doff" />
            <label style={s.label}>Catatan Tambahan</label>
            <textarea style={s.textarea} rows={3} value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})} placeholder="Informasi lain yang perlu diketahui estimator..." />
            <div style={{ marginTop:20 }}>
              <button style={s.btn} type="submit" disabled={loading}>
                {loading ? 'Mengirim...' : 'Kirim Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request list */}
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>No. Request</th>
              <th style={s.th}>Customer</th>
              <th style={s.th}>Produk</th>
              <th style={s.th}>Qty</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Prioritas</th>
              <th style={s.th}>Tanggal</th>
              <th style={s.th}>Harga</th>
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
                <td style={s.td}><span style={{ fontFamily:'monospace', fontSize:12 }}>{r.request_number}</span></td>
                <td style={s.td}>{r.customer_name}</td>
                <td style={s.td}>{r.product_type}</td>
                <td style={s.td}>{r.quantity?.toLocaleString('id-ID')}</td>
                <td style={s.td}><span style={s.badge(r.status)}>{STATUS_LABEL[r.status]}</span></td>
                <td style={s.td}>
                  {r.priority === 'urgent'
                    ? <span style={{ color:'#dc2626', fontSize:12, fontWeight:500 }}>🔴 Urgent</span>
                    : <span style={{ color:'#6b7280', fontSize:12 }}>Normal</span>}
                </td>
                <td style={s.td}>{new Date(r.submitted_at).toLocaleDateString('id-ID')}</td>
                <td style={s.td}>
                  {r.quotations?.[0]?.selling_price
                    ? <span style={{ fontWeight:500, color:'#16a34a' }}>
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
