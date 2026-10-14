// Pages de connexion et de changement de mot de passe.
import { supabase, loginToEmail } from "./supabase.js";
import { h, bouton, carte, champ, zoneMessage } from "./ui.js";

export function pageLogin() {
  const login = h("input", { autocapitalize: "none", autocorrect: "off", autocomplete: "username", required: true });
  const mdp = h("input", { type: "password", autocomplete: "current-password", required: true });
  const msg = zoneMessage();
  const btn = bouton("Se connecter", { type: "submit", large: true });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.afficher("", "");
      const { error } = await supabase.auth.signInWithPassword({
        email: loginToEmail(login.value),
        password: mdp.value,
      });
      if (error) msg.afficher("erreur", "Identifiant ou mot de passe incorrect.");
      btn.disabled = false;
    },
  }, champ("Identifiant", login), champ("Mot de passe", mdp), msg, btn);

  return carte(h("h1", {}, "Points de la classe"), form);
}

export function pageMotDePasse(apres) {
  const p1 = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: "8" });
  const p2 = h("input", { type: "password", autocomplete: "new-password", required: true });
  const msg = zoneMessage();
  const btn = bouton("Enregistrer", { type: "submit", large: true });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      msg.afficher("", "");
      if (p1.value.length < 8) return msg.afficher("erreur", "Le mot de passe doit faire au moins 8 caractères.");
      if (p1.value !== p2.value) return msg.afficher("erreur", "Les deux mots de passe ne sont pas identiques.");
      btn.disabled = true;
      const r1 = await supabase.auth.updateUser({ password: p1.value });
      if (r1.error) {
        btn.disabled = false;
        return msg.afficher("erreur", r1.error.message);
      }
      const r2 = await supabase.rpc("mark_password_changed");
      if (r2.error) {
        btn.disabled = false;
        return msg.afficher("erreur", r2.error.message);
      }
      await apres();
    },
  },
    champ("Nouveau mot de passe (8 caractères minimum)", p1),
    champ("Répète le mot de passe", p2),
    msg,
    btn,
  );

  return carte(
    h("h1", {}, "Choisis ton mot de passe"),
    h("p", { class: "notice info" }, "C'est ta première connexion : tu dois choisir ton propre mot de passe."),
    form,
  );
}
