"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGlobal } from "../context/GlobalContext";
import Footer from "../components/footer";
import { supabase } from "@/lib/supabase";
import { applyPendingSignupProfileIfAny } from "@/lib/pending-signup-profile";
import { Eye, EyeOff, Check } from "lucide-react";

const inputStyle: React.CSSProperties = { 
  width: "100%", 
  padding: "12px", 
  borderRadius: "12px", 
  border: "1px solid var(--color-border)", 
  outline: "none", 
  fontSize: "14px", 
  background: "var(--bg-main)", 
  textAlign: "center",
  boxSizing: "border-box" 
};

export default function LoginPage() {
  const router = useRouter();
  const { t, refreshGlobal } = useGlobal();
  const [isMobile, setIsMobile] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // 👈 NUEVO: Estado del check
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message || "";
      const code = (error as { code?: string }).code;
      if (
        code === "email_not_confirmed" ||
        /confirm|verif|not confirmed|confirmar|correo/i.test(msg)
      ) {
        alert(t("login.error_email_not_confirmed"));
        setShowResendConfirmation(true);
      } else {
        alert(t("login.error_prefix") + msg);
        setShowResendConfirmation(false);
      }
      setLoading(false);
      return;
    }
    setShowResendConfirmation(false);

    const user = data.session?.user;
    if (user) {
      const pendingRes = await applyPendingSignupProfileIfAny(supabase, user);
      if (pendingRes.error) {
        console.error("applyPendingSignupProfileIfAny:", pendingRes.error);
      }
      if (pendingRes.applied) {
        refreshGlobal();
      }
    }

    router.push("/me");
  };

  const handleResetPassword = async () => {
    const emailToReset = prompt(t('login.reset_password_prompt'));
    if (!emailToReset) return;

    if (typeof supabase !== "undefined") {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
        redirectTo: `${window.location.origin}/update-password`, 
      });
      if (error) alert(t('login.error_prefix') + error.message);
      else alert(t('login.reset_password_success'));
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      alert(t("login.resend_confirmation_need_email"));
      return;
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      alert(t("login.error_prefix") + error.message);
      return;
    }
    alert(t("login.resend_confirmation_success"));
  };

  return (
  <div style={{ 
    minHeight: "100vh", 
    display: "flex", 
    flexDirection: "column", 
    backgroundColor: "var(--bg-main)",
    transition: "background-color 0.3s ease" 
  }}>
 
    <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
      <div style={{ 
        background: "var(--bg-card)", 
        padding: isMobile ? "30px 20px" : "40px", 
        borderRadius: "30px", 
        border: "1px solid var(--color-border)", 
        width: "100%", 
        maxWidth: "400px", 
        textAlign: "center",
        // Sombra suave adaptada al tema
        boxShadow: "0 10px 30px var(--shadow-card)",
        transition: "all 0.3s ease"
      }}>
          
  <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: isMobile ? "24px" : "30px", margin: "0 0 5px 0" }}>
  {t("login.welcome")}
</h2>
<p style={{ color: "var(--text-muted)", fontSize: "18px", fontWeight: 800, margin: "0 0 25px 0", fontStyle: "italic" }}>
  {t("login.subtitle_romanized")}
</p>

<form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
  <input 
    type="email" 
    placeholder={t("login.email_placeholder")}
    style={inputStyle} 
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
  />
  
  <div style={{ position: "relative", width: "100%" }}>
    <input 
      type={showPassword ? "text" : "password"} 
      placeholder={t("login.password_placeholder")}
      style={{ ...inputStyle, paddingRight: "40px" }} 
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
    />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", padding: 0 }}
                title={showPassword ? t("login.hide_password") : t("login.show_password")}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

           {/* Checkbox de Mantener Sesión */}
  <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", marginTop: "5px", cursor: "pointer" }} onClick={() => setRememberMe(!rememberMe)}>
    <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: "2px solid var(--color-primary)", background: rememberMe ? "var(--color-primary)" : "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
      {rememberMe && <Check size={14} color="white" strokeWidth={4} />}
    </div>
    <span style={{ fontSize: "13px", color: "var(--color-primary)", fontWeight: 600, userSelect: "none" }}>
      {t("login.remember_me")}
    </span>
  </div>
  
 <button 
  type="submit" 
  className="tan-font" 
  disabled={loading} 
  style={{ 
    background: "var(--color-primary)", 
    color: "white", 
    border: "none", 
    padding: "14px", 
    borderRadius: "15px", 
    marginTop: "10px",
    fontSize: isMobile ? "16px" : "18px", 
    cursor: "pointer",
    // Usamos la variable de sombra del sistema para que no brille en modo oscuro
    boxShadow: "0 4px 15px var(--shadow-card)", 
    opacity: loading ? 0.7 : 1,
    transition: "all 0.2s"
  }}
>
  {loading ? t('login.loading') : t('login.submit_btn')}
</button>
</form>

          <p style={{ marginTop: "25px", fontSize: "13px", color: "var(--color-primary)" }}>
  {t("login.no_account")} <br/>
  <span onClick={() => router.push('/register')} style={{ color: "var(--text-muted)", fontWeight: 900, cursor: "pointer", textDecoration: "underline", display: "inline-block", marginTop: "5px" }}>
    {t("login.register_link")}
  </span>
</p>

<button type="button" onClick={handleResetPassword} style={{ fontSize: "12px", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", marginTop: "15px", fontWeight: 600 }}>
  {t("login.forgot_password")}
</button>
{showResendConfirmation && (
  <button
    type="button"
    onClick={handleResendConfirmation}
    style={{
      fontSize: "12px",
      color: "var(--text-main)",
      background: "var(--bg-soft)",
      border: "1px solid var(--color-border)",
      borderRadius: "10px",
      cursor: "pointer",
      marginTop: "10px",
      fontWeight: 700,
      padding: "8px 12px",
    }}
  >
    {t("login.resend_confirmation_btn")}
  </button>
)}
        </div>
      </main>
      <Footer />
    </div>
  );
}