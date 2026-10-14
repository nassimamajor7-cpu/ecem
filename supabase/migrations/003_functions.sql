-- 003 : fonctions serveur (RPC). Chacune vérifie rôle, solde et règles,
-- puis fait tout en une seule transaction atomique.
-- Anti double-clic : on verrouille la ligne du profil (FOR UPDATE) avant de lire le solde.

-- Solde interne (non appelable depuis le navigateur)
create function public._balance(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::integer from public.transactions where user_id = p_user
$$;
revoke all on function public._balance(uuid) from public, anon, authenticated;

-- Mon solde
create function public.my_balance() returns integer
language sql stable security definer set search_path = '' as $$
  select public._balance((select auth.uid()))
$$;

-- Saisie d'une note par un délégué. La note n'est PAS stockée, seulement les points.
create function public.enter_grade(p_student uuid, p_eval_type text, p_note numeric)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_note numeric;
  v_pts integer;
begin
  if auth.uid() is null or public.app_role() is distinct from 'delegue' then
    raise exception 'Réservé aux délégués.';
  end if;
  if p_student = auth.uid() then
    raise exception 'Tu ne peux pas saisir ta propre note : c''est l''autre délégué qui doit le faire.';
  end if;
  if not exists (select 1 from public.profiles where id = p_student) then
    raise exception 'Élève introuvable.';
  end if;
  if p_note is null then
    raise exception 'Note manquante.';
  end if;

  v_note := round(p_note, 1);  -- arrondi à une décimale avant le calcul

  if p_eval_type = 'sommative' then
    if v_note < 0 or v_note > 20 then
      raise exception 'Une note sommative doit être entre 0 et 20.';
    end if;
    v_pts := case when v_note >= 19.5 then 3
                  when v_note >= 18.5 then 2
                  when v_note >= 17 then 1
                  else 0 end;
  elsif p_eval_type = 'formative' then
    if v_note < 0 or v_note > 10 then
      raise exception 'Une note formative doit être entre 0 et 10.';
    end if;
    v_pts := case when v_note >= 9 then 1 else 0 end;
  else
    raise exception 'Type d''évaluation inconnu.';
  end if;

  if v_pts > 0 then
    insert into public.transactions (user_id, type, amount, eval_type, created_by)
    values (p_student, 'gain', v_pts, p_eval_type, auth.uid());
  end if;
  return v_pts;
end $$;

-- Envoi de points à un autre élève
create function public.send_points(p_to uuid, p_amount integer) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_envoi bigint;
begin
  if v_me is null then raise exception 'Non connecté.'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant doit être un nombre positif.';
  end if;
  if p_to = v_me then raise exception 'Tu ne peux pas t''envoyer des points à toi-même.'; end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'Destinataire introuvable.';
  end if;

  perform 1 from public.profiles where id = v_me for update;  -- verrou anti double-dépense
  if public._balance(v_me) < p_amount then
    raise exception 'Solde insuffisant.';
  end if;

  insert into public.transactions (user_id, type, amount, counterparty, created_by)
  values (v_me, 'envoi', -p_amount, p_to, v_me)
  returning id into v_envoi;

  insert into public.transactions (user_id, type, amount, counterparty, related_tx, created_by)
  values (p_to, 'reception', p_amount, v_me, v_envoi, v_me);

  return v_envoi;
end $$;

-- Annulation d'un échange par un délégué (écrit l'opération inverse)
create function public.cancel_exchange(p_envoi bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_env public.transactions%rowtype;
  v_amount integer;
begin
  if auth.uid() is null or public.app_role() is distinct from 'delegue' then
    raise exception 'Réservé aux délégués.';
  end if;

  select * into v_env from public.transactions where id = p_envoi and type = 'envoi';
  if not found then raise exception 'Échange introuvable.'; end if;
  v_amount := -v_env.amount;  -- montant positif envoyé

  -- verrouille les deux profils dans un ordre fixe (évite les blocages croisés)
  perform 1 from public.profiles
    where id in (v_env.user_id, v_env.counterparty) order by id for update;

  if exists (select 1 from public.transactions
             where related_tx = p_envoi and type = 'annulation') then
    raise exception 'Cet échange est déjà annulé.';
  end if;

  if public._balance(v_env.counterparty) < v_amount then
    raise exception 'Annulation refusée : le destinataire n''a plus assez de points.';
  end if;

  insert into public.transactions (user_id, type, amount, counterparty, related_tx, created_by)
  values (v_env.counterparty, 'annulation', -v_amount, v_env.user_id, p_envoi, auth.uid());
  insert into public.transactions (user_id, type, amount, counterparty, related_tx, created_by)
  values (v_env.user_id, 'annulation', v_amount, v_env.counterparty, p_envoi, auth.uid());
end $$;

-- Commande d'un cadeau : les points sont retirés définitivement
create function public.order_gift(p_gift bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_gift public.gifts%rowtype;
  v_order bigint;
begin
  if v_me is null then raise exception 'Non connecté.'; end if;

  perform 1 from public.profiles where id = v_me for update;  -- verrou anti double-dépense

  select * into v_gift from public.gifts where id = p_gift and active;
  if not found then raise exception 'Ce cadeau n''est plus disponible.'; end if;

  if public._balance(v_me) < v_gift.price_points then
    raise exception 'Solde insuffisant.';
  end if;

  insert into public.orders (student_id, gift_id, price_paid)
  values (v_me, v_gift.id, v_gift.price_points)
  returning id into v_order;

  insert into public.transactions (user_id, type, amount, related_order, created_by)
  values (v_me, 'depense', -v_gift.price_points, v_order, v_me);

  return v_order;
end $$;

-- Suivi d'une commande par un suppléant (annulation = remboursement automatique)
create function public.set_order_status(p_order bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ord public.orders%rowtype;
begin
  if auth.uid() is null or public.app_role() is distinct from 'suppleant' then
    raise exception 'Réservé aux suppléants.';
  end if;

  select * into v_ord from public.orders where id = p_order for update;
  if not found then raise exception 'Commande introuvable.'; end if;

  if v_ord.status in ('donne', 'annule') then
    raise exception 'Cette commande est terminée, elle ne peut plus changer.';
  end if;

  if p_status = 'en_cours' and v_ord.status = 'en_attente' then
    null;
  elsif p_status = 'donne' and v_ord.status = 'en_cours' then
    null;
  elsif p_status = 'annule' then
    insert into public.transactions (user_id, type, amount, related_order, created_by)
    values (v_ord.student_id, 'remboursement', v_ord.price_paid, v_ord.id, auth.uid());
  else
    raise exception 'Changement de statut impossible.';
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order;
end $$;

-- Réponse d'un délégué à une idée
create function public.answer_idea(p_idea bigint, p_status text, p_response text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.app_role() is distinct from 'delegue' then
    raise exception 'Réservé aux délégués.';
  end if;
  if p_status not in ('acceptee', 'refusee') then
    raise exception 'Réponse invalide.';
  end if;
  update public.ideas
     set status = p_status,
         response = nullif(left(coalesce(p_response, ''), 500), ''),
         answered_by = auth.uid()
   where id = p_idea and status = 'en_attente';
  if not found then raise exception 'Idée introuvable ou déjà traitée.'; end if;
end $$;

-- Blocage / déblocage de l'envoi d'idées
create function public.set_idea_block(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.app_role() is distinct from 'delegue' then
    raise exception 'Réservé aux délégués.';
  end if;
  update public.profiles set bloque_idees = p_blocked
   where id = p_user and role <> 'delegue';
  if not found then raise exception 'Élève introuvable.'; end if;
end $$;

-- Après le changement du mot de passe provisoire
create function public.mark_password_changed() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set must_change_password = false where id = (select auth.uid())
$$;

-- Seuls les utilisateurs connectés peuvent appeler ces fonctions
revoke all on function
  public.my_balance(), public.enter_grade(uuid, text, numeric),
  public.send_points(uuid, integer), public.cancel_exchange(bigint),
  public.order_gift(bigint), public.set_order_status(bigint, text),
  public.answer_idea(bigint, text, text), public.set_idea_block(uuid, boolean),
  public.mark_password_changed()
from public, anon;
grant execute on function
  public.my_balance(), public.enter_grade(uuid, text, numeric),
  public.send_points(uuid, integer), public.cancel_exchange(bigint),
  public.order_gift(bigint), public.set_order_status(bigint, text),
  public.answer_idea(bigint, text, text), public.set_idea_block(uuid, boolean),
  public.mark_password_changed()
to authenticated;
