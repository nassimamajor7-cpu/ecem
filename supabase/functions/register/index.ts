// Fonction serveur "register" : inscription avec code selon le rôle.
// La clé service_role est fournie automatiquement par Supabase à cette fonction
// (variable d'environnement) : elle n'apparaît jamais dans le code ni sur GitHub.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const { prenom, password, role, code } = await req.json();

    const nom = String(prenom ?? "").trim().replace(/\s+/g, " ");
    const login = normalize(nom);
    if (!nom || nom.length > 40 || login.length < 2) {
      return json({ error: "Écris ton prénom (2 lettres minimum)." }, 400);
    }
    if (typeof password !== "string" || password.length < 8) {
      return json({ error: "Le mot de passe doit faire au moins 8 caractères." }, 400);
    }
    if (!["eleve", "suppleant", "delegue"].includes(role)) {
      return json({ error: "Rôle invalide." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Vérification du code, des places et de la limite d'essais
    const { data: verdict, error: e0 } = await admin.rpc("register_precheck", {
      p_role: role,
      p_code: String(code ?? ""),
    });
    if (e0) return json({ error: "Erreur du serveur, réessaie plus tard." }, 500);
    if (verdict === "throttled") {
      return json({ error: "Trop d'essais incorrects. Réessaie dans 10 minutes." }, 429);
    }
    if (verdict === "bad_code") return json({ error: "Code incorrect." }, 403);
    if (verdict === "full") {
      return json({ error: "Il n'y a plus de place pour ce rôle." }, 409);
    }

    // 2) Création du compte (adresse fictive, jamais vue par l'élève)
    const { data: created, error: e1 } = await admin.auth.admin.createUser({
      email: `${login}@classe.local`,
      password,
      email_confirm: true,
    });
    if (e1 || !created.user) {
      const dejaPris = /already|registered|exists/i.test(e1?.message ?? "");
      return json(
        {
          error: dejaPris
            ? "Ce prénom est déjà pris. Ajoute une initiale (ex. : Lea M)."
            : "Impossible de créer le compte : " + (e1?.message ?? "erreur inconnue"),
        },
        dejaPris ? 409 : 400,
      );
    }

    // 3) Création du profil (le rôle est fixé ici, côté serveur)
    const { error: e2 } = await admin.from("profiles").insert({
      id: created.user.id,
      display_name: nom,
      role,
      must_change_password: false,
    });
    if (e2) {
      await admin.auth.admin.deleteUser(created.user.id); // on annule proprement
      const dejaPris = /duplicate|unique/i.test(e2.message);
      return json(
        { error: dejaPris ? "Ce prénom est déjà pris. Ajoute une initiale (ex. : Lea M)." : e2.message },
        dejaPris ? 409 : 400,
      );
    }

    return json({ ok: true, login });
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }
});
