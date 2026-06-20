import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const SECTIONS = [
  { key:'material_cost',     label:'1. Material Cost',  priceField:'harga_per_pcs',    nameFn:r => r.material || r.nama || '—' },
  { key:'cetak_cost',        label:'2. Cetak Cost',     priceField:'harga_per_lembar', nameFn:r => `${r.mesin || ''} ${r.warna || ''}`.trim() || '—' },
  { key:'emboss_laminasi',   label:'3. Emboss / Laminasi', priceField:'harga_per_cm2', nameFn:r => r.proses || '—' },
  { key:'material_proses',   label:'4. Material Proses', priceField:'harga_satuan',   nameFn:r => r.proses || '—' },
  { key:'finishing_wo',      label:'5. Finishing WO',   priceField:'harga_satuan',     nameFn:r => r.proses || '—' },
  { key:'additional_cost',   label:'6. Additional Cost', priceField:'harga',          nameFn:r => r.proses || '—' },
]

const s = {
  card: { background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:10, overflow:'hidden', marginBottom:18 },
  th: { textAlign:'left', padding:'9px 16px', fontSize:11, color:'#9ca3af', borderBottom:`0.5px solid ${C.border}` },
  td: { padding:'12px 16px', fontSize:13, color:C.dark, borderBottom:'0.5px solid #f3ede2' },
  input: { width:100, padding:'6px 8px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13 },
}

export default function PurchasingReview() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [quotation, setQuotation] = useState(null)
  const [request, setRequest] = useState(null)
  const [comparisons, setComparisons] = useState({})
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [quotationId])

  async function loadAll() {
    setLoading(true)
    const { data: q } = await supabase.from('quotations').select('*').eq('id', quotationId).maybeSingle()
    if (!q) { setLoading(false); return }
    const { data: req } = await supabase.from('requests').select('*').eq('id', q.request_id).maybeSingle()
    const { data: comps } = await supabase.from('purchasing_comparisons').select('*').eq('quotation_id', quotationId)

    const compMap = {}
    ;(comps || []).forEach(c => { compMap[`${c.section}-${c.row_index}`] = c })

    setQuotation(q)
    setRequest(req)
    setComparisons(compMap)
    setNotes(q.purchasing_notes || '')
    setLoading(false)
  }

  function updateComparisonPrice(section, rowIndex, value, estimatorPrice, itemName) {
    const key = `${section}-${rowIndex}`
    setComparisons(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        purchasing_price: value === '' ? null : Number(value),
        estimator_price: estimatorPrice,
        item_name: itemName,
      }
    }))
  }

  const hasAtLeastOnePrice = Object.values(comparisons).some(c => c.purchasing_price != null && c.purchasing_price !== '')

  async function saveComparisons() {
    const rows = Object.entries(comparisons)
      .filter(([, c]) => c.purchasing_price != null && c.purchasing_price !== '')
      .map(([key, c]) => {
        const [section, rowIndexStr] = key.split('-')
        return {
          quotation_id: quotationId,
          section,
          row_index: Number(rowIndexStr),
          item_name: c.item_name || null,
          estimator_price: c.estimator_price ?? null,
          purchasing_price: c.purchasing_price,
          updated_at: new Date().toISOString(),
        }
      })
    if (rows.length === 0) return
    await supabase.from('purchasing_comparisons').delete().eq('quotation_id', quotationId)
    const { error } = await supabase.from('purchasing_comparisons').insert(rows)
    if (error) console.error('Gagal simpan comparisons:', error)
  }

  async function decide(status) {
    if (!hasAtLeastOnePrice || !profile) return
    if (!confirm(`Yakin set status quotation ini jadi "${status}"?`)) return
    setSaving(true)
    await saveComparisons()
    const { error } = await supabase.from('quotations').update({
      purchasing_status: status,
      purchasing_notes: notes || null,
      purchasing_reviewed_at: new Date().toISOString(),
      purchasing_reviewed_by: profile.id,
    }).eq('id', quotationId)
    setSaving(false)
    if (error) { console.error('Gagal update status purchasing:', error); return }
    navigate('/purchasing')
  }

  if (loading) return <Layout title="Validasi Purchasing"><div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>Memuat data...</div></Layout>
  if (!quotation || !request) return <Layout title="Validasi Purchasing"><div style={{ padding:60, color:'#dc2626' }}>Quotation tidak ditemukan.</div></Layout>

  return (
    <Layout title={`Validasi — ${request.request_number}`}>
      <button
        onClick={() => navigate('/purchasing')}
        style={{
          display:'flex', alignItems:'center', gap:6, marginBottom:16,
          padding:'8px 14px', background:'#fff', border:`1px solid ${C.border}`,
          borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', color:C.brown,
        }}
      >
        ← Kembali ke Antrian
      </button>

      <div style={{ ...s.card, borderLeft:`4px solid ${C.orange}`, padding:'14px 18px', marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, fontSize:13 }}>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Customer</div><div style={{ fontWeight:500 }}>{quotation.customer_name}</div></div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Produk</div><div style={{ fontWeight:500 }}>{quotation.product_type}</div></div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Qty</div><div style={{ fontWeight:500 }}>{(quotation.quantity || 0).toLocaleString('id-ID')}</div></div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Harga Estimator</div><div style={{ fontWeight:500 }}>Rp {(quotation.selling_price || 0).toLocaleString('id-ID')}</div></div>
          <div><div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>Dikirim</div><div style={{ fontWeight:500 }}>{quotation.sent_to_purchasing_at ? new Date(quotation.sent_to_purchasing_at).toLocaleDateString('id-ID') : '—'}</div></div>
        </div>
      </div>

      {SECTIONS.map(sec => {
        const rows = quotation[sec.key]
        if (!Array.isArray(rows) || rows.length === 0) return null
        return (
          <div key={sec.key}>
            <div style={{ fontSize:13, fontWeight:500, color:C.dark, margin:'0 0 8px' }}>{sec.label}</div>
            <div style={s.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Item</th>
                    <th style={s.th}>Harga Estimator</th>
                    <th style={s.th}>Harga Purchasing</th>
                    <th style={s.th}>Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const estimatorPrice = Number(row[sec.priceField]) || 0
                    const itemName = sec.nameFn(row)
                    const key = `${sec.key}-${i}`
                    const comp = comparisons[key] || {}
                    const purchasingPrice = comp.purchasing_price
                    const diffPct = (purchasingPrice != null && estimatorPrice > 0)
                      ? Math.round(((purchasingPrice - estimatorPrice) / estimatorPrice) * 100)
                      : null
                    return (
                      <tr key={key}>
                        <td style={s.td}>{itemName}</td>
                        <td style={s.td}>Rp {estimatorPrice.toLocaleString('id-ID')}</td>
                        <td style={s.td}>
                          <input
                            type="number"
                            style={s.input}
                            placeholder="belum diisi"
                            value={purchasingPrice ?? ''}
                            onChange={e => updateComparisonPrice(sec.key, i, e.target.value, estimatorPrice, itemName)}
                          />
                        </td>
                        <td style={{ ...s.td, fontWeight:500, color: diffPct == null ? '#c4c4c4' : diffPct > 0 ? '#A32D2D' : diffPct < 0 ? '#3b6d11' : C.dark }}>
                          {diffPct == null ? '—' : `${diffPct > 0 ? '+' : ''}${diffPct}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {!hasAtLeastOnePrice && (
        <div style={{ background:'#fffbeb', border:'0.5px solid #f3d98a', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginBottom:18 }}>
          Isi minimal 1 harga pembanding untuk mengaktifkan tombol keputusan di bawah
        </div>
      )}

      <div style={{ ...s.card, padding:'16px 18px' }}>
        <div style={{ fontSize:13, fontWeight:500, color:C.dark, marginBottom:10 }}>Catatan (opsional)</div>
        <textarea
          placeholder="Tulis catatan untuk Sales/Manager..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ width:'100%', minHeight:60, padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:10, marginTop:14 }}>
          <button
            disabled={!hasAtLeastOnePrice || saving}
            onClick={() => decide('approved')}
            style={{
              flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:500, border:'none', cursor: hasAtLeastOnePrice ? 'pointer' : 'not-allowed',
              background: hasAtLeastOnePrice ? '#639922' : '#e5e7eb', color: hasAtLeastOnePrice ? '#fff' : '#9ca3af',
            }}
          >Disetujui</button>
          <button
            disabled={!hasAtLeastOnePrice || saving}
            onClick={() => decide('hold')}
            style={{
              flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:500, cursor: hasAtLeastOnePrice ? 'pointer' : 'not-allowed',
              background:'#fff', border:`1px solid ${hasAtLeastOnePrice ? '#d97706' : '#e5e7eb'}`, color: hasAtLeastOnePrice ? '#d97706' : '#9ca3af',
            }}
          >Hold</button>
          <button
            disabled={!hasAtLeastOnePrice || saving}
            onClick={() => decide('cancelled')}
            style={{
              flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:500, cursor: hasAtLeastOnePrice ? 'pointer' : 'not-allowed',
              background:'#fff', border:`1px solid ${hasAtLeastOnePrice ? '#A32D2D' : '#e5e7eb'}`, color: hasAtLeastOnePrice ? '#A32D2D' : '#9ca3af',
            }}
          >Cancel</button>
        </div>
      </div>
    </Layout>
  )
}
