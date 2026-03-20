"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient"; 
import { Check, Heart } from "lucide-react";

// --- ESTILOS ACTUALIZADOS PARA INTEGRACIÓN ---
const styles: Record<string, any> = {
  container: {
    maxWidth: '900px', 
    width: '100%', 
    textAlign: 'center',
    margin: '0 auto',
    padding: '20px'
  },
  title: {
    fontSize: '32px', 
    fontWeight: 900, 
    color: '#8C659C', // Cambiado a morado para coherencia
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '18px', 
    color: '#b17eac', 
    marginBottom: '40px', 
    fontWeight: 700 
  },
  groupGrid: {
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
    gap: '20px'
  },
  groupCard: (selected: boolean) => ({
    padding: 25, 
    borderRadius: 24, 
    cursor: 'pointer', 
    transition: 'all 0.25s ease',
    backgroundColor: selected ? '#FFF5FA' : 'white', // Fondo blanco para resaltar sobre el crema
    border: selected ? '4px solid #F7A8D8' : '1px solid #F3DCE7',
    boxShadow: selected ? '0 10px 25px rgba(247,168,216,0.2)' : '0 4px 12px rgba(140, 101, 156, 0.05)',
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: 15,
    transform: selected ? 'scale(1.03)' : 'scale(1)'
  }),
  groupLogo: { 
    width: 120, 
    height: 80, 
    borderRadius: 12, 
    objectFit: 'contain', 
    backgroundColor: 'white', 
    padding: '5px' 
  },
  groupName: { 
    fontWeight: 900, 
    fontSize: 18, 
    color: '#8C659C' 
  },
  memberGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
    gap: 20 
  },
  memberBubble: (selected: boolean) => ({
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: 10, 
    cursor: 'pointer',
    transition: 'all 0.2s ease', 
    transform: selected ? 'scale(1.05)' : 'scale(1)'
  }),
  memberAvatarContainer: (selected: boolean) => ({
    width: 110, 
    height: 110, 
    borderRadius: '50%', 
    padding: 4,
    border: selected ? '4px solid #F7A8D8' : '2px solid #F3DCE7',
    backgroundColor: 'white', 
    position: 'relative', 
    transition: 'all 0.2s ease',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center'
  }),
  memberAvatar: { 
    width: '100%', 
    height: '100%', 
    borderRadius: '50%', 
    objectFit: 'cover' 
  },
  memberName: (selected: boolean) => ({
    fontWeight: 700, 
    fontSize: 15, 
    color: selected ? '#F7A8D8' : '#8C659C',
    transition: 'all 0.2s ease'
  }),
  heartIcon: {
    position: 'absolute', 
    bottom: -5, 
    right: -5, 
    backgroundColor: '#F7A8D8',
    color: 'white', 
    borderRadius: '50%', 
    padding: 5, 
    boxShadow: '0 2px 5px rgba(140, 101, 156, 0.2)'
  },
  btnPrincipal: {
    padding: '16px 45px', 
    borderRadius: 18, 
    border: 'none',
    background: '#ffd9e6', // Cambiado al rosa suave del header
    color: '#8C659C', 
    fontWeight: 900, 
    cursor: 'pointer',
    fontSize: 17, 
    boxShadow: '0 5px 15px rgba(247,168,216,0.1)',
    display: 'flex', 
    gap: 10, 
    alignItems: 'center'
  },
  btnSaltar: {
    background: 'none', 
    border: 'none', 
    color: '#b17eac', 
    textDecoration: 'underline', 
    cursor: 'pointer', 
    fontWeight: 700,
    marginTop: 20, 
    fontSize: 14, 
    opacity: 0.8
  }
};

export function OnboardingForm({ userId, onComplete }: { userId: string, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedBiases, setSelectedBiases] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadGroups() {
      const { data } = await supabase.from("groups").select("id, name, logo_url").order("name");
      if (data) setGroups(data);
    }
    loadGroups();
  }, []);

  useEffect(() => {
    async function loadMembers() {
      if (step === 2 && selectedGroups.length > 0) {
        const { data, error } = await supabase
          .from('members')
          .select('member_id, name, slug, image_url')
          .order('name');

        if (error) {
          console.error("Error cargando miembros:", error.message);
        } else {
          setMembers(data || []);
        }
      }
    }
    loadMembers();
  }, [step, selectedGroups]);

  const toggleGroup = (id: number) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const toggleBias = (memberId: number) => {
    setSelectedBiases(prev => prev.includes(memberId) ? prev.filter(b => b !== memberId) : [...prev, memberId]);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const rows = selectedBiases.map((mId) => ({
        user_id: userId,
        member_id: Number(mId),
      }));

      // Asegurar perfil
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("profiles").insert({ user_id: userId });
      }

      // Limpiar anteriores y guardar nuevos
      await supabase.from("user_biases").delete().eq("user_id", userId);
      
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("user_biases").insert(rows);
        if (insertError) throw insertError;
      }

      onComplete();
    } catch (error: any) {
      console.error("Error guardando bias:", error);
      alert("Hubo un problema al guardar tus favoritos.");
    } finally {
      setLoading(false);
    }
  };

  const defaultImg = "https://via.placeholder.com/150?text=No+Img";

  return (
    <div style={styles.container}>
      <h1 className="tan-font" style={styles.title}>
        {step === 1 ? "¡Bienvenida! ✨" : "Tus favoritos 💖"}
      </h1>
      <p style={styles.subtitle}>
        {step === 1 ? "Selecciona los grupos que vas a coleccionar" : "Elige a tus bias de estos grupos"}
      </p>

      {step === 1 ? (
        <div style={styles.groupGrid}>
          {groups.map(g => {
            const isSelected = selectedGroups.includes(g.id);
            return (
              <div key={g.id} onClick={() => toggleGroup(g.id)} style={styles.groupCard(isSelected) as any}>
                <img src={g.logo_url || defaultImg} alt={g.name} style={styles.groupLogo} />
                <div style={styles.groupName}>{g.name}</div>
                {isSelected && <Check size={24} color="#F7A8D8" strokeWidth={3} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={styles.memberGrid}>
          {members.map(m => {
            const isSelected = selectedBiases.includes(m.member_id);
            return (
              <div key={m.member_id} onClick={() => toggleBias(m.member_id)} style={styles.memberBubble(isSelected) as any}>
                <div style={styles.memberAvatarContainer(isSelected)}>
                  <img src={m.image_url || defaultImg} alt={m.name} style={styles.memberAvatar} />
                  {isSelected && <Heart size={20} style={styles.heartIcon} fill="white" />}
                </div>
                <div style={styles.memberName(isSelected)}>{m.name}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {step === 2 && (
            <button 
              type="button"
              onClick={() => setStep(1)} 
              style={{ padding: '14px 25px', borderRadius: 18, border: '2px solid #F3DCE7', background: 'white', cursor: 'pointer', fontWeight: 900, color: '#8C659C' }}
            >
              Volver
            </button>
          )}
          
          <button 
            type="button"
            disabled={step === 1 ? selectedGroups.length === 0 : selectedBiases.length === 0 || loading}
            onClick={step === 1 ? () => setStep(2) : handleSave}
            style={styles.btnPrincipal}
          >
            {loading ? "GUARDANDO..." : step === 1 ? "SIGUIENTE →" : "¡EMPEZAR A COLECCIONAR! 💖"}
          </button>
        </div>

        <button 
          type="button"
          onClick={onComplete} 
          style={styles.btnSaltar}
        >
          Saltar este paso por ahora
        </button>
      </div>
    </div>
  );
}