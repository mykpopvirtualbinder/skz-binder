"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import Footer from "../components/footer";
import { savePendingSignupProfile, type PendingSignupProfilePayload } from "@/lib/pending-signup-profile";
import { OnboardingForm } from "../me/ui/OnboardingForm";
import { useGlobal } from "../context/GlobalContext";
import { isEmailOk } from "@/lib/email-policy";
import { isPasswordOk } from "@/lib/password-policy";

export default function RegisterPage() {
  const router = useRouter();
  const { t, showAlert, uiLanguage } = useGlobal();
  const [step, setStep] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState<{ code: string; friend: number; referrer: number; mailFailed: boolean } | null>(null);
  
  const [formData, setFormData] = useState({
    username: "", firstName: "", lastName: "", email: "",
    password: "", phone: "", address: "", inviteCode: "", acceptTerms: false
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
        inviteCode: String(parsed?.inviteCode ?? prev.inviteCode),
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
    try {
      const emailLower = formData.email.trim().toLowerCase();
      const mailRes = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          email: formData.email.trim(),
          password: formData.password,
          redirectTo: `${window.location.origin}/login`,
          language: onboardingData.language || uiLanguage,
          inviteCode: formData.inviteCode,
        }),
      });
      const mailBody = (await mailRes.json().catch(() => ({}))) as {
        userId?: string;
        code?: string;
        error?: string;
        inviteCode?: string | null;
        friendKoins?: number;
        referrerKoins?: number;
      };
      if (mailRes.status === 409 || mailBody.code === "already_registered") {
        throw new Error(t("register.alert_email_taken"));
      }
      if (mailBody.code === "invite_invalid") {
        throw new Error(t("register.alert_invite_invalid"));
      }
      if (mailBody.code === "invite_full") {
        throw new Error(t("register.alert_invite_full"));
      }
      const userId = typeof mailBody.userId === "string" ? mailBody.userId : null;
      if (!mailRes.ok && mailRes.status !== 502) {
        throw new Error(mailBody.error || t("common.error"));
      }
      if (!userId) throw new Error(t("register.alerts.error_profile"));

      const isAdult = calculateAge(onboardingData.birthdate) >= 18;
      const mailFailed = mailRes.status === 502;

      const pending: PendingSignupProfilePayload = {
        v: 1,
        userId,
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
      setWelcome({
        code: typeof mailBody.inviteCode === "string" ? mailBody.inviteCode : "",
        friend: mailBody.friendKoins || 100,
        referrer: mailBody.referrerKoins || 100,
        mailFailed,
      });
    } catch (err: any) {
      showAlert(t("common.error"), t("register.alert_error_prefix") + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const controls = Array.from(form.elements);
    for (const field of controls) {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
      if (field === emailRef.current) {
        if (!isEmailOk(formData.email)) {
          setEmailInvalid(true);
          showAlert(t("register.alert_title_validation"), t("register.alert_email"), () => {
            emailRef.current?.focus();
            emailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }
        setEmailInvalid(false);
        continue;
      }
      if (field === passwordRef.current) {
        if (!isPasswordOk(formData.password)) {
          setPasswordInvalid(true);
          showAlert(t("register.alert_title_validation"), t("register.alert_password"), () => {
            passwordRef.current?.focus();
            passwordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }
        setPasswordInvalid(false);
        continue;
      }
      if (field instanceof HTMLInputElement && field.required && field.type !== "checkbox" && !field.value.trim()) {
        field.reportValidity();
        return;
      }
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

        {welcome && (
          <div data-kbd-root role="dialog" aria-modal="true" style={formContainerStyle(isMobile)}>
            <img src="/branding/logo.png" alt="My K-pop Binder" style={{ display: "block", width: "120px", height: "auto", margin: "0 auto 14px" }} />
            <p style={{ margin: 0, textAlign: "center", letterSpacing: "0.18em", fontSize: "12px", fontWeight: 800, color: "var(--color-primary)" }}>MY K-POP BINDER</p>
            <p style={{ margin: "6px 0 18px", textAlign: "center", fontStyle: "italic", fontWeight: 700, color: "var(--color-primary)" }}>Collect · Trade · Connect</p>
            <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: isMobile ? "26px" : "32px", textAlign: "center", margin: "0 0 12px" }}>
              {t("register.alert_title_verify_email")}
            </h2>
              <p style={{ color: "var(--text-main)", fontSize: "15px", lineHeight: 1.55, fontWeight: 700, textAlign: "center", margin: "0 0 18px" }}>
              {welcome.mailFailed
                ? t("register.alert_verify_email_with_issue").replace("{error}", t("common.error"))
                : t("register.alert_verify_email")}
            </p>
            {welcome.code ? (
              <div style={{ background: "var(--bg-soft)", border: "1px solid var(--color-border)", borderRadius: "18px", padding: "16px", textAlign: "center", marginBottom: "18px" }}>
                <div style={{ fontSize: "11px", fontWeight: 900, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase" }}>{t("register.confirm_code_label")}</div>
                <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: 900, letterSpacing: "0.08em", color: "var(--color-primary)" }}>{welcome.code}</div>
                <p style={{ margin: "10px 0 0", fontSize: "13px", lineHeight: 1.45, fontWeight: 700, color: "var(--text-main)" }}>
                  {t("register.confirm_code_hint", { friend: welcome.friend, referrer: welcome.referrer })}
                </p>
              </div>
            ) : null}
            <button type="button" data-kbd="confirm" className="tan-font" style={buttonStyle(isMobile)} onClick={() => router.push("/login")}>
              {t("register.confirm_go_login")}
            </button>
          </div>
        )}
        
        {step === 1 && !welcome && (
          <div style={formContainerStyle(isMobile)}>
            <h2 className="tan-font" style={{ color: "var(--color-primary)", fontSize: isMobile ? "24px" : "32px", textAlign: "center", marginBottom: "10px" }}>
              {t("register.step1_title")}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "30px", fontWeight: 600 }}>
              {t("register.step1_subtitle")}
            </p>

            <form noValidate onSubmit={handleNextStep} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input value={formData.username} placeholder={t("register.placeholder_username")} required style={inputStyle} onChange={(e) => setFormData({...formData, username: e.target.value})} />
              <div style={{ display: "flex", gap: "10px" }}>
                <input value={formData.firstName} placeholder={t("register.placeholder_firstname")} required style={{ ...inputStyle, flex: 1 }} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                <input value={formData.lastName} placeholder={t("register.placeholder_lastname")} required style={{ ...inputStyle, flex: 1 }} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
              </div>
              <input
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={formData.email}
                placeholder={t("register.placeholder_email")}
                required
                aria-invalid={emailInvalid}
                style={{
                  ...inputStyle,
                  ...(emailInvalid
                    ? {
                        border: "2px solid #b4234a",
                        background: "color-mix(in srgb, #b4234a 12%, var(--bg-main))",
                      }
                    : {}),
                }}
                onChange={(e) => {
                  const email = e.target.value;
                  setFormData({ ...formData, email });
                  if (emailInvalid && isEmailOk(email)) setEmailInvalid(false);
                }}
                onBlur={() => {
                  const email = emailRef.current?.value ?? "";
                  if (email.trim() && !isEmailOk(email)) setEmailInvalid(true);
                }}
              />
              {emailInvalid ? (
                <p style={{ margin: "-8px 0 0", fontSize: "12px", lineHeight: 1.4, fontWeight: 600, textAlign: "center", color: "#b4234a" }}>
                  {t("register.alert_email")}
                </p>
              ) : null}
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  placeholder={t("register.placeholder_password")}
                  required
                  autoComplete="new-password"
                  aria-describedby="register-password-hint"
                  aria-invalid={passwordInvalid}
                  value={formData.password}
                  style={{
                    ...inputStyle,
                    paddingRight: "44px",
                    ...(passwordInvalid
                      ? {
                          border: "2px solid #b4234a",
                          background: "color-mix(in srgb, #b4234a 12%, var(--bg-main))",
                        }
                      : {}),
                  }}
                  onChange={(e) => {
                    const password = e.target.value;
                    setFormData({ ...formData, password });
                    if (passwordInvalid && isPasswordOk(password)) setPasswordInvalid(false);
                  }}
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
              <p
                id="register-password-hint"
                style={{
                  margin: "-8px 0 0",
                  fontSize: "12px",
                  lineHeight: 1.4,
                  fontWeight: 600,
                  textAlign: "center",
                  color: passwordInvalid ? "#b4234a" : "var(--text-muted)",
                }}
              >
                {t("register.password_hint")}
              </p>
              
              <hr style={{ border: "0.5px solid var(--color-border)", margin: "10px 0" }} />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 900, textAlign: "center", textTransform: "uppercase" }}>
                {t("register.shipping_data_title")}
              </p>
              
              <input value={formData.phone} placeholder={t("register.placeholder_phone")} style={inputStyle} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <textarea value={formData.address} placeholder={t("register.placeholder_address")} style={{ ...inputStyle, height: "60px", resize: "none" }} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <input value={formData.inviteCode} placeholder={t("register.placeholder_invite")} autoComplete="off" style={inputStyle} onChange={(e) => setFormData({...formData, inviteCode: e.target.value})} />

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

        {step === 2 && !welcome && (
          <div style={{ width: "100%", maxWidth: "1000px" }}>
            <OnboardingForm onComplete={handleFinalRegister} />
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