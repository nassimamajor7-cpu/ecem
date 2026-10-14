-- 006 : inscription avec code (voir aussi supabase/functions/register)
-- Les codes sont stockés hachés dans registration_codes (illisibles depuis le navigateur).
-- Pour changer un code (exemple : code délégué) :
--   update public.registration_codes
--      set code_hash = extensions.crypt('NOUVEAUCODE', extensions.gen_salt('bf'))
--    where role = 'delegue';

create table public.registration_codes (
  role text primary key check (role in ('eleve', 'suppleant', 'delegue')),
  code_hash text not null
);
alter table public.registration_codes enable row level security;
revoke all on public.registration_codes from anon, authenticated;

create table public.registration_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  success boolean not null
);
alter table public.registration_attempts enable row level security;
revoke all on public.registration_attempts from anon, authenticated;

create function public.register_precheck(p_role text, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_max integer;
  v_cnt integer;
begin
  if (select count(*) from public.registration_attempts
       where at > now() - interval '10 minutes' and not success) >= 30 then
    return 'throttled';
  end if;

  select code_hash into v_hash from public.registration_codes where role = p_role;
  if v_hash is null or extensions.crypt(coalesce(p_code, ''), v_hash) <> v_hash then
    insert into public.registration_attempts (success) values (false);
    return 'bad_code';
  end if;

  v_max := case p_role when 'delegue' then 2 when 'suppleant' then 2 else 14 end;
  select count(*) into v_cnt from public.profiles where role = p_role;
  if v_cnt >= v_max then return 'full'; end if;

  insert into public.registration_attempts (success) values (true);
  return 'ok';
end $$;
revoke all on function public.register_precheck(text, text) from public, anon, authenticated;
grant execute on function public.register_precheck(text, text) to service_role;

create function public.profiles_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_max integer;
begin
  v_max := case new.role when 'delegue' then 2 when 'suppleant' then 2 else 14 end;
  if (select count(*) from public.profiles where role = new.role) >= v_max then
    raise exception 'Il n''y a plus de place pour ce rôle.';
  end if;
  return new;
end $$;
create trigger profiles_limit_trg before insert on public.profiles
  for each row execute function public.profiles_limit();
