-- Idempotent seed for the dashboard-audit test account.
-- Safe to re-run: removes prior audit-bot data first.
-- Schema-verified 2026-07-15: device_type/link_type are enums; pgcrypto in `extensions`.
--
-- CREDENTIAL: replace __AUDIT_BOT_PASSWORD__ below with the real password before running.
-- Do NOT commit the real password to git. (The live test account was seeded out-of-band.)

-- 1. Cleanup prior test data (explicit; do not rely on FK cascade).
delete from clicks where link_id in (
  select id from links where user_id in (select id from auth.users where email = 'audit-bot@tws.bio')
);
delete from links where user_id in (select id from auth.users where email = 'audit-bot@tws.bio');
delete from campaigns where user_id in (select id from auth.users where email = 'audit-bot@tws.bio');
delete from profiles where email = 'audit-bot@tws.bio';
delete from auth.users where email = 'audit-bot@tws.bio';

-- 2. Create a confirmed email/password user.
-- NOTE: GoTrue 500s on password login if these token columns are NULL, so seed them as ''.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'audit-bot@tws.bio', extensions.crypt('__AUDIT_BOT_PASSWORD__', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', 'audit-bot@tws.bio'),
       'email', now(), now(), now()
from auth.users where email = 'audit-bot@tws.bio';

insert into profiles (id, email, full_name)
select id, 'audit-bot@tws.bio', 'Audit Bot' from auth.users where email = 'audit-bot@tws.bio'
on conflict (id) do nothing;

-- 3. Seed a campaign so the Campaigns surface renders non-empty.
insert into campaigns (id, user_id, name, description)
select gen_random_uuid(), id, 'Spring Launch', 'Seeded campaign for dashboard audit'
from auth.users where email = 'audit-bot@tws.bio';

-- 4. Seed links (mix of url/deep_link, active/inactive, some in the campaign).
insert into links (id, user_id, short_code, original_url, link_type, is_active, total_clicks, created_at, campaign_id)
select gen_random_uuid(), u.id, v.short_code, v.original_url, v.link_type::link_type, v.is_active, 0,
       now() - (v.age_days || ' days')::interval,
       case when v.in_campaign then (select id from campaigns where user_id = u.id limit 1) else null end
from (select id from auth.users where email = 'audit-bot@tws.bio') u,
(values
  ('abpromo',  'https://example.com/spring-sale',           'url',       true,  40, true),
  ('abblog',   'https://example.com/blog/launch',           'url',       true,  25, true),
  ('abig',     'https://instagram.com/thewellnessstudio',   'deep_link', true,  18, true),
  ('abyt',     'https://youtube.com/watch?v=dQw4w9WgXcQ',   'deep_link', true,  12, false),
  ('abspot',   'https://open.spotify.com/track/abc',        'deep_link', true,   9, false),
  ('abshop',   'https://shop.example.com/product/42',       'url',       true,   7, false),
  ('abold',    'https://example.com/archived',              'url',       false,  4, false),
  ('abempty',  'https://example.com/no-clicks-yet',         'url',       true,  90, false)
) as v(short_code, original_url, link_type, is_active, age_days, in_campaign);

-- 5. Seed ~200 clicks spread across the seeded links (excluding abempty, which stays empty).
with u as (select id from auth.users where email = 'audit-bot@tws.bio'),
lk as (
  select id, row_number() over (order by created_at desc) rn
  from links
  where user_id in (select id from u) and short_code <> 'abempty'
)
insert into clicks (id, link_id, clicked_at, device_type, browser_name, os_name, referrer_domain, country)
select gen_random_uuid(),
  (select id from lk where rn = 1 + (g % (select count(*) from lk))),
  now() - ((g % 60) || ' days')::interval - ((g % 24) || ' hours')::interval,
  (array['mobile','desktop','tablet'])[1 + (g % 3)]::device_type,
  (array['Chrome','Safari','Firefox','Edge','Samsung Internet'])[1 + (g % 5)],
  (array['iOS','Android','Windows','macOS'])[1 + (g % 4)],
  (array['instagram.com','youtube.com','google.com','t.co','Direct','linkedin.com'])[1 + (g % 6)],
  (array['US','GB','IN','CA','DE','AU'])[1 + (g % 6)]
from generate_series(0, 199) as g;

-- 6. Sync total_clicks to seeded click counts.
update links l set total_clicks = coalesce(c.n, 0)
from (select link_id, count(*) n from clicks group by link_id) c
where l.id = c.link_id and l.user_id in (select id from auth.users where email = 'audit-bot@tws.bio');
