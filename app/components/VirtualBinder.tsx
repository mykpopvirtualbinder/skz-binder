"use client";
import React, { forwardRef } from "react";
import HTMLFlipBook from "react-pageflip";
import { X, BookOpen, Bookmark } from "lucide-react";
import { useGlobal } from "../context/GlobalContext"; // 👈 Añadido
import ImageWithExtensionFallback from "./ImageWithExtensionFallback";

type Photocard = {
  id: string | number;
  image_url: string | null;
  back_image_url?: string | null;
  name?: string | null;
  rotation?: number;
  flip?: boolean;
  separatorText?: string;
  custom_text?: string | null;
  custom_image_url?: string | null;
  custom_color?: string | null;
  isMissing?: boolean; 
  isOtw?: boolean; 
};

type LayoutType = string;

interface VirtualBinderProps {
  binderName: string;
  binderColor?: string; 
  coverUrl?: string | null; 
  pagesData: { layoutType: LayoutType; slots: (Photocard | null)[], bgColor?: string }[]; 
  onClose: () => void;
}

const Page = forwardRef<HTMLDivElement, { 
  children: React.ReactNode; 
  number?: number; 
  isCover?: boolean; 
  isBackCover?: boolean; 
  coverColor?: string; 
  coverUrl?: string | null;
  isSeparator?: boolean;
  pageBgColor?: string; 
}>(
  (props, ref) => {
    const isLeftPage = props.number ? props.number % 2 === 0 : false;

    return (
      <div 
        ref={ref} 
        data-density={props.isCover || props.isSeparator ? "hard" : "soft"} 
        style={{ backgroundColor: "transparent", overflow: 'visible' }} 
      >
        <div style={{ 
          width: "100%", height: "100%",
          marginLeft: !props.isCover && isLeftPage ? "auto" : "0",
          marginRight: !props.isCover && !isLeftPage ? "auto" : "0",
          // 👇 Aquí aplicamos el color de página dinámico
          backgroundColor: (props.isSeparator && props.coverUrl) ? "transparent" : (props.isSeparator ? (props.coverColor || "var(--color-primary)") : (props.isCover && !props.coverUrl ? (props.coverColor || "var(--color-primary)") : (props.pageBgColor || "var(--bg-main)"))),          
          backgroundImage: (props.isCover || props.isSeparator) && props.coverUrl ? `url("${props.coverUrl}")` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          // 👇 Limpiados los bordes estáticos
          borderLeft: props.isCover ? (props.isBackCover ? "1px solid var(--overlay-faint)" : "16px solid var(--overlay-faint)") : "1px solid var(--color-border)",
          borderRight: props.isCover? (props.isBackCover ? "16px solid var(--overlay-faint)": "1px solid var(--overlay-faint)") : "none",
          borderRadius: props.isCover ? (props.isBackCover ? "16px 4px 4px 16px" : "4px 16px 16px 4px") : "0",
          boxShadow: props.isCover ? "inset 8px 0 15px var(--overlay-faint), 6px 6px 20px var(--overlay-soft)" : "inset 0 0 20px color-mix(in srgb, var(--text-main) 2%, transparent)",
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center",
          position: "relative"
        }}>
          {props.children}
          
          {/* 👇 Color del número de página adaptado */}
          {!props.isCover && props.number && !props.isSeparator && (
            <div style={{ position: "absolute", bottom: "15px", [isLeftPage ? "left" : "right"]: "20px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 900 }}>
              {props.number}
            </div>
          )}
        </div>
      </div>
    );
  }
);
Page.displayName = 'Page';

export default function VirtualBinder({ binderName, binderColor = "var(--color-primary)", coverUrl, pagesData, onClose }: VirtualBinderProps) {
  const { t } = useGlobal(); // 👈 Extraemos el traductor
  const bookRef = React.useRef<any>(null);
  
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  
  const jumpTo = (pageIdx: number) => {
    if (bookRef.current) {
      bookRef.current.pageFlip().flip(pageIdx + 2);
    }
  };

  const totalCards = pagesData.flatMap(p => p.slots).filter(pc => pc !== null).length;
  const needsPaddingPage = pagesData.length % 2 !== 0;

  return (
    <div 
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} 
    style={{ 
      position: "fixed", inset: 0, 
      backgroundColor: "var(--overlay-heavy)", // Fondo oscuro inmersivo estándar
      zIndex: 9999, 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      backdropFilter: "blur(8px)",
      overflow: "visible"
    }}>
      
      <style>{`
        @keyframes swipePulse { 0%, 100% { transform: translateX(0); opacity: 0.8; } 50% { transform: translateX(8px); opacity: 1; } }
      `}</style>

      <div style={{ width: "100%", maxWidth: "900px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", padding: "0 20px" }}>
        <h2 className="tan-font" style={{ color: "white", fontSize: "24px", margin: 0, display: "flex", alignItems: "center", gap: "12px" }}>
          <BookOpen color="white" /> {t('virtual_binder.real_view')}
        </h2>
        <button onClick={onClose} style={{ background: "var(--bg-card)", border: "none", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-main)", fontWeight: "bold" }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ position: "relative", display: "flex" }}>
        
       {/* ✨ PESTAÑAS EXTERNAS ✨ */}
        <div style={{
          position: "absolute",
          right: "-35px",
          top: "10%",
          height: "80%",
          width: "35px",
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          {pagesData.map((pageData, index) => {
           if (pageData.layoutType === 'separator') {
           const separatorSlot = pageData.slots[0];
           const title = separatorSlot?.custom_text || separatorSlot?.name || t('virtual_binder.separator');
           const tabColor = separatorSlot?.custom_color || binderColor; 
           const thumbUrl = separatorSlot?.custom_image_url || separatorSlot?.image_url;
           
           // Cálculo de contraste básico para el texto de la pestaña
           const hexColor = tabColor.startsWith('#') ? tabColor : 'var(--color-primary)';
           const r = parseInt(hexColor.substr(1, 2), 16) || 0;
           const g = parseInt(hexColor.substr(3, 2), 16) || 0;
           const b = parseInt(hexColor.substr(5, 2), 16) || 0;
           const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
           const textColor = (yiq >= 128) ? 'black' : 'white';

           return (
             <div
               key={`ext-tab-${index}`}
               onClick={() => jumpTo(index * 2)}
               title={title}
               style={{
                 background: tabColor, 
                 color: textColor,
                 borderRadius: "0 8px 8px 0",
                 cursor: "pointer",
                 boxShadow: "4px 4px 10px var(--overlay-soft)",
                 border: "1px solid color-mix(in srgb, var(--bg-card) 20%, transparent)",
                 borderLeft: "none",
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center", 
                 flex: 1,
                 maxHeight: "15%", 
                 padding: "8px 4px",
                 overflow: "hidden",
                 gap: "4px", 
               }}
             >
                {thumbUrl && (
                  <img src={thumbUrl} style={{width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover'}} alt="" />
                )}
                <span style={{
                  writingMode: "vertical-rl", 
                  textTransform: "uppercase",
                  fontSize: "11px",
                  fontWeight: 900,
                  whiteSpace: "nowrap", 
                  overflow: "visible",
                  lineHeight: "1.2",
                  textOverflow: "ellipsis", 
                }}>
                  {title}
                </span>
             </div>
           );
             }
             return null;
          })}
        </div>

        <div style={{ width: "95vw", maxWidth: "1000px", height: "85vh", maxHeight: "750px", position: "relative" }}>
          {/* @ts-ignore */}
          <HTMLFlipBook 
            ref={bookRef}
            width={530} height={730} size="stretch" 
            minWidth={400} maxWidth={800} minHeight={550} maxHeight={900} 
            maxShadowOpacity={0.5} showCover={true} mobileScrollSupport={true} 
            usePortrait={false} 
            className="virtual-binder" style={{ margin: "0 auto" }}
          >
          
            <Page key="cover-front" isCover={true} coverColor={binderColor} coverUrl={coverUrl}>
              <div style={{ position: "absolute", bottom: "30px", right: "20px", display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-card)", padding: "8px 16px", borderRadius: "99px", fontWeight: 900, color: "var(--text-main)", fontSize: "12px", boxShadow: "0 4px 12px var(--overlay-soft)", animation: "swipePulse 1.5s infinite ease-in-out", pointerEvents: "none", zIndex: 20 }}>
                {t('virtual_binder.open_album')} <span>👉</span>
              </div>
            </Page>

            <Page key="cover-inside" isCover={false}>
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ 
                  textAlign: "center", padding: "30px 20px", backgroundColor: "var(--bg-card)", 
                  borderRadius: "16px", width: "75%", boxShadow: "0 8px 24px var(--shadow-card)", border: "1px solid var(--color-border)" 
                }}>
                  <h1 className="tan-font" style={{ color: "var(--text-main)", fontSize: "32px", margin: "0 0 10px 0" }}>{binderName}</h1>
                  <div style={{ height: "2px", background: binderColor, width: "40px", margin: "0 auto 10px auto" }} />
                  <p style={{ color: "var(--text-muted)", fontWeight: 900, fontSize: "12px" }}>{totalCards} {t('virtual_binder.photocards')}</p>
                </div>
              </div>
            </Page>

            {/* 🛑 RENDER DE PÁGINAS (Página DOBLE: Anverso y Reverso) 🛑 */}
            {pagesData.flatMap((pageData, index) => {
              if (pageData.layoutType === 'separator') {
                const bgImage = pageData.slots[0]?.custom_image_url || pageData.slots[0]?.image_url || null; 

                return [
                  // Cara A (Derecha)
                  <Page key={`sep-f-${index}`} isSeparator={true} number={(index * 2) + 1} coverColor={pageData.slots[0]?.custom_color || binderColor} coverUrl={bgImage}>
                   {!bgImage && (
                    <div style={{ color: "white", textAlign: "center" }}>
                       {pageData.slots[0]?.custom_text ? (
                          <h2 style={{ fontSize: "40px", fontWeight: 900, textTransform: "uppercase", margin: 0, opacity: 0.8 }}>
                             {pageData.slots[0].custom_text}
                          </h2>
                       ) : (
                          <Bookmark size={80} style={{ opacity: 0.2 }} />
                       )}
                    </div>
                  )}
                  </Page>,
                  // Cara B (Izquierda - Reverso)
                  <Page key={`sep-b-${index}`} isSeparator={true} number={(index * 2) + 2} coverColor={pageData.slots[0]?.custom_color || binderColor} coverUrl={bgImage}>
                   {!bgImage && (
                    <div style={{ color: "white", textAlign: "center" }}>
                       {pageData.slots[0]?.custom_text ? (
                          <h2 style={{ fontSize: "40px", fontWeight: 900, textTransform: "uppercase", margin: 0, opacity: 0.8 }}>
                             {pageData.slots[0].custom_text}
                          </h2>
                       ) : (
                          <Bookmark size={80} style={{ opacity: 0.2 }} />
                       )}
                    </div>
                  )}
                  </Page>
                ];
              }

              const renderGridSide = (pData: any, side: "front" | "back") => {
                let gridCols = "repeat(3, minmax(0, 1fr))";
                let gridRows = "repeat(3, minmax(0, 1fr))"; 
                const layout = pData.layoutType || "";
                
                if (layout.includes('2x3')) { gridCols = "repeat(2, minmax(0, 1fr))"; gridRows = "repeat(3, minmax(0, 1fr))"; }
                else if (layout.includes('3x2')) { gridCols = "repeat(3, minmax(0, 1fr))"; gridRows = "repeat(2, minmax(0, 1fr))"; }
                else if (layout.includes('2x2') || layout.includes('4')) { gridCols = "repeat(2, minmax(0, 1fr))"; gridRows = "repeat(2, minmax(0, 1fr))"; }
                else if (layout.includes('1x4')) { gridCols = "minmax(0, 1fr)"; gridRows = "repeat(4, minmax(0, 1fr))"; }
                else if (layout.includes('1x1')) { gridCols = "minmax(0, 1fr)"; gridRows = "minmax(0, 1fr)"; }

                return (
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: gridCols, 
                    gridTemplateRows: gridRows, 
                    gap: "10px",
                    width: "80%",
                    height: "80%",
                    alignContent: "center", 
                    justifyItems: "center",
                    transform: side === "back" ? "scaleX(-1)" : "none" 
                  }}>
                    {pData.slots.map((pc: any, slotIndex: number) => {
                      const baseScaleX = pc?.flip ? -1 : 1;
                      const finalScaleX = side === "back" ? baseScaleX * -1 : baseScaleX;
                      const frontImgSrc = pc?.image_url;
                      const backImgSrc = pc ? (pc.back_image_url || pc.backImageUrl || pc.back_image || pc.backUrl) : null;
                      const finalSrc = side === "front" 
                        ? (frontImgSrc || "/mock-pcs/groups/not-available.png") 
                        : (backImgSrc || "/mock-pcs/groups/default-back.png");

                      return (
                        <div key={`slot-${side}-${slotIndex}`} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          <div style={{ width: "100%", height: "100%", position: "relative" }}>
                            {pc ? (
                              <>
                                <ImageWithExtensionFallback
                                  src={finalSrc}
                                  frontSrcForBack={side === "back" ? (frontImgSrc ?? undefined) : undefined}
                                  fallbackSrc={side === "back" ? "/mock-pcs/groups/default-back.png" : "/mock-pcs/groups/not-available.png"}
                                  alt=""
                                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: `rotate(${pc.rotation || 0}deg) scaleX(${finalScaleX})`, transition: "all 0.3s ease" }}
                                />
                                
                               {/* 🌟 ETIQUETA WISH */}
                                {pc.isMissing && (
                                  <div style={{ position: "absolute", top: "6px", left: "6px", background: "var(--bg-main)", color: "var(--color-primary)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 900, border: "1px solid var(--color-primary)", zIndex: 10 }}>
                                    {t('virtual_binder.wish')}
                                  </div>
                                )}

                                {/* 🚚 ETIQUETA OTW */}
                                {pc.isOtw && (
                                  <div style={{ position: "absolute", top: "6px", right: "6px", background: "var(--state-info-bg)", color: "var(--state-info-fg)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 900, border: "1px solid var(--state-info-border)", zIndex: 10 }}>
                                    {t('virtual_binder.otw')}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 900 }}>
                                {t('virtual_binder.empty')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              };

             return [
                <Page key={`page-f-${index}`} number={(index * 2) + 1} pageBgColor={pageData.bgColor}>
                  {renderGridSide(pageData, "front")}
                </Page>,
                <Page key={`page-b-${index}`} number={(index * 2) + 2} pageBgColor={pageData.bgColor}>
                  {renderGridSide(pageData, "back")}
                </Page>
              ];
            })}

            <Page key="padding-logic" isCover={false}>
              {needsPaddingPage ? (
                <div style={{ padding: "40px", textAlign: "center" }}></div>
              ) : (
                <div style={{ display: 'none' }}></div>
              )}
            </Page>

            <Page key="back-inside" isCover={false}>
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px" }}>
                <p>{t('virtual_binder.back_cover_inside')}</p>
              </div>
            </Page>

            <Page key="back-cover-hard" isCover={true} isBackCover={true} coverColor={binderColor} coverUrl={coverUrl}>
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, position: "relative" }}>
                <div style={{ background: "var(--overlay-soft)", padding: "20px", borderRadius: "50%" }}>
                  <img src="/branding/logo.png" alt="Logo" style={{ width: "120px", opacity: 0.8, filter: "brightness(0) invert(1)" }} />
                </div>
              </div>
            </Page>

          </HTMLFlipBook>
        </div>
      </div>
    </div> 
  );
}