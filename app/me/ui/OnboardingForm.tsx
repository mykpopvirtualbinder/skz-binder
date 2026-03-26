"use client";
import React, { useState, useEffect } from "react";
// ... resto de importaciones
import { supabase } from "@/lib/supabase";
import { Check, Heart } from "lucide-react";
import { useGlobal } from "@/app/context/GlobalContext";
import { useRouter } from "next/navigation";

const styles: Record<string, any> = {
  container: { maxWidth: '900px', width: '100%', textAlign: 'center', margin: '0 auto', padding: '20px' },
  title: { fontSize: '28px', fontWeight: 900, color: '#8C659C', marginBottom: '10px' },
  subtitle: { fontSize: '16px', color: '#b17eac', marginBottom: '40px', fontWeight: 700 },
  groupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' },
  groupCard: (selected: boolean) => ({
    padding: 20, borderRadius: 24, cursor: 'pointer', transition: 'all 0.2s',
    backgroundColor: selected ? '#FFF5FA' : 'white',
    border: selected ? '4px solid #F7A8D8' : '1px solid #F3DCE7',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
  }),
  memberSection: { marginTop: '40px', textAlign: 'left' },
  groupHeader: { color: '#8C659C', fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid #ffd9e6', display: 'inline-block', paddingBottom: '5px' },
  memberGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '20px', marginBottom: '30px' },
  memberBubble: (selected: boolean) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer'
  }),
  memberAvatarContainer: (selected: boolean) => ({
    width: 100, height: 100, borderRadius: '50%', border: selected ? '4px solid #F7A8D8' : '2px solid #F3DCE7',
    position: 'relative', overflow: 'visible', backgroundColor: 'white', padding: 3
  }),
  memberAvatar: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' },
  heartIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#F7A8D8', color: 'white', borderRadius: '50%', padding: 4 },
  btnPrincipal: {
    background: '#ffd9e6', color: '#8C659C', border: 'none', padding: '14px 40px', 
    borderRadius: '18px', fontWeight: 900, cursor: 'pointer', fontSize: '16px',
    boxShadow: '0 4px 12px rgba(247, 168, 216, 0.2)'
  }
};

export function OnboardingForm({ onComplete }: { onComplete: (biasesIds?: number[]) => void }) {
  const router = useRouter();
  const { profile } = useGlobal();
  const userId = profile?.id || null;
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedBiases, setSelectedBiases] = useState<number[]>([]);

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
        // Convertimos IDs a string porque tu columna group_id es 'text'
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

  const handleFinalAction = () => {
    onComplete(selectedBiases);
    router.push('/me'); // Te redirige a tu perfil al terminar
  };

  return (
    <div style={styles.container}>
      <h1 className="tan-font" style={styles.title}>{step === 1 ? "¡Te damos la bienvenida! ✨" : "Tus favoritos 💖"}</h1>
      <p style={styles.subtitle}>{step === 1 ? "Selecciona los grupos que vas a coleccionar" : "Elige a tus bias de estos grupos"}</p>

      {step === 1 ? (
        <div style={styles.groupGrid}>
          {groups.map(g => {
            const isSelected = selectedGroups.includes(g.id);
            return (
              <div key={g.id} onClick={() => setSelectedGroups(prev => isSelected ? prev.filter(i => i !== g.id) : [...prev, g.id])} style={styles.groupCard(isSelected) as any}>
                <img src={g.logo_url || "/branding/logo.png"} style={{width: 80, height: 60, objectFit: 'contain'}} alt={g.name} />
                <div className="tan-font" style={{fontSize: 14, color: '#8C659C'}}>{g.name}</div>
                {isSelected && <Check size={20} color="#F7A8D8" strokeWidth={4} />}
              </div>
            );
          })}
        </div>
      ) : (
        selectedGroups.map(groupId => {
          const group = groups.find(g => g.id === groupId);
          const groupMembers = members.filter(m => m.group_id === String(groupId));
          if (groupMembers.length === 0) return null;

          return (
            <div key={groupId} style={styles.memberSection}>
              <h3 className="tan-font" style={styles.groupHeader}>{group?.name}</h3>
              <div style={styles.memberGrid}>
                {groupMembers.map(m => {
                  const isSelected = selectedBiases.includes(m.member_id);
                  return (
                    <div key={m.member_id} onClick={() => setSelectedBiases(prev => isSelected ? prev.filter(i => i !== m.member_id) : [...prev, m.member_id])} style={styles.memberBubble(isSelected) as any}>
                      <div style={styles.memberAvatarContainer(isSelected)}>
                        <img src={m.image_url || "/branding/logo.png"} style={styles.memberAvatar} alt={m.name} />
                        {isSelected && <Heart size={16} style={styles.heartIcon} fill="white" />}
                      </div>
                      <div style={{fontSize: 13, fontWeight: 800, color: isSelected ? '#F7A8D8' : '#8C659C'}}>{m.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 50, display: 'flex', gap: 15, justifyContent: 'center' }}>
        {step === 2 && (
          <button 
            onClick={() => setStep(1)} 
            style={{...styles.btnPrincipal, background: 'white', border: '2px solid #F3DCE7', color: '#8C659C'}}
          >
            VOLVER
          </button>
        )}
        <button 
          disabled={step === 1 ? selectedGroups.length === 0 : false}
          onClick={step === 1 ? () => setStep(2) : handleFinalAction} 
          className="tan-font" style={styles.btnPrincipal}
        >
          {step === 1 ? "SIGUIENTE →" : "¡EMPEZAR A COLECCIONAR! 💖"}
        </button>
      </div>
    </div>
  );
}