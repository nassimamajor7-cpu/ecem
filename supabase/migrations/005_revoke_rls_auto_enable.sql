-- 005 : cette fonction fournie par Supabase ne doit pas être appelable depuis l'API
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
