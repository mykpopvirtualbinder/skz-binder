"use client";

import { useState } from "react";
import { useGlobal } from "@/app/context/GlobalContext";
import { OnboardingForm } from "@/app/me/ui/OnboardingForm";
import { DEFAULT_SITE_PROFILE_AVATAR_URL } from "@/lib/default-profile-avatar";
import { syncProfileBiasesAfterSignup } from "@/lib/onboarding-profile-biases";
import { clearPendingSignupProfile } from "@/lib/pending-signup-profile";
import { mustFinishSignupForm } from "@/lib/required-signup-form";
import { supabase } from "@/lib/supabase";

function ageFromBirthdate(birthdate: string) {
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export default function RequiredSignupGate() {
  const { profile, setProfile, t, refreshGlobal, showAlert } = useGlobal();
  const [step, setStep] = useState<"details" | "groups">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  if (!mustFinishSignupForm(profile) || !profile) return null;

  const save = async (data: {
    biasesIds: number[];
    selectedGroupIds: number[];
    birthdate: string;
    hasConsent: boolean;
    language: string;
  }) => {
    if (saving || !data.hasConsent || !data.birthdate) return;
    setSaving(true);
    const userId = profile.id;
    const isAdult = ageFromBirthdate(data.birthdate) >= 18;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (data.biasesIds.length > 0) {
      await supabase.from("user_biases").delete().eq("user_id", userId);
      const { error: biasError } = await supabase.from("user_biases").insert(
        data.biasesIds.map((id) => ({ user_id: userId, member_id: id })),
      );
      if (biasError) {
        setSaving(false);
        showAlert(t("common.error"), biasError.message);
        return;
      }
    }

    const sync = await syncProfileBiasesAfterSignup(supabase, userId, data.biasesIds, data.selectedGroupIds);
    if (sync.error) {
      setSaving(false);
      showAlert(t("common.error"), sync.error.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone.trim(),
        address: address.trim(),
        birthdate: data.birthdate,
        is_adult: isAdult,
        legal_consent: true,
        language: data.language,
        avatar_url: profile.avatar_url || DEFAULT_SITE_PROFILE_AVATAR_URL,
      })
      .eq("user_id", userId);

    if (profileError) {
      setSaving(false);
      showAlert(t("common.error"), profileError.message);
      return;
    }

    clearPendingSignupProfile();
    setProfile({
      ...profile,
      full_name: fullName,
      phone: phone.trim(),
      address: address.trim(),
      birthdate: data.birthdate,
      is_adult: isAdult,
      legal_consent: true,
      language: data.language,
    });
    refreshGlobal();
    setSaving(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-kbd-root
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900000,
        background: "var(--bg-main)",
        overflow: "auto",
        padding: "32px 16px 64px",
      }}
    >
      <p style={{ maxWidth: 720, margin: "0 auto 24px", textAlign: "center", color: "var(--text-muted)", fontWeight: 700 }}>
        {t("onboarding.required_lead")}
      </p>
      {step === "details" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!firstName.trim() || !lastName.trim() || !phone.trim() || !address.trim()) return;
            setStep("groups");
          }}
          style={{
            maxWidth: 500,
            margin: "0 auto",
            background: "var(--bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 24,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <h2 className="tan-font" style={{ color: "var(--color-primary)", textAlign: "center", margin: 0 }}>
            {t("onboarding.required_title")}
          </h2>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              required
              value={firstName}
              placeholder={t("register.placeholder_firstname")}
              onChange={(event) => setFirstName(event.target.value)}
              style={inputStyle}
            />
            <input
              required
              value={lastName}
              placeholder={t("register.placeholder_lastname")}
              onChange={(event) => setLastName(event.target.value)}
              style={inputStyle}
            />
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 900, textAlign: "center" }}>
            {t("register.shipping_data_title")}
          </p>
          <input
            required
            value={phone}
            placeholder={t("register.placeholder_phone")}
            onChange={(event) => setPhone(event.target.value)}
            style={inputStyle}
          />
          <textarea
            required
            value={address}
            placeholder={t("register.placeholder_address")}
            onChange={(event) => setAddress(event.target.value)}
            style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
          />
          <button type="submit" data-kbd="confirm" className="tan-font" style={buttonStyle}>
            {t("common.next")}
          </button>
        </form>
      ) : (
        <>
          <OnboardingForm onComplete={save} />
          <button
            type="button"
            onClick={() => setStep("details")}
            style={{ background: "none", border: "none", color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer", marginTop: 16, width: "100%", fontWeight: 800 }}
          >
            {t("common.back")}
          </button>
        </>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid var(--color-border)",
  background: "var(--bg-main)",
  color: "var(--text-main)",
  textAlign: "center" as const,
  outline: "none",
  boxSizing: "border-box" as const,
};

const buttonStyle = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  padding: "14px",
  borderRadius: "14px",
  fontWeight: 900,
  cursor: "pointer",
};
