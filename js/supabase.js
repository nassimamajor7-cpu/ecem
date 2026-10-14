// Client Supabase (chargé depuis un CDN, sans installation).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Adresse fictive interne : l'élève ne tape que son identifiant (ex. "eleve1")
export function loginToEmail(login) {
  const propre = login
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${propre}@classe.local`;
}
