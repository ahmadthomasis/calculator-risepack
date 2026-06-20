import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

const s = {
  card:   { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(44,24,16,0.08)', marginBottom:20, border:`1px solid ${C.border}` },
  sTitle: { fontSize:15, fontWeight:600, color:C.dark, marginBottom:16 },
  input:  { padding:'7px 10px', border:`1px solid ${C.border}`, borderRadius:6, fontSize:14, outline:'none', width:'100%', boxSizing:'border-box', color:C.dark, textAlign:'center' },
  label:  { fontSize:12, color:'#9ca3af', fontWeight:500, marginBottom:6, display:'block' },
}

const num = v => parseFloat(v) || 0

// ── Algoritma guillomtine cutting ─────────────────────────────
// Grid seragam: berapa potongan cw x ch muat di kertas W x H
function gridFit(W, H, cw, ch) {
  if (cw <= 0 || ch <= 0) return { cols:0, rows:0, pcs:0 }
  const cols = Math.floor(W / cw)
  const rows = Math.floor(H / ch)
  return { cols, rows, pcs: cols * rows }
}

function wastePct(pcs, cw, ch, W, H) {
  if (pcs === 0 || W <= 0 || H <= 0) return 100
  return Math.round((1 - (pcs * cw * ch) / (W * H)) * 100)
}

// Kombinasi guillotine 1-potong: belah kertas jadi blok kiri + sisa kanan,
// tiap blok boleh pakai orientasi cutting size sendiri (normal atau diputar 90°)
function generateCombinations(W, H, w, h) {
  const orientations = [[w, h], [h, w]]
  const results = []

  for (const [ow1, oh1] of orientations) {
    const maxCols1 = Math.floor(W / ow1)
    for (let cols1 = 1; cols1 <= maxCols1; cols1++) {
      const usedW = cols1 * ow1
      const remainW = W - usedW
      const rows1 = Math.floor(H / oh1)
      const pcs1 = cols1 * rows1
      if (pcs1 === 0) continue

      if (remainW < Math.min(w, h) * 0.5) {
        results.push({ blocks: [{ cols:cols1, rows:rows1, w:ow1, h:oh1, pcs:pcs1, x:0 }], total: pcs1 })
        continue
      }

      for (const [ow2, oh2] of orientations) {
        const { cols:cols2, rows:rows2, pcs:pcs2 } = gridFit(remainW, H, ow2, oh2)
        const total = pcs1 + pcs2
        const blocks = [{ cols:cols1, rows:rows1, w:ow1, h:oh1, pcs:pcs1, x:0 }]
        if (pcs2 > 0) blocks.push({ cols:cols2, rows:rows2, w:ow2, h:oh2, pcs:pcs2, x:usedW })
        results.push({ blocks, total })
      }
    }
  }

  // dedupe berdasarkan signature blok
  const seen = new Set()
  const uniq = []
  for (const r of results) {
    const sig = r.blocks.map(b => `${b.cols}x${b.rows}@${b.w.toFixed(1)}x${b.h.toFixed(1)}`).join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    uniq.push(r)
  }
  uniq.sort((a, b) => b.total - a.total)
  return uniq
}

// ── Visual grid SVG ────────────────────────────────────────────
function CuttingDiagram({ W, H, blocks }) {
  const pad = 4
  const vbW = 200, vbH = 200 * (H / W)
  const scale = (vbW - pad * 2) / W

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH + pad * 2}`} style={{ width:'100%', maxWidth:220, display:'block', margin:'0 auto' }}>
      <rect x={pad} y={pad} width={W * scale} height={H * scale} fill={C.cream} stroke={C.border} strokeWidth="1.5" />
      {blocks.map((b, bi) => {
        const colors = ['#3b82f6', '#16a34a', '#E8760A']
        const color = colors[bi % colors.length]
        const cells = []
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            cells.push(
              <rect
                key={`${bi}-${r}-${c}`}
                x={pad + (b.x + c * b.w) * scale}
                y={pad + r * b.h * scale}
                width={b.w * scale}
                height={b.h * scale}
                fill="none"
                stroke={color}
                strokeWidth="1"
              />
            )
          }
        }
        return cells
      })}
    </svg>
  )
}

function ResultCard({ title, badgeColor, blocks, total, waste, cutW, cutH }) {
  return (
    <div style={{ ...s.card, marginBottom:0 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <span style={{
          padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
          background: badgeColor, color:'#fff'
        }}>{title}</span>
        <span style={{ fontSize:11, color:'#9ca3af' }}>Waste: <b style={{ color:'#dc2626' }}>{waste}%</b></span>
      </div>

      <CuttingDiagram W={num(cutW.W)} H={num(cutW.H)} blocks={blocks} />

      <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:4 }}>
        {blocks.map((b, i) => (
          <div key={i} style={{ fontSize:12, color:C.brown, display:'flex', justifyContent:'space-between' }}>
            <span>Blok {i+1}: {b.cols} × {b.rows}</span>
            <span style={{ color:'#9ca3af' }}>({b.w}×{b.h} cm)</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}`, textAlign:'center' }}>
        <div style={{ fontSize:32, fontWeight:700, color:C.orange }}>{total}</div>
        <div style={{ fontSize:11, color:'#9ca3af', fontWeight:500 }}>Pcs</div>
      </div>
    </div>
  )
}

export default function PotongKertas() {
  const navigate = useNavigate()
  const lastRequestId = localStorage.getItem('risepack_last_calculator_request')

  const [origW, setOrigW] = useState('79')
  const [origH, setOrigH] = useState('109')
  const [cutW, setCutW]   = useState('21')
  const [cutH, setCutH]   = useState('29.7')

  const W = num(origW), H = num(origH), w = num(cutW), h = num(cutH)

  const portrait = useMemo(() => {
    const { cols, rows, pcs } = gridFit(W, H, h, w) // cutting size diputar
    return { cols, rows, pcs, waste: wastePct(pcs, h, w, W, H), blocks:[{cols,rows,w:h,h:w,pcs,x:0}] }
  }, [W, H, w, h])

  const landscape = useMemo(() => {
    const { cols, rows, pcs } = gridFit(W, H, w, h) // cutting size apa adanya
    return { cols, rows, pcs, waste: wastePct(pcs, w, h, W, H), blocks:[{cols,rows,w,h,pcs,x:0}] }
  }, [W, H, w, h])

  const combinations = useMemo(() => {
    if (W <= 0 || H <= 0 || w <= 0 || h <= 0) return []
    return generateCombinations(W, H, w, h)
      .filter(c => c.blocks.length > 1) // hanya tampilkan yang benar2 kombinasi 2 blok
      .slice(0, 6)
  }, [W, H, w, h])

  const badgeColors = ['#E8760A', '#dc2626', '#9333ea', '#0891b2', '#65a30d', '#db2777']

  return (
    <Layout title="Potong Kertas">
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        {lastRequestId && (
          <button
            onClick={() => navigate(`/calculator/${lastRequestId}`)}
            style={{
              display:'flex', alignItems:'center', gap:6, marginBottom:16,
              padding:'8px 14px', background:'#fff', border:`1px solid ${C.border}`,
              borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', color:C.brown,
            }}
          >
            ← Kembali ke Kalkulasi Terakhir
          </button>
        )}

        <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:4 }}>Hitung Potong Kertas</h2>
        <p style={{ fontSize:13, color:'#9ca3af', marginBottom:20 }}>
          Masukkan ukuran kertas plano dan ukuran hasil potong untuk melihat efisiensi tiap pola susun.
        </p>

        <div style={s.card}>
          <div style={s.sTitle}>Ukuran</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div>
              <label style={s.label}>Original Size (cm)</label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input style={s.input} type="number" value={origW} onChange={e => setOrigW(e.target.value)} placeholder="P" />
                <span style={{ color:'#9ca3af' }}>×</span>
                <input style={s.input} type="number" value={origH} onChange={e => setOrigH(e.target.value)} placeholder="L" />
              </div>
            </div>
            <div>
              <label style={s.label}>Cutting Size (cm)</label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input style={s.input} type="number" value={cutW} onChange={e => setCutW(e.target.value)} placeholder="P" />
                <span style={{ color:'#9ca3af' }}>×</span>
                <input style={s.input} type="number" value={cutH} onChange={e => setCutH(e.target.value)} placeholder="L" />
              </div>
            </div>
          </div>
        </div>

        {W > 0 && H > 0 && w > 0 && h > 0 ? (
          <>
            <div style={{ fontSize:13, fontWeight:600, color:C.dark, margin:'24px 0 12px' }}>Grid Seragam</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16, marginBottom:8 }}>
              <ResultCard title="Portrait" badgeColor="#16a34a" blocks={portrait.blocks} total={portrait.pcs} waste={portrait.waste} cutW={{W,H}} />
              <ResultCard title="Landscape" badgeColor="#0891b2" blocks={landscape.blocks} total={landscape.pcs} waste={landscape.waste} cutW={{W,H}} />
            </div>

            {combinations.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:600, color:C.dark, margin:'24px 0 12px' }}>
                  Kombinasi (isi sisa kertas dengan orientasi berbeda)
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16 }}>
                  {combinations.map((c, i) => (
                    <ResultCard
                      key={i}
                      title={`Combi-${i+1}`}
                      badgeColor={badgeColors[i % badgeColors.length]}
                      blocks={c.blocks}
                      total={c.total}
                      waste={wastePct(c.total, w, h, W, H)}
                      cutW={{W,H}}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ ...s.card, textAlign:'center', color:'#9ca3af', padding:'40px 24px' }}>
            Isi semua ukuran untuk melihat hasil perhitungan.
          </div>
        )}
      </div>
    </Layout>
  )
}

