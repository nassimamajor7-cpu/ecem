// État partagé : session, profil, liste des prénoms, solde.
import { supabase } from "./supabase.js";

export const state = {
  session: null,
  profile: null,
  profiles: [],
  balance: 0,
};

export function nameOf(id) {
  const p = state.profiles.find((x) => x.id === id);
  return p ? p.display_name : "?";
}

// Recharge les profils et le solde depuis la base
export async function loadAll() {
  if (!state.session) {
    state.profile = null;
    state.profiles = [];
    state.balance = 0;
    return;
  }
  const [all, bal] = await Promise.all([
    supabase.from("profiles").select("*").order("display_name"),
    supabase.rpc("my_balance"),
  ]);
  state.profiles = all.data ?? [];
  state.profile = state.profiles.find((p) => p.id === state.session.user.id) ?? null;
  state.balance = typeof bal.data === "number" ? bal.data : 0;
}

// Met à jour le solde dans l'en-tête sans recharger la page
export async function refreshBalance() {
  const { data } = await supabase.rpc("my_balance");
  state.balance = typeof data === "number" ? data : 0;
  const el = document.getElementById("solde");
  if (el) el.textContent = `${state.balance} pts`;
}
