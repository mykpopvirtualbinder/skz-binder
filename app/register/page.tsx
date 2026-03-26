"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/header";
import Footer from "../components/footer";
import { supabase } from "@/lib/supabase";
import { OnboardingForm } from "../me/ui/OnboardingForm";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "", firstName: "", lastName: "", email: "",
    password: "", phone: "", address: "", acceptTerms: false
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleFinalRegister = async (biasesIds: number[]) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;

      const user = authData.user;
      if (user) {
        await supabase.from("profiles").insert({
          id: user.id,
          display_name: formData.username,
          full_name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          address: formData.address
        });

        if (biasesIds.length > 0) {
          const biasRows = biasesIds.map(id => ({ user_id: user.id, member_id: id }));
          await supabase.from("user_biases").insert(biasRows);
        }
        alert("¡Cuenta creada! Revisa tu email para confirmar.");
        router.push("/me");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      alert("La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.");
      return;
    }
    if (!formData.acceptTerms) {
      alert("Acepta la política de privacidad.");
      return;
    }
    setStep(2);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#FFFDF5" }}>
      <Header />
      
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: isMobile ? "20px" : "40px 20px" }}>
        
        {step === 1 && (
          <div style={formContainerStyle(isMobile)}>
            <h2 className="tan-font" style={{ color: "#8C659C", fontSize: isMobile ? "24px" : "32px", textAlign: "center", marginBottom: "10px" }}>
              ¡Únete al Fandom!
            </h2>
            <p style={{ color: "#b17eac", fontSize: "14px", textAlign: "center", marginBottom: "30px", fontWeight: 600 }}>
              Paso 1: Crea tu perfil base
            </p>

            <form onSubmit={handleNextStep} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input placeholder="Nombre de usuario *" required style={inputStyle} onChange={(e) => setFormData({...formData, username: e.target.value})} />
              <div style={{ display: "flex", gap: "10px" }}>
                <input placeholder="Nombre *" required style={{ ...inputStyle, flex: 1 }} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                <input placeholder="Apellidos *" required style={{ ...inputStyle, flex: 1 }} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
              </div>
              <input type="email" placeholder="Email *" required style={inputStyle} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              <input type="password" placeholder="Contraseña *" required style={inputStyle} onChange={(e) => setFormData({...formData, password: e.target.value})} />
              
              <hr style={{ border: "0.5px solid #F3DCE7", margin: "10px 0" }} />
              <p style={{ fontSize: "11px", color: "#b17eac", fontWeight: 900, textAlign: "center" }}>DATOS PARA ENVÍOS</p>
              
              <input placeholder="Teléfono" style={inputStyle} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <textarea placeholder="Dirección completa" style={{ ...inputStyle, height: "60px", resize: "none" }} onChange={(e) => setFormData({...formData, address: e.target.value})} />

              <label style={{ display: "flex", gap: "10px", alignItems: "start", cursor: "pointer", marginTop: "10px" }}>
                <input type="checkbox" required onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})} />
                <span style={{ fontSize: "12px", color: "#8C659C", textAlign: "left" }}>
                  Acepto la <b onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} style={{ textDecoration: "underline", color: "#B17EAC" }}>Política de Privacidad</b>. *
                </span>
              </label>

              <button type="submit" className="tan-font" style={buttonStyle(isMobile)}>SIGUIENTE: MI BIAS ✨</button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div style={{ width: "100%", maxWidth: "1000px" }}>
            <OnboardingForm onComplete={(biasesIds) => handleFinalRegister(biasesIds || [])} />
            <button onClick={() => setStep(1)} style={btnBackStyle}>Volver a mis datos personales</button>
          </div>
        )}

        {showPrivacy && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <h3 className="tan-font" style={{ color: "#8C659C" }}>Política de Privacidad</h3>
              <p style={{ fontSize: "13px", color: "#8C659C", lineHeight: "1.5" }}>
                En My Kpop Binder protegemos tus datos. Usamos tu nombre y dirección solo para gestionar envíos del Marketplace. Tus datos bancarios nunca se guardan en nuestros servidores (usamos pasarelas seguras). Al registrarte, aceptas que tratemos esta información para que la comunidad funcione de forma segura.
              </p>
              <button onClick={() => setShowPrivacy(false)} style={btnModalStyle}>ENTENDIDO</button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ESTILOS EXTRAÍDOS PARA LIMPIEZA
const formContainerStyle = (isMobile: boolean) => ({
  background: "white", padding: isMobile ? "25px" : "40px", borderRadius: "24px", 
  border: "1px solid #F3DCE7", boxShadow: "0 15px 35px rgba(140, 101, 156, 0.1)", 
  width: "100%", maxWidth: "500px"
});
const inputStyle = { width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #F3DCE7", background: "#FFFDF5", textAlign: "center" as const };
const buttonStyle = (isMobile: boolean) => ({ background: "#B17EAC", color: "white", border: "none", padding: isMobile ? "12px" : "16px", borderRadius: "14px", marginTop: "10px", fontWeight: 900, cursor: "pointer", width: "100%" });
const btnBackStyle = { background: "none", border: "none", color: "#8C659C", textDecoration: "underline" as const, cursor: "pointer", marginTop: "20px", width: "100%" };
const modalOverlayStyle = { position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 3000, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" };
const modalContentStyle = { background: "white", padding: "30px", borderRadius: "24px", maxWidth: "450px", border: "2px solid #F3DCE7", textAlign: "center" as const };
const btnModalStyle = { background: "#B17EAC", color: "white", border: "none", padding: "12px", borderRadius: "12px", marginTop: "20px", fontWeight: 900, cursor: "pointer", width: "100%" };