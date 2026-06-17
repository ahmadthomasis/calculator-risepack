# Calculator Risepack

Sistem kalkulasi harga packaging — pengganti Google Sheets.

## Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Deploy**: GitHub Pages (auto via GitHub Actions)

## Fitur
- Sales: submit request harga via form (ganti WA)
- Estimator: queue board realtime + kalkulator dynamic
- Manager: dashboard analytics (deal rate, response time, dll)

## Setup Development (MacBook)

```bash
# Install Node.js dulu kalau belum: https://nodejs.org
npm install
npm run dev
# Buka http://localhost:5173/calculator-risepack/
```

## Deploy
Push ke branch `main` → GitHub Actions otomatis build dan deploy ke GitHub Pages.

## Tambah User Baru
Buka Supabase Dashboard → Authentication → Users → Invite user
Atau via SQL:
```sql
-- Setelah user register, update role-nya:
update public.profiles set role = 'estimator' where id = 'USER_UUID';
```
