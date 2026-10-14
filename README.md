# Points de la classe

Site de points pour une classe de collège (18 comptes) : points gagnés grâce aux notes,
échanges entre élèves, boutique de cadeaux imprimés en 3D, boîte à idées, tchat privé.

**Stack** : Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, RLS, Realtime), Vercel.

## Sécurité

- Le solde n'est jamais modifié directement : il est la somme du journal `transactions`
  (ajout seul, modification et suppression interdites par un déclencheur).
- RLS activée sur toutes les tables ; le navigateur n'écrit jamais dans `transactions` ni `orders`.
- Notes, envois, commandes, annulations et remboursements passent par des fonctions SQL (RPC)
  atomiques qui vérifient le rôle et le solde (verrou `FOR UPDATE` contre les doubles clics).
- La note n'est **jamais** stockée, seulement les points.
- La clé `service_role` n'est utilisée nulle part dans le projet.

## Base de données

Les scripts sont dans `supabase/migrations/` (à appliquer dans l'ordre 001 → 005).

## Lancer en local

```bash
npm install
npm run dev
```

Créer `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Renommer un compte

Dans l'éditeur SQL de Supabase (exemple : `eleve1` devient « Yanis ») :

```sql
update public.profiles set display_name = 'Yanis'
 where id = (select id from auth.users where email = 'eleve1@classe.local');
```

L'identifiant de connexion (`eleve1`) reste le même ; seul le prénom affiché change.

## Réglages à faire dans le tableau de bord Supabase

- Authentication → désactiver « Allow new users to sign up » (par sécurité ; un compte sans profil ne voit de toute façon rien).
- Authentication → activer la protection contre les mots de passe compromis si l'offre le permet.
