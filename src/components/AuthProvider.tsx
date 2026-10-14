"use client";
// Fournit la session, le profil, la liste des prénoms et le solde à toute l'application.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface AuthState {
  loading: boolean;
  signedIn: boolean;
  profile: Profile | null;
  profiles: Profile[];
  balance: number;
  refresh: () => Promise<void>;
  nameOf: (id: string | null) => string;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth hors AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [balance, setBalance] = useState(0);

  // 1) On écoute la connexion / déconnexion
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async (id: string) => {
    const [all, bal] = await Promise.all([
      supabase.from("profiles").select("*").order("display_name"),
      supabase.rpc("my_balance"),
    ]);
    const list = (all.data ?? []) as Profile[];
    setProfiles(list);
    setProfile(list.find((p) => p.id === id) ?? null);
    setBalance(typeof bal.data === "number" ? bal.data : 0);
  }, []);

  // 2) Dès qu'on connaît l'utilisateur, on charge ses données
  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      setProfile(null);
      setProfiles([]);
      setBalance(0);
      setDataReady(true);
      return;
    }
    setDataReady(false);
    load(userId).finally(() => setDataReady(true));
  }, [authReady, userId, load]);

  const refresh = useCallback(async () => {
    if (userId) await load(userId);
  }, [userId, load]);

  const nameOf = useCallback(
    (id: string | null) => profiles.find((p) => p.id === id)?.display_name ?? "?",
    [profiles],
  );

  return (
    <Ctx.Provider
      value={{
        loading: !authReady || !dataReady,
        signedIn: !!userId,
        profile,
        profiles,
        balance,
        refresh,
        nameOf,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
