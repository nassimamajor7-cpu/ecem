-- 001 : tables du site de points de la classe
-- Principe central : le solde n'est JAMAIS modifié directement.
-- Le solde = somme des lignes de la table "transactions" (journal en ajout seul).

create extension if not exists pgcrypto with schema extensions;

-- Profils : un par compte (identifiant technique = auth.users.id)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null check (role in ('eleve', 'suppleant', 'delegue')),
  bloque_idees boolean not null default false,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index profiles_display_name_uniq on public.profiles (lower(display_name));

-- Cadeaux de la boutique 3D
create table public.gifts (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  price_points integer not null check (price_points > 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Commandes de cadeaux
create table public.orders (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id),
  gift_id bigint not null references public.gifts(id),
  price_paid integer not null check (price_paid > 0),
  status text not null default 'en_attente'
    check (status in ('en_attente', 'en_cours', 'donne', 'annule')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_student_idx on public.orders (student_id, created_at desc);

-- Journal des opérations (AJOUT SEUL : jamais de modification ni de suppression)
-- On ne stocke JAMAIS la note, seulement les points gagnés.
create table public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  type text not null
    check (type in ('gain', 'envoi', 'reception', 'depense', 'remboursement', 'annulation')),
  amount integer not null check (amount <> 0),
  eval_type text check (eval_type in ('sommative', 'formative')),
  related_tx bigint references public.transactions(id),
  related_order bigint references public.orders(id),
  counterparty uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index transactions_user_idx on public.transactions (user_id, created_at desc);
create index transactions_related_idx on public.transactions (related_tx);
-- Un échange ne peut être annulé qu'une seule fois (par personne concernée)
create unique index transactions_one_cancel
  on public.transactions (related_tx, user_id) where type = 'annulation';

-- Boîte à idées
create table public.ideas (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'en_attente'
    check (status in ('en_attente', 'acceptee', 'refusee')),
  response text check (char_length(response) <= 500),
  answered_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Tchat privé délégués + suppléants
create table public.chat_messages (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index chat_created_idx on public.chat_messages (created_at);

-- Le journal est immuable : toute modification ou suppression est refusée
create function public.transactions_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Le journal des transactions ne peut pas être modifié.';
end $$;

create trigger transactions_no_update_delete
  before update or delete on public.transactions
  for each row execute function public.transactions_immutable();

create trigger transactions_no_truncate
  before truncate on public.transactions
  for each statement execute function public.transactions_immutable();

-- Le prix d'un cadeau déjà commandé ne peut plus changer
create function public.gifts_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.price_points <> old.price_points
     and exists (select 1 from public.orders where gift_id = old.id) then
    raise exception 'Prix non modifiable : ce cadeau a déjà été commandé.';
  end if;
  new.created_by := old.created_by;
  return new;
end $$;

create trigger gifts_guard_trg
  before update on public.gifts
  for each row execute function public.gifts_guard();
