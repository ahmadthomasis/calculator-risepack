import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ── Salin dari Kode Order lama (repeat order) ────────────────────────────
//
// MASALAH
// Banyak order adalah repeat order: produk dan spesifikasinya sama, cuma
// volumenya beda. Tanpa fitur ini estimator dan purchasing harus mengisi
// ulang semua baris biaya dari nol, padahal 90% isinya sama dengan order
// sebelumnya. Capek dan rawan salah ketik.
//
// SOLUSI
// Pilih satu order lama, lalu isinya disalin ke perhitungan yang sedang
// dibuka. Estimator/purchasing tinggal MEREVIEW mana yang berubah.
//
// DUA MODE
//   mode="hpp"  -> dipakai estimator di Calculator. Menyalin keenam array
//                  baris biaya (material, cetak, emboss, material proses,
//                  finishing, additional).
//   mode="cogs" -> dipakai purchasing di PurchasingReview. Menyalin harga
//                  pembanding purchasing dari order lama, dicocokkan ke
//                  baris perhitungan yang sekarang berdasarkan nama item.
//
// Yang muncul di daftar hanya order yang PERNAH DISIMPAN perhitungannya --
// kode order yang baru ada di direktori ERP tapi belum pernah dihitung tidak
// punya apa pun untuk disalin.

const C = { dark:'#2C1810', border:'#E8D5BC' }

const COST_COLS = [
  'material_cost', 'cetak_cost', 'emboss_laminasi',
  'material_proses', 'finishing_wo', 'additional_cost',
]

function countRows(q) {
  return COST_COLS.reduce((n, c) => n + (Array.isArray(q[c]) ? q[c].length : 0), 0)
}

export default function SalinOrderLama({ mode, excludeId, onPick, onClose }) {
  const [rows, setRows]     = useState(null)
  const [query, setQuery]   = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    let batal = false
    ;(async () => {
      // Hanya perhitungan final yang aktif. Draft tidak ikut -- isinya belum
      // tentu benar dan bisa berubah kapan saja.
      let qb = supabase.from('quotations')
        .select(`id, kode_order, customer_name, product_type, quantity, updated_at, selling_price,
                 purchasing_projected_at, ${COST_COLS.join(', ')}`)
        .eq('is_draft', false)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(300)

      // Untuk purchasing, yang berguna hanya order yang SUDAH diproyeksikan --
      // order lain belum punya harga pembanding untuk disalin.
      if (mode === 'cogs') qb = qb.not('purchasing_projected_at', 'is', null)

      const { data, error: err } = await qb
      if (batal) return
      if (err) { setError(err.message); setRows([]); return }
      setRows((data || []).filter(q => q.id !== excludeId && countRows(q) > 0))
    })()
    return () => { batal = true }
  }, [mode, excludeId])

  const matches = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    if (!q) return rows.slice(0, 60)
    return rows.filter(r =>
      (r.kode_order || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.product_type || '').toLowerCase().includes(q)
    ).slice(0, 60)
  }, [rows, query])

  async function pick(q) {
    setBusyId(q.id)
    setError('')
    try {
      await onPick(q)
      onClose()
    } catch (e) {
      console.error('Gagal menyalin dari order lama:', e)
      setError(e?.message || 'Gagal menyalin.')
    } finally {
      setBusyId(null)
    }
  }

  const judul = mode === 'cogs'
    ? 'Salin Harga Purchasing dari Order Lama'
    : 'Salin Perhitungan dari Order Lama'
  const penjelasan = mode === 'cogs'
    ? 'Harga pembanding purchasing dari order yang dipilih akan diisikan ke baris yang NAMA ITEMNYA SAMA. Baris yang namanya tidak ada di order lama dibiarkan kosong, dan harga yang sudah Anda isi tidak akan ditimpa.'
    : 'Semua baris biaya dari order yang dipilih akan menggantikan isi perhitungan ini — termasuk qty dan insheet, disalin apa adanya. Kalau volume order berbeda, akan muncul peringatan dengan tombol untuk menyesuaikan qty-nya.'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100,
        display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      }}
    >
      <div style={{
        background:'#fff', borderRadius:12, width:'100%', maxWidth:680,
        maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:16 }}>📄</span>
            <div style={{ fontSize:15, fontWeight:700, color:C.dark }}>{judul}</div>
            <button onClick={onClose} style={{
              marginLeft:'auto', border:'none', background:'transparent', fontSize:18,
              cursor:'pointer', color:'#9ca3af', lineHeight:1,
            }}>✕</button>
          </div>
          <div style={{ fontSize:11.5, color:'#6b7280', marginTop:8, lineHeight:1.6 }}>{penjelasan}</div>
        </div>

        <div style={{ padding:'12px 20px 0' }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari Kode Order, customer, atau produk..."
            style={{
              width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`,
              borderRadius:7, fontSize:13, boxSizing:'border-box', color:C.dark, outline:'none',
            }}
          />
          {error && (
            <div style={{ fontSize:12, color:'#b91c1c', marginTop:8 }}>{error}</div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 20px 20px' }}>
          {rows === null ? (
            <div style={{ padding:'20px 0', fontSize:12.5, color:'#9ca3af' }}>Memuat daftar order...</div>
          ) : matches.length === 0 ? (
            <div style={{ padding:'20px 0', fontSize:12.5, color:'#9ca3af', lineHeight:1.7 }}>
              {rows.length === 0
                ? (mode === 'cogs'
                    ? 'Belum ada order lain yang sudah diproyeksikan purchasing, jadi belum ada harga yang bisa disalin.'
                    : 'Belum ada perhitungan lain yang tersimpan, jadi belum ada yang bisa disalin.')
                : 'Tidak ada order yang cocok dengan pencarian.'}
            </div>
          ) : matches.map(q => (
            <div key={q.id} style={{
              border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px',
              marginBottom:8, display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                  {q.kode_order ? (
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:12.5, color:C.dark }}>{q.kode_order}</span>
                  ) : (
                    <span style={{ fontSize:11, color:'#b45309' }} title="Order ini belum ditagging Kode Order oleh Sales">belum ada Kode Order</span>
                  )}
                  <span style={{ fontSize:12.5, color:'#374151' }}>{q.customer_name || '—'}</span>
                </div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {q.product_type || '—'} · {(q.quantity || 0).toLocaleString('id-ID')} pcs · {countRows(q)} baris biaya
                  {q.updated_at ? ` · ${new Date(q.updated_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}` : ''}
                </div>
              </div>
              <button
                onClick={() => pick(q)}
                disabled={busyId !== null}
                style={{
                  flexShrink:0, padding:'7px 14px', borderRadius:7, border:'none',
                  fontSize:12.5, fontWeight:600, color:'#fff',
                  background: busyId === q.id ? '#9ca3af' : '#3b6d11',
                  cursor: busyId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                {busyId === q.id ? 'Menyalin...' : 'Salin'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
