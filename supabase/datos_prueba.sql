-- Datos de prueba: locales en Rosario centro con mesas, historial de 14 días, promos
-- y un simulador (pg_cron, cada 20 s) que va cambiando la ocupación para que se vean "en vivo".
-- Todos usan emails @prueba.haymesa.com y la contraseña demo1234. Para borrarlos:
--   select cron.unschedule('simular-locales'); delete from restaurantes where email like '%@prueba.haymesa.com';

delete from restaurantes where email like '%@prueba.haymesa.com';

with datos(nombre, tipo, direccion, lat, lng, mesas, base) as (values
  ('La Esquina de Oroño',   'Bar',         'Bv. Oroño 1102',        -32.9478, -60.6496, 10, 0.55),
  ('Pizzería Corrientes',   'Pizzería',    'Corrientes 820',        -32.9457, -60.6402, 12, 0.70),
  ('Café del Monumento',    'Café',        'Santa Fe 581',          -32.9476, -60.6328,  8, 0.35),
  ('Parrilla San Martín',   'Parrilla',    'San Martín 1150',       -32.9505, -60.6385, 14, 0.80),
  ('Cervecería Pichincha',  'Cervecería',  'Brown 2100',            -32.9395, -60.6565, 16, 0.60),
  ('Bar Plaza Pringles',    'Bar',         'Córdoba 1200',          -32.9465, -60.6405,  9, 0.45),
  ('Bodegón Entre Ríos',    'Restaurante', 'Entre Ríos 960',        -32.9492, -60.6418, 11, 0.65),
  ('Café Sarmiento',        'Café',        'Sarmiento 750',         -32.9468, -60.6378,  6, 0.25),
  ('La Pizza de Mitre',     'Pizzería',    'Mitre 1010',            -32.9497, -60.6400, 10, 0.50),
  ('Taberna del Río',       'Bar',         'Av. Belgrano 650',      -32.9425, -60.6345, 12, 0.85),
  ('Cervecería La Fluvial', 'Cervecería',  'Av. de los Inmigrantes 410', -32.9445, -60.6300, 18, 0.40),
  ('Restó Plaza Sarmiento', 'Restaurante', 'Santa Fe 1300',         -32.9440, -60.6440, 10, 0.30),
  ('Parrilla Pellegrini',   'Parrilla',    'Pellegrini 1450',       -32.9558, -60.6455, 15, 0.90),
  ('Café Facultad',         'Café',        'Maipú 1065',            -32.9506, -60.6372,  7, 0.55),
  ('Bar Tucumán',           'Bar',         'Tucumán 1380',          -32.9423, -60.6430,  8, 0.20),
  ('Sushi Paraguay',        'Restaurante', 'Paraguay 840',          -32.9478, -60.6435,  9, 0.60),
  ('Pizzería Pichincha',    'Pizzería',    'Rodríguez 1020',        -32.9375, -60.6520, 11, 0.75),
  ('El Patio de Rioja',     'Restaurante', 'Rioja 1550',            -32.9470, -60.6460, 13, 0.45),
  ('Cervecería Laprida',    'Cervecería',  'Laprida 1170',          -32.9500, -60.6362, 14, 0.50),
  ('Café Urquiza',          'Café',        'Urquiza 1490',          -32.9433, -60.6455,  6, 0.65),
  ('Bar del Parque',        'Bar',         'Moreno 1600',           -32.9555, -60.6500, 10, 0.35),
  ('Parrilla 3 de Febrero', 'Parrilla',    '3 de Febrero 1100',     -32.9530, -60.6420, 12, 0.55)
),
nuevos as (
  insert into restaurantes (nombre, tipo, direccion, lat, lng, email, password_hash, ultima_actualizacion)
  select d.nombre, d.tipo, d.direccion || ', Rosario', d.lat, d.lng,
         lower(regexp_replace(translate(d.nombre, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'), '[^a-zA-Z0-9]+', '', 'g')) || '@prueba.haymesa.com',
         (select password_hash from restaurantes where email = 'demo@haymesa.com'), now()
  from datos d
  returning id, nombre
)
insert into mesas (restaurante_id, nombre, capacidad, zona, ocupada, personas)
select n.id, 'Mesa ' || g, (array[2, 2, 4, 4, 4, 6])[1 + (g % 6)],
       jsonb_build_object('x', ((g - 1) % 4) * 0.24 + 0.02, 'y', ((g - 1) / 4) * 0.2 + 0.02, 'ancho', 0.2, 'alto', 0.16),
       random() < d.base, 0
from nuevos n join datos d using (nombre), generate_series(1, d.mesas) g;

update mesas set personas = case when ocupada then 1 + floor(random() * capacidad)::int else 0 end
where restaurante_id in (select id from restaurantes where email like '%@prueba.haymesa.com');

-- Ocupación "típica" según la hora argentina (pico de almuerzo y de cena)
create or replace function curva_ocupacion(hora int) returns float language sql immutable as $$
  select case
    when hora between 12 and 14 then 0.75
    when hora between 15 and 19 then 0.35
    when hora between 20 and 23 then 0.9
    when hora between 0 and 1 then 0.6
    when hora between 9 and 11 then 0.3
    else 0.1 end
$$;

-- Historial: cada 15 minutos de los últimos 14 días
insert into historial (restaurante_id, minuto, ocupadas, total)
select r.id, to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI'),
       least(m.total, greatest(0, round(m.total * (curva_ocupacion(extract(hour from t at time zone 'America/Argentina/Buenos_Aires')::int)
             * (0.6 + r.id % 5 * 0.15) + (random() - 0.5) * 0.3))))::int,
       m.total
from restaurantes r
join (select restaurante_id, count(*)::int total from mesas group by 1) m on m.restaurante_id = r.id
cross join generate_series(date_trunc('hour', now()) - interval '14 days', now() - interval '15 minutes', interval '15 minutes') t
where r.email like '%@prueba.haymesa.com'
on conflict do nothing;

-- Promos activas en algunos locales
insert into promos (restaurante_id, descripcion, vence_en, cupo)
select id, d, now() + interval '3 hours', 3
from (values ('Café Sarmiento', '2x1 en cafés hasta las 20'),
             ('Bar Tucumán', '20% off si llegás en los próximos 30 min'),
             ('Restó Plaza Sarmiento', 'Postre gratis para mesas de 2'),
             ('Cervecería La Fluvial', 'Happy hour: pintas a mitad de precio'),
             ('Bar del Parque', 'Picada de regalo con 2 tragos')) p(nombre, d)
join restaurantes using (nombre)
where email like '%@prueba.haymesa.com';

-- Simulador: cambia algunas mesas hacia la ocupación típica de la hora y marca los locales en vivo
create or replace function simular_locales() returns void language plpgsql as $$
declare
  objetivo float := curva_ocupacion(extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int);
begin
  update mesas m
  set ocupada = random() < least(0.95, objetivo * (0.6 + m.restaurante_id % 5 * 0.15)),
      personas = 0
  from restaurantes r
  where r.id = m.restaurante_id and r.email like '%@prueba.haymesa.com' and random() < 0.15;

  update mesas m set personas = 1 + floor(random() * capacidad)::int
  from restaurantes r
  where r.id = m.restaurante_id and r.email like '%@prueba.haymesa.com' and m.ocupada and m.personas = 0;

  update restaurantes set ultima_actualizacion = now() where email like '%@prueba.haymesa.com';

  insert into historial (restaurante_id, minuto, ocupadas, total)
  select m.restaurante_id, to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI'), count(*) filter (where m.ocupada), count(*)
  from mesas m join restaurantes r on r.id = m.restaurante_id
  where r.email like '%@prueba.haymesa.com'
  group by 1
  on conflict do nothing;

  -- Renueva las promos de prueba que vencieron
  update promos p set vence_en = now() + interval '3 hours', mesas_tomadas = 0, terminada = null
  from restaurantes r
  where r.id = p.restaurante_id and r.email like '%@prueba.haymesa.com'
    and p.id in (select max(id) from promos group by restaurante_id)
    and (p.terminada is not null or p.vence_en < now());
end
$$;

create extension if not exists pg_cron;
select cron.schedule('simular-locales', '20 seconds', 'select simular_locales()');
