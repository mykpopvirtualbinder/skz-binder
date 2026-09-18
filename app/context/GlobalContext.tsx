"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import es from "../locales/es.json";
import en from "../locales/en.json";
import fr from "../locales/fr.json";
import de from "../locales/de.json";
import it from "../locales/it.json";
import pt from "../locales/pt.json";
import id from "../locales/id.json";
import th from "../locales/th.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import zh from "../locales/zh.json";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { normalizeThemeId } from "@/lib/theme-unlocks";
import { resolveProfileAvatarUrl } from "@/lib/default-profile-avatar";
import { DEFAULT_SITE_PROFILE_AVATAR_URL } from "@/lib/default-profile-avatar";

const DICTIONARIES: Record<string, any> = { es, en, fr, de, it, pt, id, th, ja, ko, zh };
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

// ✅ Perfil completo
type Profile = {
  id: string;
  /** Email de la sesión Auth (necesario p. ej. para isAdmin en /me). */
  email?: string | null;
  display_name: string | null;
  avatar_url: string | null;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  birthdate?: string | null;
  is_adult?: boolean | null;
  is_premium?: boolean;
  is_artist?: boolean; 
  puntos: number;
  legal_consent?: boolean | null;
  is_restricted?: boolean;
  theme_preference?: string | null; 
  language?: string | null; 
  /** URL del cursor VIP (Skzoo); null si no hay. */
  cursor_url?: string | null;
};

type GlobalContextType = {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  userBiases: number[];
  setUserBiases: (b: number[]) => void;
  refreshGlobal: () => void;
  checkIsBias: (memberId?: number | null, memberName?: string | null) => boolean;
  showAlert: (title: string, message: string, onClose?: () => void) => void;
  showPrompt: (title: string, message: string, onConfirm: (reason: string, isAnonymous: boolean) => void) => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
  t: (path: string, vars?: Record<string, string | number>) => string;
  uiLanguage: string;
};

const GlobalContext = createContext<GlobalContextType | null>(null);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userBiases, setUserBiases] = useState<number[]>([]);
  const [tick, setTick] = useState(0);

  // 🌟 ESTADO GLOBAL DE LA ALERTA 🌟
  const [alertData, setAlertData] = useState<{ title: string, message: string, onClose?: () => void } | null>(null);

  // 🌟 ESTADOS PARA EL PROMPT BONITO 🌟
  const [promptData, setPromptData] = useState<{ title: string, message: string, onConfirm: (r: string, a: boolean) => void } | null>(null);
  const [promptText, setPromptText] = useState("");
  const [promptAnon, setPromptAnon] = useState(false);
  const [confirmData, setConfirmData] = useState<{ title: string, message: string, resolve: (ok: boolean) => void } | null>(null);

  const refreshGlobal = () => setTick((t) => t + 1);
  const getSessionLanguageOverride = () => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("ui:language_override");
    if (!raw) return null;
    const lang = raw.trim().toLowerCase();
    return DICTIONARIES[lang] ? lang : null;
  };

  // 🌟 EL MOTOR DE IDIOMAS 🌟
  const t = useCallback((path: string, vars?: Record<string, string | number>) => {
    const sessionLang = getSessionLanguageOverride();
    const lang = sessionLang || profile?.language || "es";
    const dict = DICTIONARIES[lang] || DICTIONARIES["es"];

    const readPath = (obj: any, dottedPath: string) => {
      const keys = dottedPath.split(".");
      let result = obj;
      for (const key of keys) {
        if (result == null || typeof result !== "object" || result[key] === undefined) return undefined;
        result = result[key];
      }
      return result;
    };

    const applyVars = (value: any) => {
      if (typeof value !== "string" || !vars) return value as any;
      return value.replace(/\{(\w+)\}/g, (_, key: string) =>
        vars[key] === undefined || vars[key] === null ? `{${key}}` : String(vars[key])
      ) as any;
    };

    const localized = readPath(dict, path);
    if (localized !== undefined && localized !== null && localized !== "") return applyVars(localized);

    if (lang !== "en") {
      const fallbackEn = readPath(DICTIONARIES["en"], path);
      if (fallbackEn !== undefined && fallbackEn !== null && fallbackEn !== "") return applyVars(fallbackEn);
    }

    if (lang !== "es") {
      const fallbackEs = readPath(DICTIONARIES["es"], path);
      if (fallbackEs !== undefined && fallbackEs !== null && fallbackEs !== "") return applyVars(fallbackEs);
    }

    return path;
  }, [profile?.language]);

  const uiLanguage = getSessionLanguageOverride() || profile?.language || "es";

  // 🌟 FUNCIÓN PARA LANZAR LA ALERTA 🌟
  const showAlert = useCallback((title: string, message: string, onClose?: () => void) => {
    setAlertData({ title, message, onClose });
  }, []);

  // 🌟 FUNCIÓN PARA LANZAR EL PROMPT 🌟
  const showPrompt = useCallback((title: string, message: string, onConfirm: (reason: string, isAnonymous: boolean) => void) => {
    setPromptText(""); 
    setPromptAnon(false);
    setPromptData({ title, message, onConfirm });
  }, []);

  const showConfirm = useCallback((title: string, message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmData({ title, message, resolve });
    });
  }, []);

  // 🌟 COMPROBACIÓN CENTRALIZADA 🌟
  const checkIsBias = useCallback((memberId?: number | null, memberName?: string | null): boolean => {
    const biasList = (userBiases || []).map(Number);
    if (biasList.length === 0) return false;

    const mid = memberId ? Number(memberId) : null;
    if (mid && (mid === 999 || biasList.includes(mid))) return true;

    if (memberName) {
      const cleanName = memberName.toLowerCase().replace(/[.\-_]/g, " ").trim();
      if (cleanName.includes("ot8")) return true;

      return biasList.some(id => {
        const aliases = MASTER_MEMBER_MAP[id] || [];
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
      const sessionLang = getSessionLanguageOverride();
      const localProfileStr = localStorage.getItem("me:profile");
      if (localProfileStr) {
        try {
          const localParsed = JSON.parse(localProfileStr);
          setProfile(localParsed);
        } catch {
          localStorage.removeItem("me:profile");
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileData) {
          const esVIP = isAdminTeamEmail(user.email);
          const isPremiumUser = profileData.is_premium || esVIP;

          const raw = profileData as Record<string, unknown>;
          const dbCursor = raw.cursor_url;
          let resolvedCursorUrl: string | null = null;
          if (typeof dbCursor === "string" && dbCursor.length > 0) {
            resolvedCursorUrl = dbCursor;
          } else if (dbCursor === null || dbCursor === "") {
            resolvedCursorUrl = null;
          } else {
            try {
              const ls = localStorage.getItem("me:profile");
              if (ls) {
                const p = JSON.parse(ls) as { cursor_url?: string | null };
                if (typeof p.cursor_url === "string" && p.cursor_url.length > 0) {
                  resolvedCursorUrl = p.cursor_url;
                }
              }
            } catch {
              resolvedCursorUrl = null;
            }
          }

          const fullProfile = {
            id: user.id,
            email: user.email ?? null,
            display_name: profileData.display_name || (user.user_metadata as any)?.display_name || "Coleccionista",
            avatar_url: resolveProfileAvatarUrl(
              profileData.avatar_url,
              (user.user_metadata as any)?.avatar_url,
            ),
            full_name: profileData.full_name,
            phone: profileData.phone,
            address: profileData.address,
            birthdate: profileData.birthdate,
            is_adult: profileData.is_adult,
            legal_consent: profileData.legal_consent,
            is_premium: isPremiumUser, 
            is_artist: profileData.is_artist || esVIP,
            is_restricted: profileData.is_restricted || false,
            puntos: profileData.puntos || 0,
            theme_preference: profileData.theme_preference || "pastel",
            language: profileData.language || null,
            cursor_url: resolvedCursorUrl,
          };
          
          setProfile(fullProfile);
          localStorage.setItem("me:profile", JSON.stringify(fullProfile));

          // Auto-fix: si el avatar está vacío, guardar el default en DB (best-effort).
          // Esto cubre usuarios antiguos o registros sin completar perfil.
          if (!profileData.avatar_url) {
            try {
              await supabase
                .from("profiles")
                .update({ avatar_url: DEFAULT_SITE_PROFILE_AVATAR_URL })
                .eq("user_id", user.id);
            } catch {
              /* ignore */
            }
          }
          if (typeof window !== "undefined" && !sessionLang) {
            const profileLang = String(profileData.language || "es").toLowerCase();
            document.cookie = `NEXT_LOCALE=${profileLang}; path=/; max-age=31536000`;
          }

          const localTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
          const preferredTheme = normalizeThemeId(localTheme || profileData.theme_preference || "pastel");
          const activeTheme = isPremiumUser ? preferredTheme : "pastel";
          document.documentElement.setAttribute("data-theme", activeTheme);
          
        } else if (!localProfileStr) {
          const esVIP = isAdminTeamEmail(user.email);
          
          setProfile({
            id: user.id,
            email: user.email ?? null,
            display_name: (user.user_metadata as any)?.display_name || "Coleccionista",
            avatar_url: resolveProfileAvatarUrl(null, (user.user_metadata as any)?.avatar_url),
            is_premium: esVIP,
            is_artist: esVIP,
            puntos: 0,
            theme_preference: "pastel",
            language: "es",
            cursor_url: null,
          } as Profile);
          if (typeof window !== "undefined" && !sessionLang) {
            document.cookie = "NEXT_LOCALE=es; path=/; max-age=31536000";
          }
          document.documentElement.setAttribute("data-theme", "pastel");
        }

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (alertData) {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          if (alertData.onClose) alertData.onClose();
          setAlertData(null);
        }
        return;
      }
      if (promptData) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPromptData(null);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey && promptText.trim()) {
          const target = e.target as HTMLElement | null;
          const tag = (target?.tagName || "").toLowerCase();
          // En textarea requerimos Ctrl/Cmd+Enter para evitar envíos accidentales.
          const isTextarea = tag === "textarea";
          const wantsSubmit = !isTextarea || e.ctrlKey || e.metaKey;
          if (wantsSubmit) {
            e.preventDefault();
            promptData.onConfirm(promptText, promptAnon);
            setPromptData(null);
          }
        }
      }
      if (confirmData) {
        if (e.key === "Escape") {
          e.preventDefault();
          confirmData.resolve(false);
          setConfirmData(null);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          confirmData.resolve(true);
          setConfirmData(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alertData, promptData, promptText, promptAnon, confirmData]);

  return (
    <GlobalContext.Provider 
      value={{ profile, setProfile, userBiases, setUserBiases, refreshGlobal, checkIsBias, t, uiLanguage, showAlert, showPrompt, showConfirm }}
    >
      {children}

      {/* 🌟 EL PRECIOSO MODAL GLOBAL DE ALERTA (TEMATIZADO) 🌟 */}
      {alertData && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 1000000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => { if(alertData.onClose) alertData.onClose(); setAlertData(null); }}>
          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", maxWidth: "400px", width: "100%", textAlign: "center", border: "2px solid var(--color-border)", boxShadow: "0 20px 40px var(--shadow-card)" }} onClick={e => e.stopPropagation()}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 15px 0", fontSize: "24px" }}>{alertData.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 600, marginBottom: "25px", lineHeight: "1.5" }}>{alertData.message}</p>
            <button 
              onClick={() => { if(alertData.onClose) alertData.onClose(); setAlertData(null); }} 
              style={{ background: "var(--color-primary)", color: "white", padding: "12px 30px", borderRadius: "99px", border: "none", fontWeight: 900, cursor: "pointer", width: "100%", fontSize: "14px" }}
            >
              {t('common.understood')}
            </button>
          </div>
        </div>
      )}

      {/* 🌟 EL PRECIOSO MODAL DE ESCRITURA GLOBAL (PROMPT TEMATIZADO) 🌟 */}
      {promptData && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 1000000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setPromptData(null)}>
          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", maxWidth: "450px", width: "100%", border: "2px solid var(--color-border)", boxShadow: "0 20px 40px var(--shadow-card)" }} onClick={e => e.stopPropagation()}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 10px 0", fontSize: "24px" }}>{promptData.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 600, marginBottom: "20px" }}>{promptData.message}</p>

            <textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder={t('global_prompt.placeholder')}
              rows={4}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", marginBottom: "15px", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "25px", background: "var(--bg-soft)", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
              <input type="checkbox" checked={promptAnon} onChange={e => setPromptAnon(e.target.checked)} style={{ accentColor: "var(--color-primary)", width: "18px", height: "18px", cursor: "pointer" }} />
              <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--color-primary)" }}>
                {t('global_prompt.anonymous_report')}
              </span>
            </label>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setPromptData(null)} style={{ flex: 1, background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}>
                {t('common.cancel')}
              </button>
              <button 
                disabled={!promptText.trim()} 
                onClick={() => { promptData.onConfirm(promptText, promptAnon); setPromptData(null); }} 
                style={{ flex: 1, background: "var(--color-primary)", color: "white", border: "none", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: promptText.trim() ? "pointer" : "not-allowed", opacity: promptText.trim() ? 1 : 0.5 }}
              >
                {t('global_prompt.send_report')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmData && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 1000000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => {
            confirmData.resolve(false);
            setConfirmData(null);
          }}
        >
          <div
            style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", maxWidth: "430px", width: "100%", border: "2px solid var(--color-border)", boxShadow: "0 20px 40px var(--shadow-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 10px 0", fontSize: "24px" }}>{confirmData.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 600, marginBottom: "20px", lineHeight: "1.5" }}>{confirmData.message}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  confirmData.resolve(false);
                  setConfirmData(null);
                }}
                style={{ flex: 1, background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  confirmData.resolve(true);
                  setConfirmData(null);
                }}
                style={{ flex: 1, background: "var(--color-primary)", color: "white", border: "none", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

    </GlobalContext.Provider>
  );
}

export const useGlobal = () => {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal debe usarse dentro de un GlobalProvider");
  return ctx;
};