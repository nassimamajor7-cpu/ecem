# Points de la classe

Site de points pour une classe de collège (18 comptes) : points gagnés grâce aux notes,
échanges entre élèves, boutique de cadeaux imprimés en 3D, boîte à idées, tchat privé.

**Stack** : HTML + CSS + JavaScript pur (aucune installation, aucun build) et Supabase
(Postgres, Auth, RLS, Realtime). Hébergement : Vercel (site statique).

> L'ancienne version Next.js est conservée sous l'étiquette Git `version-nextjs`.

## Structure

```
index.html            page unique
css/style.css         styles (texte 18 px, fort contraste)
js/config.js          URL + clé publique Supabase
js/main.js            connexion, menu, routeur
js/pages-*.js         pages (élève, délégué, suppléant, tchat, connexion)
supabase/migrations/  scripts SQL (tables, sécurité RLS, fonctions)
```

## Sécurité

- Le solde n'est jamais modifié directement : il est la somme du journal `transactions`
  (ajout seul, modification et suppression interdites par un déclencheur).
- RLS activée sur toutes les tables ; le navigateur n'écrit jamais dans `transactions` ni `orders`.
- Notes, envois, commandes, annulations et remboursements passent par des fonctions SQL (RPC)
  atomiques qui vérifient le rôle et le solde (verrou `FOR UPDATE` contre les doubles clics).
- La note n'est **jamais** stockée, seulement les points.
- Les textes saisis sont affichés avec `textContent` (pas d'injection de code).
- La clé `service_role` n'est utilisée nulle part. `js/config.js` ne contient que la clé publique.

## Déployer sur Vercel

1. https://vercel.com/new → importer le dépôt `ecem`.
2. **Framework Preset : Other**. Laisser vides Build Command et Output Directory.
3. Deploy. Aucune variable d'environnement n'est nécessaire.

## Tester en local

Les modules JavaScript demandent un petit serveur (pas d'ouverture directe du fichier) :

```bash
npx serve .
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
