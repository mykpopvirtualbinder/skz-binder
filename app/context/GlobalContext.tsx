"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// 1. DICCIONARIO MAESTRO (La única fuente de verdad para nombres)
const MASTER_MEMBER_MAP: Record<number, string[]> = {
  1: ["hyunjin"],
  2: ["changbin"],
  3: ["han"],
  4: ["bang chan", "bangchan", "chan"],
  5: ["seungmin"],
  6: ["lee know", "leeknow", "minho"],
  7: ["felix", "yongbok"],
  8: ["i.n", "in", "jeongin"]
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type GlobalContextType = {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  userBiases: number[];
  setUserBiases: (b: number[]) => void;
  refreshGlobal: () => void;
  // Añadimos la función de comprobación al tipo
  checkIsBias: (memberId?: number | null, memberName?: string | null) => boolean;
};

const GlobalContext = createContext<GlobalContextType | null>(null);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userBiases, setUserBiases] = useState<number[]>([]);
  const [tick, setTick] = useState(0);

  const refreshGlobal = () => setTick((t) => t + 1);

  // 2. FUNCIÓN DE COMPROBACIÓN CENTRALIZADA
  const checkIsBias = useCallback((memberId?: number | null, memberName?: string | null): boolean => {
    const biasList = (userBiases || []).map(Number);
    if (biasList.length === 0) return false;

    // REGLA A: Por ID (La más segura)
    const mid = memberId ? Number(memberId) : null;
    // 999 es nuestro código para "marcado manual como bias" en PCs personalizadas
    if (mid && (mid === 999 || biasList.includes(mid))) return true;

    // REGLA B: Por Nombre (Fallback exacto)
    if (memberName) {
      const cleanName = memberName.toLowerCase().replace(/[.\-_]/g, " ").trim();
      
      // Si la carta es OT8, ponemos corazón si el usuario tiene algún bias seleccionado
      if (cleanName.includes("ot8")) return true;

      // Comprobar contra el mapa maestro usando los IDs que el usuario tiene activos
      return biasList.some(id => {
        const aliases = MASTER_MEMBER_MAP[id] || [];
        // Buscamos coincidencia exacta de palabra para evitar "Han" en "Changbin"
        return aliases.some(alias => {
          const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
          return regex.test(cleanName);
        });
      });
    }

    return false;
  }, [userBiases]);

  useEffect(() => {
    const loadGlobalData = async () => {
      // 1. Cargar Perfil
      const localProfileStr = localStorage.getItem("me:profile");
      if (localProfileStr) {
        setProfile(JSON.parse(localProfileStr));
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (user) {
        if (!localProfileStr) {
          setProfile({
            id: user.id,
            display_name: (user.user_metadata as any)?.display_name || "Coleccionista",
            avatar_url: (user.user_metadata as any)?.avatar_url || null,
          });
        }

        // 2. Cargar Bias desde Supabase
        const { data: biasData } = await supabase
          .from("user_biases")
          .select("member_id")
          .eq("user_id", user.id);

        if (biasData) {
          setUserBiases(biasData.map(b => Number(b.member_id))); 
        }
      }
    };

    loadGlobalData();
  }, [tick]);

  return (
    <GlobalContext.Provider 
      value={{ 
        profile, 
        setProfile, 
        userBiases, 
        setUserBiases, 
        refreshGlobal,
        checkIsBias // Exportamos la función para que BinderClient la use
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
}

export const useGlobal = () => {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal debe usarse dentro de un GlobalProvider");
  return ctx;
};