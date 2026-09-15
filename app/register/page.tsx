"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import Footer from "../components/footer";
import { supabase } from "@/lib/supabase";
import { syncProfileBiasesAfterSignup } from "@/lib/onboarding-profile-biases";
import { savePendingSignupProfile, type PendingSignupProfilePayload } from "@/lib/pending-signup-profile";
import { DEFAULT_SITE_PROFILE_AVATAR_URL } from "@/lib/default-profile-avatar";
import { OnboardingForm } from "../me/ui/OnboardingForm";
import { useGlobal } from "../context/GlobalContext"; // 👈 Añadido para las traducciones

export default function RegisterPage() {
  const router = useRouter();
  const { t, refreshGlobal, showAlert } = useGlobal();
  const [step, setStep] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGoToLoginAfterSignupIssue, setShowGoToLoginAfterSignupIssue] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "", firstName: "", lastName: "", email: "",
    password: "", phone: "", address: "", acceptTerms: false
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("register:draft");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setFormData((prev) => ({
        ...prev,
        username: String(parsed?.username ?? prev.username),
        firstName: String(parsed?.firstName ?? prev.firstName),
        lastName: String(parsed?.lastName ?? prev.lastName),
        email: String(parsed?.email ?? prev.email),
        password: String(parsed?.password ?? prev.password),
        phone: String(parsed?.phone ?? prev.phone),
        address: String(parsed?.address ?? prev.address),
        acceptTerms: Boolean(parsed?.acceptTerms ?? prev.acceptTerms),
      }));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("register:draft", JSON.stringify(formData));
    } catch {
      // no-op
    }
  }, [formData]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 1. Función que calcula la edad
  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // 2. Manejo del registro final
  const handleFinalRegister = async (onboardingData: {
    biasesIds: number[];
    selectedGroupIds: number[];
    birthdate: string;
    hasConsent: boolean;
    language?: string;
  }) => {
    setLoading(true);
    setShowGoToLoginAfterSignupIssue(false);
    try {
      const emailLower = formData.email.trim().toLowerCase();
      const isConfirmationEmailSendError = (msg: string) =>
        /error sending confirmation email|confirmation email|failed to send email|smtp|mailer/i.test(msg);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        },
      });
      const user = authData.user;
      const authErrorMsg = authError?.message || "";
      const confirmEmailIssue = Boolean(authError && isConfirmationEmailSendError(authErrorMsg));
      if (authError && !user && !confirmEmailIssue) throw authError;
      if (!user && !confirmEmailIssue) throw new Error(t("register.alerts.error_profile"));

      const isAdult = calculateAge(onboardingData.birthdate) >= 18;
      const session = authData.session;
      const needsEmailConfirmation = !session || confirmEmailIssue;

      if (needsEmailConfirmation) {
        const pending: PendingSignupProfilePayload = {
          v: 1,
          userId: user?.id ?? null,
          emailLower,
          displayName: formData.username,
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          address: formData.address,
          birthdate: onboardingData.birthdate,
          isAdult,
          legalConsent: onboardingData.hasConsent,
          ...(onboardingData.language ? { language: onboardingData.language } : {}),
          biasesIds: onboardingData.biasesIds,
          selectedGroupIds: onboardingData.selectedGroupIds ?? [],
        };
        savePendingSignupProfile(pending);
        sessionStorage.removeItem("register:draft");
        if (!authError) {
          showAlert(t("register.alert_title_verify_email"), t("register.alert_verify_email"), () => {
            router.push("/login");
          });
        } else {
          setShowGoToLoginAfterSignupIssue(true);
          showAlert(
            t("register.alert_title_verify_email"),
            t("register.alert_verify_email_with_issue").replace("{error}", authErrorMsg || t("common.error")),
            () => {
              router.push("/login");
            }
          );
        }
        return;
      }

      if (!user) {
        throw new Error(t("register.alerts.error_profile"));
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: formData.username,
          full_name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          address: formData.address,
          birthdate: onboardingData.birthdate,
          is_adult: isAdult,
          legal_consent: onboardingData.hasConsent,
          avatar_url: DEFAULT_SITE_PROFILE_AVATAR_URL,
          ...(onboardingData.language ? { language: onboardingData.language } : {}),
        })
        .eq("user_id", user.id);

      if (profileError) {
        console.error("Error guardando perfil:", profileError);
        throw new Error(t("register.alerts.error_profile"));
      }

      if (onboardingData.biasesIds.length > 0) {
        const biasRows = onboardingData.biasesIds.map((id) => ({ user_id: user.id, member_id: id }));
        const { error: ubErr } = await supabase.from("user_biases").insert(biasRows);
        if (ubErr) {
          console.error("user_biases insert:", ubErr);
          throw new Error(ubErr.message || String(ubErr));
        }
      }

      const syncRes = await syncProfileBiasesAfterSignup(
        supabase,
        user.id,
        onboardingData.biasesIds,
        onboardingData.selectedGroupIds ?? [],
      );
      if (syncRes.error) {
        console.error("syncProfileBiasesAfterSignup:", syncRes.error);
      }

      refreshGlobal();
      sessionStorage.removeItem("register:draft");
      showAlert(t("register.alert_title_success"), t("register.alert_success"), () => {
        router.push("/me");
      });
    } catch (err: any) {
      showAlert(t("common.error"), t("register.alert_error_prefix") + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      showAlert(t("register.alert_title_validation"), t("register.alert_password"));
      return;
    }
    if (!formData.acceptTerms) {
      showAlert(t("register.alert_title_validation"), t("register.alert_terms"));
      return;
    }
    setStep(2);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-main)", transition: "background-color 0.3s ease" }}>
    
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: isMobile ? "20px" : "40px 20px" }}>
        
        {step === 1 && (
          <div style={formContainerStyle(isMobile)}>
            <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: isMobile ? "24px" : "32px", textAlign: "center", marginBottom: "10px" }}>
              {t("register.step1_title")}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "30px", fontWeight: 600 }}>
              {t("register.step1_subtitle")}
            </p>

            <form onSubmit={handleNextStep} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input value={formData.username} placeholder={t("register.placeholder_username")} required style={inputStyle} onChange={(e) => setFormData({...formData, username: e.target.value})} />
              <div style={{ display: "flex", gap: "10px" }}>
                <input value={formData.firstName} placeholder={t("register.placeholder_firstname")} required style={{ ...inputStyle, flex: 1 }} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                <input value={formData.lastName} placeholder={t("register.placeholder_lastname")} required style={{ ...inputStyle, flex: 1 }} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
              </div>
              <input type="email" value={formData.email} placeholder={t("register.placeholder_email")} required style={inputStyle} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("register.placeholder_password")}
                  required
                  autoComplete="new-password"
                  value={formData.password}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    padding: "4px",
                  }}
                  title={showPassword ? t("login.hide_password") : t("login.show_password")}
                  aria-label={showPassword ? t("login.hide_password") : t("login.show_password")}
                >
                  {showPassword ? <EyeOff size={20} strokeWidth={2.2} /> : <Eye size={20} strokeWidth={2.2} />}
                </button>
              </div>
              
              <hr style={{ border: "0.5px solid var(--color-border)", margin: "10px 0" }} />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 900, textAlign: "center", textTransform: "uppercase" }}>
                {t("register.shipping_data_title")}
              </p>
              
              <input value={formData.phone} placeholder={t("register.placeholder_phone")} style={inputStyle} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <textarea value={formData.address} placeholder={t("register.placeholder_address")} style={{ ...inputStyle, height: "60px", resize: "none" }} onChange={(e) => setFormData({...formData, address: e.target.value})} />

              <label style={{ display: "flex", gap: "10px", alignItems: "start", cursor: "pointer", marginTop: "10px" }}>
                <input type="checkbox" checked={formData.acceptTerms} required onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})} />
                <span style={{ fontSize: "12px", color: "var(--text-main)", textAlign: "left" }}>
                  {t("register.privacy_accept")}{" "}
                  <b onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} style={{ textDecoration: "underline", color: "var(--color-primary)" }}>{t("register.privacy_link")}</b>. *
                </span>
              </label>

              <button type="submit" className="tan-font" style={buttonStyle(isMobile)}>
                {t("register.btn_next")}
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div style={{ width: "100%", maxWidth: "1000px" }}>
            <OnboardingForm onComplete={handleFinalRegister} />
            {showGoToLoginAfterSignupIssue && (
              <button
                onClick={() => router.push("/login")}
                style={{
                  ...buttonStyle(isMobile),
                  marginTop: "10px",
                  background: "var(--bg-soft)",
                  color: "var(--text-main)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("login.submit_btn")}
              </button>
            )}
            <button onClick={() => setStep(1)} style={btnBackStyle}>
              {t("register.btn_back")}
            </button>
          </div>
        )}

        {showPrivacy && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <h3 className="tan-font" style={{ color: "var(--color-primary)" }}>
                {t("register.privacy_modal.title")}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: "1.5" }}>
                {t("register.privacy_modal.text")}
              </p>
              <button onClick={() => setShowPrivacy(false)} style={btnModalStyle}>
                {t("register.privacy_modal.btn_close")}
              </button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ESTILOS EXTRAÍDOS PARA LIMPIEZA DINÁMICA
const formContainerStyle = (isMobile: boolean) => ({
  background: "var(--bg-card)", padding: isMobile ? "25px" : "40px", borderRadius: "24px", 
  border: "1px solid var(--color-border)", boxShadow: "0 15px 35px var(--shadow-card)", 
  width: "100%", maxWidth: "500px", transition: "all 0.3s ease"
});
const inputStyle = { width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "var(--text-main)", textAlign: "center" as const, outline: "none" };
const buttonStyle = (isMobile: boolean) => ({ background: "var(--color-primary)", color: "white", border: "none", padding: isMobile ? "12px" : "16px", borderRadius: "14px", marginTop: "10px", fontWeight: 900, cursor: "pointer", width: "100%", boxShadow: "0 4px 10px var(--shadow-card)" });
const btnBackStyle = { background: "none", border: "none", color: "var(--text-muted)", textDecoration: "underline" as const, cursor: "pointer", marginTop: "20px", width: "100%", fontWeight: 800 };
const modalOverlayStyle = { position: "fixed" as const, inset: 0, backgroundColor: "var(--overlay-strong)", backdropFilter: "blur(4px)", zIndex: 3000, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" };
const modalContentStyle = { background: "var(--bg-card)", padding: "30px", borderRadius: "24px", maxWidth: "450px", border: "1px solid var(--color-border)", textAlign: "center" as const, boxShadow: "0 20px 50px var(--shadow-card)" };
const btnModalStyle = { background: "var(--color-primary)", color: "white", border: "none", padding: "12px", borderRadius: "12px", marginTop: "20px", fontWeight: 900, cursor: "pointer", width: "100%" };