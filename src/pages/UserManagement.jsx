import Layout from '../components/Layout'

const C = { dark:'#2C1810', orange:'#E8760A', brown:'#5C3D2E', cream:'#FDF6EC', border:'#E8D5BC' }

export default function UserManagement() {
  return (
    <Layout title="User Management">
      <div style={{ maxWidth:700, margin:'60px auto', textAlign:'center' }}>
        <div style={{
          width:64, height:64, borderRadius:16, background:C.cream, border:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.dark, marginBottom:8 }}>User Management belum aktif</h2>
        <p style={{ fontSize:14, color:'#9ca3af', lineHeight:1.6 }}>
          Fitur tambah &amp; kelola user sedang menunggu setup Edge Function di Supabase.
          Setelah itu selesai di-deploy, halaman ini akan menampilkan daftar user dan form tambah user baru.
        </p>
      </div>
    </Layout>
  )
}
