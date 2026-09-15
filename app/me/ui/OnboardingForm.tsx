"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { resolveMemberAvatarUrl } from "@/lib/member-image-url";
import { Check, Heart } from "lucide-react";
import { useGlobal } from "@/app/context/GlobalContext";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'pt', label: '🇧🇷 Português' },
  { code: 'id', label: '🇮🇩 Indonesia' },
  { code: 'th', label: '🇹🇭 ไทย' },
  { code: 'ko', label: '🇰🇷 한국어' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'ja', label: '🇯🇵 日本語' }
];

const MEMBER_ORDER = [
  "bangchan",
  "leeknow",
  "changbin",
  "hyunjin",
  "han",
  "felix",
  "seungmin",
  "in",
];

const normalizeMemberOrderKey = (value: string | null | undefined) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const memberOrderIndex = new Map(MEMBER_ORDER.map((name, index) => [name, index]));

const compareMembersByPreferredOrder = (a: any, b: any) => {
  const aName = String(a?.name ?? "");
  const bName = String(b?.name ?? "");
  const aIdx = memberOrderIndex.get(normalizeMemberOrderKey(aName));
  const bIdx = memberOrderIndex.get(normalizeMemberOrderKey(bName));
  if (aIdx != null && bIdx != null) return aIdx - bIdx;
  if (aIdx != null) return -1;
  if (bIdx != null) return 1;
  return aName.localeCompare(bName, "es", { sensitivity: "base" });
};

const styles: Record<string, any> = {
  container: { maxWidth: '900px', width: '100%', textAlign: 'center', margin: '0 auto', padding: '20px' },
  title: { fontSize: '28px', fontWeight: 900, color: 'var(--color-primary)', marginBottom: '10px' },
  subtitle: { fontSize: '16px', color: 'var(--text-muted)', marginBottom: '40px', fontWeight: 700 },
  groupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' },
  groupCard: (selected: boolean) => ({
    padding: 20, borderRadius: 24, cursor: 'pointer', transition: 'all 0.2s',
    backgroundColor: selected ? 'var(--bg-soft)' : 'var(--bg-card)',
    border: selected ? '4px solid var(--color-primary)' : '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
  }),
  memberSection: { marginTop: '40px', textAlign: 'left' },
  groupHeader: { color: 'var(--color-primary)', fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid var(--color-border)', display: 'inline-block', paddingBottom: '5px' },
  memberGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '20px', marginBottom: '30px' },
  memberBubble: (selected: boolean) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer'
  }),
  memberAvatarContainer: (selected: boolean) => ({
    width: 100, height: 100, borderRadius: '50%', border: selected ? '4px solid var(--color-primary)' : '2px solid var(--color-border)',
    position: 'relative', overflow: 'visible', backgroundColor: 'var(--bg-card)', padding: 3
  }),
  memberAvatar: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' },
  heartIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '50%', padding: 4 },
  btnPrincipal: {
    background: 'var(--color-primary)', color: 'white', border: 'none', padding: '14px 40px', 
    borderRadius: '18px', fontWeight: 900, cursor: 'pointer', fontSize: '16px',
    boxShadow: '0 4px 12px var(--shadow-card)'
  }
};

export function OnboardingForm({
  onComplete,
}: {
  onComplete: (data: {
    biasesIds: number[];
    selectedGroupIds: number[];
    birthdate: string;
    hasConsent: boolean;
    language: string;
  }) => void;
}) {
  const router = useRouter();
  const { profile, t } = useGlobal(); // 👈 Añadido la 't' aquí
  const userId = profile?.id || null;

  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedBiases, setSelectedBiases] = useState<number[]>([]);
  
  const [birthdate, setBirthdate] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("es"); // 👈 NUEVO: Idioma por defecto
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadGroups() {
      const { data } = await supabase.from("groups").select("*").order("name");
      if (data) setGroups(data);
    }
    loadGroups();
  }, []);

  useEffect(() => {
    async function loadMembers() {
      if (step === 2 && selectedGroups.length > 0) {
        const groupsAsText = selectedGroups.map(id => String(id));
        const { data, error } = await supabase
          .from('members')
          .select('member_id, name, image_url, group_id')
          .in('group_id', groupsAsText) 
          .order('name');

        if (error) console.error("Error Supabase:", error.message);
        else setMembers(data || []);
      }
    }
    loadMembers();
  }, [step, selectedGroups]);

  const age = React.useMemo(() => {
    if (!birthdate) return null;
    const birthDate = new Date(birthdate);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  }, [birthdate]);

  const isMinor = age !== null && age < 18;

  const handleFinalAction = async () => {
    setIsSubmitting(true);
    try {
      // ✅ Pasamos el idioma al componente padre para que lo guarde en Supabase
      onComplete({
        biasesIds: selectedBiases,
        selectedGroupIds: selectedGroups,
        birthdate: birthdate,
        hasConsent: hasConsent,
        language: selectedLanguage,
      });
    } catch (error) {
      console.error("Error validando los datos finales:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 className="tan-font" style={styles.title}>
        {step === 1 ? t('onboarding.step1_title') : 
         step === 2 ? t('onboarding.step2_title') : 
         t('onboarding.step3_title')}
      </h1>
      <p style={styles.subtitle}>
        {step === 1 ? t('onboarding.step1_subtitle') : 
         step === 2 ? t('onboarding.step2_subtitle') : 
         t('onboarding.step3_subtitle')}
      </p>

      {step === 1 && (
        <div style={styles.groupGrid}>
          {groups.map(g => {
            const isSelected = selectedGroups.includes(g.id);
            return (
              <div key={g.id} onClick={() => setSelectedGroups(prev => isSelected ? prev.filter(i => i !== g.id) : [...prev, g.id])} style={styles.groupCard(isSelected) as any}>
                <img src={g.logo_url || "/branding/logo.png"} style={{width: 80, height: 60, objectFit: 'contain'}} alt={g.name} />
                <div className="tan-font" style={{fontSize: 14, color: 'var(--color-primary)'}}>{g.name}</div>
                {isSelected && <Check size={20} color="var(--color-primary)" strokeWidth={4} />}
              </div>
            );
          })}
        </div>
      )}

      {step === 2 && (
        selectedGroups.map(groupId => {
          const group = groups.find(g => g.id === groupId);
          const groupMembers = members
            .filter((m) => String(m.group_id ?? "") === String(groupId))
            .sort(compareMembersByPreferredOrder);
          if (groupMembers.length === 0) return null;

          return (
            <div key={groupId} style={styles.memberSection}>
              <h3 className="tan-font" style={styles.groupHeader}>{group?.name}</h3>
              <div style={styles.memberGrid}>
                {groupMembers.map((m) => {
                  const mid = Number(m.member_id ?? m.id);
                  const isSelected = selectedBiases.includes(mid);
                  return (
                    <div key={mid} onClick={() => setSelectedBiases((prev) => (isSelected ? prev.filter((i) => i !== mid) : [...prev, mid]))} style={styles.memberBubble(isSelected) as any}>
                      <div style={styles.memberAvatarContainer(isSelected)}>
                        <img
                          src={resolveMemberAvatarUrl(m.image_url) || "/branding/logo.png"}
                          style={styles.memberAvatar}
                          alt={m.name}
                        />
                        {isSelected && <Heart size={16} style={styles.heartIcon} fill="white" />}
                      </div>
                      <div style={{fontSize: 13, fontWeight: 800, color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)'}}>{m.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {step === 3 && (
        <div style={{ maxWidth: '450px', margin: '0 auto', textAlign: 'left' }}>
          
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', color: 'var(--color-primary)', fontWeight: 900, marginBottom: '8px', fontSize: '15px' }}>
              {t('onboarding.language_label')}
            </label>
            <select 
              value={selectedLanguage} 
              onChange={e => setSelectedLanguage(e.target.value)} 
              style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid var(--color-border)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', color: 'var(--color-primary)', fontWeight: 900, marginBottom: '8px', fontSize: '15px' }}>
              {t('onboarding.birthday_label')}
            </label>
            <input 
              type="date" 
              value={birthdate} 
              onChange={e => setBirthdate(e.target.value)} 
              style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid var(--color-border)', color: 'var(--text-main)', background: 'var(--bg-card)', fontFamily: 'inherit', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} 
            />
          </div>

          {isMinor && (
            <div style={{ marginBottom: '15px', padding: '12px', borderRadius: '12px', background: 'var(--bg-soft)', border: '1px dashed var(--color-primary)' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-primary)', fontWeight: 800, textAlign: 'center' }}>
                {t('onboarding.minor_warning')}
              </p>
            </div>
          )}

          {birthdate && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: hasConsent ? 'var(--bg-soft)' : 'var(--bg-card)', padding: '18px', borderRadius: '16px', border: hasConsent ? '2px solid var(--color-primary)' : '2px solid var(--color-border)', transition: 'all 0.2s', boxSizing: 'border-box' }}>
              <input 
                type="checkbox" 
                checked={hasConsent} 
                onChange={e => setHasConsent(e.target.checked)} 
                style={{ width: '22px', height: '22px', accentColor: 'var(--color-primary)', marginTop: '2px', cursor: 'pointer' }} 
              />
              <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 700, lineHeight: 1.4 }}>
                {isMinor 
                  ? t('onboarding.minor_consent')
                  : t('onboarding.adult_consent')
                }
              </span>
            </label>
          )}

        </div>
      )}

      <div style={{ marginTop: 50, display: 'flex', gap: 15, justifyContent: 'center' }}>
        {step > 1 && (
          <button 
            disabled={isSubmitting}
            onClick={() => setStep(step - 1)} 
            style={{...styles.btnPrincipal, background: 'var(--bg-card)', border: '2px solid var(--color-border)', color: 'var(--text-muted)', opacity: isSubmitting ? 0.5 : 1}}
          >
            {t('common.back')}
          </button>
        )}
        <button 
          disabled={
            (step === 1 && selectedGroups.length === 0) || 
            (step === 3 && (!birthdate || !hasConsent)) ||
            isSubmitting
          }
          onClick={step === 3 ? handleFinalAction : () => setStep(step + 1)} 
          className="tan-font" style={{...styles.btnPrincipal, opacity: (step === 1 && selectedGroups.length === 0) || (step === 3 && (!birthdate || !hasConsent)) || isSubmitting ? 0.5 : 1}}
        >
          {isSubmitting ? t('common.saving') : step === 3 ? t('onboarding.btn_start') : t('common.next')}
        </button>
      </div>
    </div>
  );
}