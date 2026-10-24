-- Tablas de HayMesa. Solo el servidor (service_role) accede a ellas: RLS activado y sin políticas.

create table if not exists restaurantes (
  id bigint generated always as identity primary key,
  nombre text not null,
  tipo text not null default 'Restaurante',
  direccion text not null,
  lat double precision not null,
  lng double precision not null,
  email text not null unique,
  password_hash text not null,
  ultima_actualizacion timestamptz
);

create table if not exists mesas (
  id bigint generated always as identity primary key,
  restaurante_id bigint not null references restaurantes(id) on delete cascade,
  nombre text not null,
  capacidad integer not null,
  zona jsonb not null,
  ocupada boolean not null default false,
  personas integer not null default 0
);
create index if not exists mesas_restaurante on mesas(restaurante_id);

create table if not exists historial (
  restaurante_id bigint not null references restaurantes(id) on delete cascade,
  minuto text not null,
  ocupadas integer not null,
  total integer not null,
  primary key (restaurante_id, minuto)
);

-- "terminada" queda en null mientras la promo está activa; si no: 'vencio', 'cupo', 'lleno' o 'manual'
create table if not exists promos (
  id bigint generated always as identity primary key,
  restaurante_id bigint not null references restaurantes(id) on delete cascade,
  descripcion text not null,
  vence_en timestamptz not null,
  cupo integer not null,
  mesas_tomadas integer not null default 0,
  terminada text
);
create index if not exists promos_activas on promos(restaurante_id) where terminada is null;

alter table restaurantes enable row level security;
alter table mesas enable row level security;
alter table historial enable row level security;
alter table promos enable row level security;

-- Local de demo: demo@haymesa.com / demo1234
insert into restaurantes (nombre, tipo, direccion, lat, lng, email, password_hash)
values ('Bar del Evento', 'Bar', 'Rosario, Santa Fe', -32.9476, -60.6305, 'demo@haymesa.com',
        '$2b$10$tDqmFDPgNeApxh8JHRdS0uwY/eYCLkQAxWup1NB/AdSIijWgFAZAu')
on conflict (email) do nothing;
