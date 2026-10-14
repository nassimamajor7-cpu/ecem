-- 002 : sécurité Row Level Security (RLS) sur TOUTES les tables
-- Règle d'or : le navigateur ne peut jamais écrire dans "transactions" ni "orders".

-- Rôle de la personne connectée (fonction interne, évite la récursion RLS)
create function public.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;
revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.gifts enable row level security;
alter table public.orders enable row level security;
alter table public.ideas enable row level security;
alter table public.chat_messages enable row level security;

-- On retire tout, puis on donne le strict nécessaire
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles, public.transactions, public.orders,
  public.gifts, public.ideas, public.chat_messages to authenticated;
grant insert (name, description, price_points, active, created_by) on public.gifts to authenticated;
grant update (name, description, price_points, active) on public.gifts to authenticated;
grant insert (author_id, body) on public.ideas to authenticated;
grant insert (author_id, body) on public.chat_messages to authenticated;

-- PROFILS : tout le monde voit les prénoms (pour choisir à qui envoyer des points)
-- Aucune écriture directe : le rôle ne peut donc pas être modifié par l'utilisateur.
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- TRANSACTIONS : chacun voit les siennes ; les délégués voient aussi les échanges
create policy transactions_select on public.transactions
  for select to authenticated using (
    user_id = (select auth.uid())
    or (public.app_role() = 'delegue' and type in ('envoi', 'reception', 'annulation'))
  );

-- CADEAUX : visibles s'ils sont actifs ; les suppléants gèrent la boutique
create policy gifts_select on public.gifts
  for select to authenticated using (active or public.app_role() = 'suppleant');
create policy gifts_insert on public.gifts
  for insert to authenticated with check (
    public.app_role() = 'suppleant' and created_by = (select auth.uid())
  );
create policy gifts_update on public.gifts
  for update to authenticated
  using (public.app_role() = 'suppleant')
  with check (public.app_role() = 'suppleant');

-- COMMANDES : lecture seule (les écritures passent par les fonctions serveur)
create policy orders_select on public.orders
  for select to authenticated using (
    student_id = (select auth.uid()) or public.app_role() = 'suppleant'
  );

-- IDÉES : l'auteur et les délégués lisent ; élèves et suppléants non bloqués écrivent
create policy ideas_select on public.ideas
  for select to authenticated using (
    author_id = (select auth.uid()) or public.app_role() = 'delegue'
  );
create policy ideas_insert on public.ideas
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and public.app_role() in ('eleve', 'suppleant')
    and not coalesce((select bloque_idees from public.profiles where id = (select auth.uid())), true)
  );

-- TCHAT : réservé aux délégués et suppléants
create policy chat_select on public.chat_messages
  for select to authenticated using (public.app_role() in ('delegue', 'suppleant'));
create policy chat_insert on public.chat_messages
  for insert to authenticated with check (
    author_id = (select auth.uid()) and public.app_role() in ('delegue', 'suppleant')
  );

-- Temps réel pour le tchat (le filtrage RLS s'applique aussi au temps réel)
alter publication supabase_realtime add table public.chat_messages;
