"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck, FileWarning, X, Loader2, Send, UploadCloud, Search, Trash2 } from "lucide-react";

import Footer from "../components/footer";
import { useGlobal } from "../context/GlobalContext";
import { supabase } from "@/lib/supabase";

export default function ReportPage() {
  const router = useRouter();
  const { profile, t } = useGlobal(); // 👈 Inyectamos t()

  // ESTADOS DEL MODAL DE DENUNCIA
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // ESTADOS PARA MÚLTIPLES ARCHIVOS (Límite: 4)
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 4;

  // ESTADOS PARA EL BUSCADOR DE USUARIOS
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // ESTADO PARA NUESTRA ALERTA PERSONALIZADA
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, onClose?: () => void } | null>(null);

  // EFECTO DE BÚSQUEDA DE USUARIOS
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(5);
      
      setSearchResults(data || []);
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // CONTROL DE LÍMITE DE ARCHIVOS
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (proofFiles.length + newFiles.length > MAX_FILES) {
        setCustomAlert({
          title: t("report.alert_limit_title"),
          message: t('report.alert_limit_msg')?.replace('{max}', MAX_FILES.toString()) || `Solo puedes subir un máximo de ${MAX_FILES} archivos por denuncia.`
        });
        const allowedFiles = newFiles.slice(0, MAX_FILES - proofFiles.length);
        setProofFiles(prev => [...prev, ...allowedFiles]);
      } else {
        setProofFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (indexToRemove: number) => {
    setProofFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSendReport = async () => {
    if (!profile) return setCustomAlert({ title: t("report.alert_login_title"), message: t("report.alert_login_msg") });
    if (!selectedUser) return setCustomAlert({ title: t("report.alert_user_title"), message: t("report.alert_user_msg") });
    if (!reportText.trim()) return setCustomAlert({ title: t("report.alert_reason_title"), message: t("report.alert_reason_msg") });
    
    setIsSubmitting(true);
    
    try {
      let uploadedUrls: string[] = [];
      
      // 1. SUBIMOS TODOS LOS ARCHIVOS A LA NUBE (Máximo 4)
      if (proofFiles.length > 0) {
        for (const file of proofFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `reports/${Date.now()}_${Math.random()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('fanart-pics') 
            .upload(fileName, file);
            
          if (!uploadError) {
            const { data } = supabase.storage.from('fanart-pics').getPublicUrl(fileName);
            uploadedUrls.push(data.publicUrl);
          }
        }
      }

      let finalMotivo = reportText;
      if (uploadedUrls.length > 0) {
        finalMotivo += `\n\nPruebas adjuntas:\n` + uploadedUrls.join('\n');
      }

      // 2. ENVIAMOS LA DENUNCIA
      const { error } = await supabase.from('denuncias').insert({
        reporter_id: isAnonymous ? null : profile.id,
        reported_user_id: selectedUser.user_id,
        motivo: finalMotivo,
        estado: 'pendiente'
      });

      if (error) throw error;

      setCustomAlert({
        title: t("report.alert_success_title"),
        message: t("report.alert_success_msg"),
        onClose: () => {
          setIsModalOpen(false);
          setReportText("");
          setProofFiles([]);
          setSelectedUser(null);
          setSearchQuery("");
          setIsAnonymous(false);
        }
      });
      
    } catch (e: any) {
      setCustomAlert({ title: t("report.alert_error_title"), message: t("report.alert_error_msg") + e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column", color: "var(--text-main)", transition: "background-color 0.3s ease" }}>
      
      <main className="legal-page" style={{ width: "100%", maxWidth: "900px", margin: "24px auto", padding: "0 40px", flex: 1 }}>
        
        <div style={{ marginBottom: "60px" }}>
          <h1 className="tan-font" style={{ color: "var(--color-primary)", fontSize: "64px", lineHeight: "0.8", margin: 0 }}>
            {t("report.title_1")}<br />
            <span style={{ fontSize: "40px" }}>{t("report.title_2")}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "14px", marginTop: "20px", letterSpacing: "2px", textTransform: "uppercase" }}>
            {t("report.subtitle")}
          </p>
          <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "13px", marginTop: "10px" }}>
            {t("report.last_update")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "50px" }}>
          
          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={20}/> {t("report.section1_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t("report.section1_desc")}
            </p>
          </section>

          <section>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FileWarning size={20}/> {t("report.section2_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)", marginBottom: "20px" }}>
              {t("report.section2_desc")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>{t("report.fraud_title")}</p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>{t("report.fraud_desc")}</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>{t("report.illegal_title")}</p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>{t("report.illegal_desc")}</p>
                </div>
                <div style={{ paddingLeft: "20px", borderLeft: "2px solid var(--color-border)" }}>
                   <p style={{ fontWeight: 800, color: "var(--color-primary)", margin: 0 }}>{t("report.fake_title")}</p>
                   <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>{t("report.fake_desc")}</p>
                </div>
            </div>
          </section>

          <section style={{ backgroundColor: "var(--bg-soft)", padding: "40px", borderRadius: "24px", border: "1px solid var(--color-border)" }}>
            <h2 style={{ color: "var(--color-primary)", fontWeight: 900, fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              {t("report.section3_title")}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
              {t("report.section3_desc")}
            </p>
          </section>
        </div>

        {/* BOTÓN PARA ABRIR MODAL */}
        <div style={{ marginTop: "80px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 900, fontSize: "16px", letterSpacing: "1px", marginBottom: "25px", textTransform: "uppercase" }}>
            {t("report.need_help")}
          </p>
          <button 
            onClick={() => {
              if(!profile) return setCustomAlert({ title: t("report.alert_login_title"), message: t("report.alert_login_msg")});
              setIsModalOpen(true);
            }}
            style={{ 
              display: "inline-flex", alignItems: "center", gap: "10px", 
              backgroundColor: "var(--color-primary)", color: "white", padding: "18px 36px", 
              borderRadius: "99px", border: "none", cursor: "pointer", fontWeight: 900, 
              fontSize: "15px", letterSpacing: "1px", boxShadow: "0 10px 20px var(--shadow-card)",
              transition: "transform 0.2s"
            }}
          >
            <AlertTriangle size={20} strokeWidth={2.5} />
            {t("report.btn_open_report")}
          </button>
        </div>

      </main>

      {/* --- EL MODAL (POP-UP) DE DENUNCIA MULTIUSOS --- */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", backdropFilter: "blur(5px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setIsModalOpen(false)}>
          <div style={{ backgroundColor: "var(--bg-card)", width: "100%", maxWidth: "550px", maxHeight: "90vh", overflowY: "auto", borderRadius: "24px", padding: "30px", position: "relative", boxShadow: "0 25px 50px var(--shadow-card)", border: "1px solid var(--color-border)" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer" }}><X size={24} color="var(--color-primary)" /></button>
            
            <h2 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 5px 0", fontSize: "28px" }}>{t("report.modal_title")}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 700, margin: "0 0 25px 0" }}>{t("report.modal_subtitle")}</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* 1. BUSCADOR DE USUARIO */}
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "8px", textTransform: "uppercase" }}>{t("report.step1_label")}</label>
                
                {selectedUser ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-main)", padding: "12px", borderRadius: "12px", border: "2px solid var(--color-primary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img src={selectedUser.avatar_url || "https://ui-avatars.com/api/?name=U"} style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }} alt="" />
                      <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "14px" }}>@{selectedUser.display_name}</span>
                    </div>
                    <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px", fontWeight: "bold", textDecoration: "underline" }}>{t("report.btn_change")}</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", background: "var(--bg-main)", padding: "0 15px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                      <Search size={18} color="var(--text-muted)" />
                      <input 
                        type="text" 
                        placeholder={t("report.search_placeholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: "100%", padding: "12px", border: "none", outline: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}
                      />
                      {isSearching && <Loader2 size={16} className="spinner" color="var(--color-primary)" />}
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "5px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--color-border)", boxShadow: "0 10px 25px var(--shadow-card)", zIndex: 10, overflow: "hidden" }}>
                        {searchResults.map(user => (
                          <div 
                            key={user.user_id} 
                            onClick={() => { setSelectedUser(user); setSearchResults([]); setSearchQuery(""); }}
                            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid var(--bg-soft)", transition: "0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-soft)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-card)"}
                          >
                            <img src={user.avatar_url || "https://ui-avatars.com/api/?name=U"} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} alt="" />
                            <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "13px" }}>@{user.display_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 2. TEXTO DEL REPORTE */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "8px", textTransform: "uppercase" }}>{t("report.step2_label")}</label>
                <textarea 
                  value={reportText} 
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder={t("report.report_placeholder")}
                  rows={4}
                  style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", fontFamily: "inherit", fontSize: "14px", boxSizing: "border-box", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }} 
                />
              </div>

              {/* 3. MÚLTIPLES ARCHIVOS ADJUNTOS */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "8px", textTransform: "uppercase" }}>
                  <span>{t("report.step3_label")}</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>{proofFiles.length}/{MAX_FILES}</span>
                </label>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  multiple
                  style={{ display: "none" }} 
                />
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {proofFiles.map((file, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-main)", padding: "10px 15px", borderRadius: "10px", border: "1px solid var(--color-border)" }}>
                      <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📸 {file.name}</span>
                      <button onClick={() => removeFile(idx)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={16} color="var(--text-muted)" /></button>
                    </div>
                  ))}
                  
                  {proofFiles.length < MAX_FILES && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "var(--bg-soft)", border: "1px dashed var(--color-primary)", color: "var(--color-primary)", padding: "12px", borderRadius: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 800, width: "100%", transition: "all 0.2s" }}
                    >
                      <UploadCloud size={18} />
                      {t("report.btn_add_proof")}
                    </button>
                  )}
                </div>
              </div>

              {/* 4. MODO ANÓNIMO */}
              <div style={{ background: "var(--bg-soft)", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={isAnonymous} 
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 800 }}>{t("report.anon_label")}</span>
                </label>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "5px 0 0 28px", fontWeight: 600 }}>{t("report.anon_desc")}</p>
              </div>

              {/* BOTÓN ENVIAR */}
              <button 
                onClick={handleSendReport} 
                disabled={isSubmitting || !reportText.trim() || !selectedUser}
                style={{ width: "100%", marginTop: "10px", background: "var(--text-main)", color: "var(--bg-main)", border: "none", padding: "16px", borderRadius: "12px", fontWeight: 900, cursor: isSubmitting || !reportText.trim() || !selectedUser ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", opacity: isSubmitting || !reportText.trim() || !selectedUser ? 0.6 : 1 }}
              >
                {isSubmitting ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
                {t("report.btn_submit")}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* 🌟 NUESTRO PRECIOSO MODAL DE AVISO 🌟 */}
      {customAlert && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", backdropFilter: "blur(4px)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => { if(customAlert.onClose) customAlert.onClose(); setCustomAlert(null); }}>
          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", maxWidth: "400px", width: "100%", textAlign: "center", border: "1px solid var(--color-border)", boxShadow: "0 20px 40px var(--shadow-card)" }} onClick={e => e.stopPropagation()}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 15px 0", fontSize: "24px" }}>{customAlert.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 600, marginBottom: "25px", lineHeight: "1.5" }}>{customAlert.message}</p>
            <button 
              onClick={() => { if(customAlert.onClose) customAlert.onClose(); setCustomAlert(null); }} 
              style={{ background: "var(--color-primary)", color: "white", padding: "12px 30px", borderRadius: "99px", border: "none", fontWeight: 900, cursor: "pointer", width: "100%", fontSize: "14px" }}
            >
              {t("common.understood")}
            </button>
          </div>
        </div>
      )}

      <Footer />

      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}