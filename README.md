# HayMesa

Mesas libres en tiempo real en bares y restaurantes. Next.js (frontend + API) + Supabase (Postgres y Realtime).

## Correr en local

1. `cp .env.example .env.local` y completar las variables.
2. Crear las tablas: pegar `supabase/esquema.sql` en el SQL Editor de Supabase.
3. `npm install` y `npm run dev` → http://localhost:3000

Local demo: `demo@haymesa.com` / `demo1234`. Datos de prueba en Rosario centro (con simulador en vivo): `supabase/datos_prueba.sql`.

## Deploy en Vercel

Importar el repo (Root Directory: la raíz) y cargar las variables de `.env.example`.
