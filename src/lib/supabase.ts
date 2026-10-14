// Client Supabase côté navigateur : utilise UNIQUEMENT la clé publique "anon".
// La clé "service_role" n'est jamais utilisée dans ce projet.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Adresse fictive interne : l'élève ne tape que son identifiant (ex. "eleve1")
export function loginToEmail(login: string): string {
  const propre = login
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${propre}@classe.local`;
}
