"use client";
import React, { useEffect, useState } from "react";
import { useGlobal } from "../context/GlobalContext"; // 👈 Importamos el contexto
import { supabase } from "@/lib/supabase";
import { getThemeUnlockCost, isVipThemeKey, normalizeThemeId, unlockKeyForTheme } from "@/lib/theme-unlocks";

const THEMES = [
  { key: "pastel", label: "Soft Pastel" },
  { key: "dark", label: "Midnight Neon" },
  { key: "vibrant", label: "Anime Vibrant" },
  { key: "minimal", label: "Korean Café" },
  { key: "k_pride", label: "K-Pride" },
  { key: "iris_bloom", label: "Iris Bloom" },
];

export default function ThemeSelector() {
  const { t, profile, showAlert, showConfirm } = useGlobal(); // 👈 Extraemos t()
  const [theme, setTheme] = useState("pastel");

  useEffect(() => {
    const savedRaw = typeof window !== "undefined" && localStorage.getItem("theme");
    const saved = savedRaw ? normalizeThemeId(savedRaw) : "";
    if (saved && THEMES.some(t => t.key === saved)) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const run = async () => {
      const value = normalizeThemeId(e.target.value);
      const needsUnlock = isVipThemeKey(value) && !profile?.is_premium;
      if (needsUnlock) {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData.user?.id;
        if (!uid) return;
        const unlockKey = unlockKeyForTheme(value);
        const { data: existing } = await supabase
          .from("user_vip_unlocks")
          .select("id")
          .eq("user_id", uid)
          .eq("unlock_key", unlockKey)
          .maybeSingle();
        if (!existing) {
          const cost = getThemeUnlockCost(value);
          const balance = Number(profile?.puntos || 0);
          if (balance < cost) {
            showAlert(t("common.error"), t("vip.unlock_theme_need", { cost }));
            return;
          }
          const ok = await showConfirm(
            t("shop.confirm_modal.btn_confirm"),
            t("vip.unlock_theme_confirm", { name: t(`theme_selector.themes.${value}`), cost }),
          );
          if (!ok) return;
          const { error: unlockErr } = await supabase
            .from("user_vip_unlocks")
            .upsert({ user_id: uid, unlock_key: unlockKey }, { onConflict: "user_id,unlock_key" });
          if (unlockErr) {
            showAlert(t("common.error"), unlockErr.message);
            return;
          }
          const nextKoins = Math.max(0, balance - cost);
          await supabase.from("profiles").update({ puntos: nextKoins }).eq("user_id", uid);
        }
      }
      setTheme(value);
      document.documentElement.setAttribute("data-theme", value);
      localStorage.setItem("theme", value);
      window.dispatchEvent(new Event('themeChange')); // 👈 Avisamos al resto de la app
    };
    void run();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 700 }}>
        {t('settings.theme')}
      </span>
      <select 
        value={theme} 
        onChange={handleChange} 
        style={{ 
          borderRadius: 8, 
          padding: "4px 8px", 
          fontSize: 14,
          backgroundColor: "var(--bg-card)", // 👈 Fondo adaptable
          color: "var(--text-main)",         // 👈 Texto adaptable
          border: "1px solid var(--color-border)", // 👈 Borde adaptable
          outline: "none",
          cursor: "pointer"
        }}
      >
        {THEMES.map(t_obj => (
          <option key={t_obj.key} value={t_obj.key}>
            {t(`theme_selector.themes.${t_obj.key}`)}
          </option>
        ))}
      </select>
    </div>
  );
}