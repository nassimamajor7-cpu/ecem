-- 004 : un compte Auth sans profil (inscription sauvage) ne voit plus rien
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (public.app_role() is not null);

drop policy gifts_select on public.gifts;
create policy gifts_select on public.gifts
  for select to authenticated using (
    public.app_role() is not null and (active or public.app_role() = 'suppleant')
  );
