// Types partagés (correspondent aux tables Supabase)
export type Role = "eleve" | "suppleant" | "delegue";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  bloque_idees: boolean;
  must_change_password: boolean;
}

export interface Tx {
  id: number;
  user_id: string;
  type: "gain" | "envoi" | "reception" | "depense" | "remboursement" | "annulation";
  amount: number;
  eval_type: "sommative" | "formative" | null;
  related_tx: number | null;
  related_order: number | null;
  counterparty: string | null;
  created_by: string;
  created_at: string;
}

export interface Gift {
  id: number;
  name: string;
  description: string;
  price_points: number;
  active: boolean;
}

export type OrderStatus = "en_attente" | "en_cours" | "donne" | "annule";

export interface Order {
  id: number;
  student_id: string;
  gift_id: number;
  price_paid: number;
  status: OrderStatus;
  created_at: string;
  gifts: { name: string } | null;
}

export interface Idea {
  id: number;
  author_id: string;
  body: string;
  status: "en_attente" | "acceptee" | "refusee";
  response: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  author_id: string;
  body: string;
  created_at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  eleve: "Élève",
  suppleant: "Suppléant",
  delegue: "Délégué",
};

export const ORDER_LABEL: Record<OrderStatus, string> = {
  en_attente: "En attente",
  en_cours: "En cours d'impression",
  donne: "Donné",
  annule: "Annulé (remboursé)",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
