import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const C = { dark:'#2C1810', border:'#E8D5BC' }

// Cache module-level supaya tidak fetch ulang tiap kali modal Deal dibuka.
let cachedOptions = null
let cachedPromise = null
function loadErpOrders() {
  if (cachedOptions) return Promise.resolve(cachedOptions)
  if (!cachedPromise) {
    cachedPromise = supabase.from('erp_orders').select('sko,nama_customer,nama_produk').order('sko')
      .then(({ data }) => { cachedOptions = data || []; return cachedOptions })
  }
  return cachedPromise
}

// Dropdown pencarian Kode Order — wajib pilih dari daftar erp_orders (data ERP),
// tidak bisa ketik bebas. onChange cuma dipanggil saat user klik salah satu opsi.
export default function KodeOrderPicker({ value, onChange, inputStyle, placeholder, autoFocus }) {
  const [options, setOptions] = useState([])
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => { loadErpOrders().then(setOptions) }, [])
  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q ? options : options.filter(o =>
      (o.sko || '').toLowerCase().includes(q) ||
      (o.nama_customer || '').toLowerCase().includes(q) ||
      (o.nama_produk || '').toLowerCase().includes(q)
    )
    return base.slice(0, 50)
  }, [options, query])

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <input
        autoFocus={autoFocus}
        style={inputStyle}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || 'Cari Kode Order, customer, atau produk...'}
      />
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, marginTop:4, maxHeight:220, overflowY:'auto',
          background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:20,
        }}>
          {options.length === 0 ? (
            <div style={{ padding:'10px 12px', fontSize:12, color:'#9ca3af' }}>Memuat daftar Kode Order...</div>
          ) : matches.length === 0 ? (
            <div style={{ padding:'10px 12px', fontSize:12, color:'#9ca3af' }}>Tidak ada Kode Order yang cocok.</div>
          ) : matches.map(o => (
            <div key={o.sko}
              onClick={() => { onChange(o.sko); setQuery(o.sko); setOpen(false) }}
              style={{ padding:'7px 10px', cursor:'pointer', fontSize:12.5, borderBottom:'1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ fontFamily:'monospace', fontWeight:600, color:C.dark }}>{o.sko}</div>
              <div style={{ color:'#9ca3af', fontSize:11 }}>{o.nama_customer || '—'} · {o.nama_produk || '—'}</div>
            </div>
          ))}
        </div>
      )}
      {value && value !== query && (
        <div style={{ fontSize:11, color:'#d97706', marginTop:4 }}>Belum dipilih dari daftar — klik salah satu opsi di atas.</div>
      )}
    </div>
  )
}
