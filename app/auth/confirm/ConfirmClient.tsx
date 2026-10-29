"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Footer from "@/app/components/footer";
import { useGlobal } from "@/app/context/GlobalContext";
import { applyPendingSignupProfileIfAny } from "@/lib/pending-signup-profile";
import { supabase } from "@/lib/supabase";

type AuthOtpType = "signup" | "magiclink" | "recovery";

type ConfirmResult = { ok: true; user: User; type: AuthOtpType } | { ok: false };

const TYPES = new Set<AuthOtpType>(["signup", "magiclink", "recovery"]);
const confirmations = new Map<string, Promise<ConfirmResult>>();

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  try {
    const url = new URL(value, "https://www.mykpopbinder.com");
    if (url.origin !== "https://www.mykpopbinder.com") return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function confirmOnce(tokenHash: string, type: AuthOtpType): Promise<ConfirmResult> {
  const key = `${type}:${tokenHash}`;
  const existing = confirmations.get(key);
  if (existing) return existing;
  const pending = (async (): Promise<ConfirmResult> => {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    const user = data.user || data.session?.user || null;
    if (!error && user) return { ok: true, user, type };
    confirmations.delete(key);
    return { ok: false };
  })();
  confirmations.set(key, pending);
  return pending;
}

export default function ConfirmClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useGlobal();
  const [error, setError] = useState(false);

  useEffect(() => {
    const tokenHash = (params.get("token_hash") || "").trim();
    const rawType = params.get("type") || "";
    const type = TYPES.has(rawType as AuthOtpType) ? (rawType as AuthOtpType) : null;
    if (!tokenHash || !type) {
      setError(true);
      return;
    }

    let active = true;
    void confirmOnce(tokenHash, type).then(async (result) => {
      if (!active) return;
      if (!result.ok) {
        setError(true);
        return;
      }
      if (result.type !== "recovery") {
        await applyPendingSignupProfileIfAny(supabase, result.user);
      }
      if (!active) return;
      const next = safeNext(params.get("next"));
      const dest = result.type === "recovery" ? "/update-password" : next && next !== "/login" ? next : "/me";
      router.replace(dest);
    });

    return () => {
      active = false;
    };
  }, [params, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-main)" }}>
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <div style={{ background: "var(--bg-card)", padding: "40px", borderRadius: "30px", border: "1px solid var(--color-border)", width: "100%", maxWidth: "420px", textAlign: "center", boxShadow: "0 10px 30px var(--shadow-card)" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "28px", margin: "0 0 12px 0" }}>
            {t("auth_confirm.title")}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", lineHeight: 1.5, margin: "0 0 22px 0" }}>
            {error ? t("auth_confirm.error") : t("auth_confirm.working")}
          </p>
          {error ? (
            <Link href="/login" style={{ display: "inline-block", background: "var(--color-primary)", color: "white", textDecoration: "none", padding: "12px 18px", borderRadius: "15px", fontWeight: 900 }}>
              {t("auth_confirm.login")}
            </Link>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
