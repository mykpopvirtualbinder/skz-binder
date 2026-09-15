"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGlobal } from "../context/GlobalContext";
import { supabase } from "@/lib/supabase";

import Footer from "../components/footer";
import { 
  ShoppingBag, Crown, Plus, X, Sparkles, CheckCircle2,
  LayoutGrid, Image as ImageIcon, BookOpen, Bookmark, CreditCard, Info
} from "lucide-react";

const TAB_ACCENTS: Record<string, string> = {
  suscripcion: "var(--shop-tab-suscripcion)",
  binders: "var(--shop-tab-binders)",
  paginas: "var(--shop-tab-paginas)",
  separadores: "var(--shop-tab-binders)",
  koins: "var(--shop-tab-koins)",
};

const PRODUCTOS = {
  suscripcion: [
    { 
      id: 'vip_month', 
      name: 'Suscripción Mensual', 
      desc: 'Sube de nivel tu colección con colores, layouts y hasta 30 páginas.', 
      price: 2.99, 
      isSub: true, 
      pointPriceVIP: 1500,
      features: [
        'Límite ampliado: ¡Hasta 30 páginas por binder!',
        'Límite ampliado: ¡Hasta 15 separadores por binder!',
        'Colores de perfil 100% personalizados',
        'Layouts exclusivos para colocar tus photocards',
        '50% de descuento en expansiones de la tienda',
        'Insignia VIP en tu perfil público'
      ]
    },
    { 
      id: 'vip_year', 
      name: 'Suscripción Anual', 
      desc: 'El máximo poder: hasta 60 páginas y 2 meses gratis.', 
      price: 29.90, 
      isSub: true, 
      popular: true, 
      pointPriceVIP: 15000,
      features: [
        'Límite SUPERIOR: ¡Hasta 60 páginas por binder!',
        'Límite SUPERIOR: ¡Hasta 30 separadores por binder!',
        '¡Te ahorras 2 meses completos!',
        'Colores de perfil 100% personalizados',
        'Layouts exclusivos para colocar tus photocards',
        '50% de descuento en expansiones de la tienda',
        'Insignia VIP dorada especial en tu perfil'
      ]
    },
  ],
  binders: [
    { id: 'b_1', name: '+1 Binder Extra', price: 1.99, vipPrice: 0.99, pointPriceVIP: 200 },
    { id: 'b_3', name: 'Pack 3 Binders', price: 4.99, vipPrice: 2.49, popular: true, pointPriceVIP: 500 },
    { id: 'b_6', name: 'Pack 6 Binders', price: 8.99, vipPrice: 4.49, pointPriceVIP: 900 },
  ],
  paginas: [
    { id: 'p_3', name: 'Pack 3 Páginas', price: 0.99, vipPrice: 0.49, pointPriceVIP: 100 },
    { id: 'p_6', name: 'Pack 6 Páginas', price: 1.49, vipPrice: 0.79, popular: true, pointPriceVIP: 150 },
    { id: 'p_9', name: 'Pack 9 Páginas', price: 1.99, vipPrice: 0.99, pointPriceVIP: 200 },
    { id: 'p_12', name: 'Pack 12 Páginas', price: 2.49, vipPrice: 1.25, pointPriceVIP: 250 },
  ],
  separadores: [
    { id: 's_5', name: 'Pack 5 Separadores', price: 0.99, vipPrice: 0.49, pointPriceVIP: 100 },
    { id: 's_10', name: 'Pack 10 Separadores', price: 1.49, vipPrice: 0.79, popular: true, pointPriceVIP: 150 },
    { id: 's_15', name: 'Pack 15 Separadores', price: 1.99, vipPrice: 0.99, pointPriceVIP: 200 },
    { id: 's_20', name: 'Pack 20 Separadores', price: 2.49, vipPrice: 1.25, pointPriceVIP: 250 },
  ],
  koins: [
    { id: 'k_500', name: 'Pack 500 K-oins', desc: 'Ideal para pequeños regalos y ajustes en tu colección.', price: 4.99, koinsAmount: 500 },
    { id: 'k_1200', name: 'Pack 1,200 K-oins', desc: '¡Llévate 200 K-oins extra de regalo!', price: 9.99, popular: true, koinsAmount: 1200 },
    { id: 'k_3000', name: 'Pack 3,000 K-oins', desc: '¡El mejor valor! 500 K-oins extra para los más coleccionistas.', price: 24.99, koinsAmount: 3000 },
  ]
};

export default function ShopClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, refreshGlobal, showAlert, t } = useGlobal();
  
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string, percent: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [infoModal, setInfoModal] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [usedCounts, setUsedCounts] = useState({ binders: 0, pages: 0, separators: 0 });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const VIP_WELCOME_MONTH = 300;
  const VIP_WELCOME_YEAR = 1800;

  const localizedProducts = useMemo(() => {
    const localizeProduct = (prod: any) => ({
      ...prod,
      name: t(`shop.products.${prod.id}_name`) || prod.name,
      desc: prod.desc ? (t(`shop.products.${prod.id}_desc`) || prod.desc) : prod.desc,
      features:
        prod.id === "vip_month"
          ? [
              t("shop.vip_features.f1"),
              t("shop.vip_features.f2"),
              t("shop.vip_features.f3"),
              t("shop.vip_features.f4"),
              t("shop.vip_features.f5"),
              t("shop.vip_features.f6"),
            ]
          : prod.id === "vip_year"
          ? [
              t("shop.vip_features.f7"),
              t("shop.vip_features.f8"),
              t("shop.vip_features.f9"),
              t("shop.vip_features.f3"),
              t("shop.vip_features.f4"),
              t("shop.vip_features.f5"),
              t("shop.vip_features.f10"),
            ]
          : prod.features,
    });

    return {
      suscripcion: PRODUCTOS.suscripcion.map(localizeProduct),
      binders: PRODUCTOS.binders.map(localizeProduct),
      paginas: PRODUCTOS.paginas.map(localizeProduct),
      separadores: PRODUCTOS.separadores.map(localizeProduct),
      koins: PRODUCTOS.koins.map(localizeProduct),
    };
  }, [t]);

  const checkDiscount = () => {
    const code = discountCode.toUpperCase().trim();
    if (code === "CUMPLE100") {
      setDiscountApplied({ code, percent: 100 });
      showAlert(t("shop.discount_success_title"), t("shop.discount_success_msg"));
    } else if (code === "MKB50") {
      setDiscountApplied({ code, percent: 50 });
      showAlert(t("shop.discount_50_title"), t("shop.discount_50_msg"));
    } else {
      showAlert(t("shop.discount_error_title"), t("shop.discount_error_msg"));
      setDiscountApplied(null);
    }
  };

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success" && checkout !== "cancel") return;
    const flag = `mkb_shop_checkout_${checkout}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(flag)) {
      router.replace("/shop", { scroll: false });
      return;
    }
    if (typeof window !== "undefined") sessionStorage.setItem(flag, "1");
    if (checkout === "success") {
      showAlert(t("shop.checkout_success_title"), t("shop.checkout_success_msg"));
      refreshGlobal();
    } else {
      showAlert(t("shop.checkout_cancel_title"), t("shop.checkout_cancel_msg"));
    }
    router.replace("/shop", { scroll: false });
  }, [searchParams, router, showAlert, t, refreshGlobal]);

  useEffect(() => {
    async function fetchUsage() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: bData } = await supabase.from('binders').select('id').eq('user_id', auth.user.id);
      const bIds = bData?.map(b => b.id) || [];
      let pCount = 0, sCount = 0;
      if (bIds.length > 0) {
        const { data: pages } = await supabase.from('binder_pages').select('layout_type').in('binder_id', bIds);
        pCount = pages?.filter(p => p.layout_type !== 'separator').length || 0;
        sCount = pages?.filter(p => p.layout_type === 'separator').length || 0;
      }
      setUsedCounts({ binders: bIds.length, pages: pCount, separators: sCount });
    }
    fetchUsage();
  }, []);
  
  const activeTab = searchParams.get("item") || "suscripcion";
  
  const userPuntos = profile?.puntos || 0;
  const isUserVip = profile?.is_premium || false;
  const isAdmin = (profile as any)?.is_admin === true;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const startStripeCheckout = async (prod: any) => {
    try {
      setCheckoutLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        showAlert(t("shop.checkout_login_title"), t("shop.checkout_login_msg"));
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        showAlert(t("shop.checkout_login_title"), t("shop.checkout_login_msg"));
        return;
      }
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: prod.id,
          discountCode: discountApplied?.code ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(
          t("shop.payment_error_title"),
          typeof data?.error === "string" ? data.error : t("shop.checkout_error_generic")
        );
        return;
      }
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }
      showAlert(t("shop.payment_error_title"), t("shop.checkout_error_generic"));
    } catch (e: any) {
      showAlert(t("shop.payment_error_title"), e?.message || t("shop.checkout_error_generic"));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckout = (prod: any, displayEuro?: number) => {
    const euro =
      typeof displayEuro === "number" && !Number.isNaN(displayEuro)
        ? displayEuro
        : typeof prod.price === "number"
          ? prod.price
          : Number(prod.price) || 0;
    const priceLabel = String(euro);
    const koinsAmount = prod.koinsAmount;
    const msg =
      prod.id.startsWith("k_") && koinsAmount != null
        ? (t("shop.buy_koins_msg") || "")
            .replace("{price}", priceLabel)
            .replace("{koins}", String(koinsAmount))
        : (t("shop.checkout_confirm_msg") || "")
            .replace("{id}", prod.id)
            .replace("{price}", priceLabel);

    setConfirmDialog({
      title: prod.id.startsWith("k_") ? t("shop.buy_koins_title") : t("shop.btn_buy"),
      message: msg || `Pago seguro con Stripe (${priceLabel}€).`,
      onConfirm: () => {
        void startStripeCheckout(prod);
      },
    });
  };

  const handleRedeemPoints = async (prod: any, originalPointPrice: number) => {
    if (prod.id.startsWith('k_')) return; 

    const discountMultiplier = discountApplied ? (1 - discountApplied.percent / 100) : 1;
    let finalPointPrice = originalPointPrice;
    const isFreeClaim = originalPointPrice === 0;

    setConfirmDialog({
      title: isFreeClaim ? t("shop.redeem_free_title") : t("shop.redeem_koins_title"),
      message: isFreeClaim 
        ? t('shop.redeem_free_msg')?.replace('{name}', prod.name) || `¿Quieres canjear tu cupo gratuito por "${prod.name}"?` 
        : t('shop.redeem_koins_msg')?.replace('{price}', finalPointPrice.toString()).replace('{name}', prod.name) || `¿Quieres canjear ${finalPointPrice} K-oins por "${prod.name}"?`,
      onConfirm: async () => {
        try {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) return;

          if (finalPointPrice > 0) {
            const { error: puntosError } = await supabase
              .from('profiles')
              .update({ puntos: userPuntos - finalPointPrice })
              .eq('user_id', auth.user.id);
            if (puntosError) throw puntosError;
          }

          const updates: any = {};

          if (prod.id.startsWith('b_')) {
            const bindersComprados = prod.id === 'b_1' ? 1 : prod.id === 'b_3' ? 3 : 6;
            
            const listadoNuevosBinders = Array.from({ length: bindersComprados }).map(() => ({
              user_id: auth.user.id,
              title: "NUEVO BINDER",
              color: "var(--color-border)", 
              public_customization: true
            }));

            const { error: bError } = await supabase.from('binders').insert(listadoNuevosBinders);
            if (bError) throw bError;

            updates.extra_binders = ((profile as any)?.extra_binders || 0) + bindersComprados;
            if (isFreeClaim) updates.binders_claimed = ((profile as any)?.binders_claimed || 0) + 1;
          }
          else if (prod.id.startsWith('p_')) {
            const comprados = parseInt(prod.id.split('_')[1]); 
            updates.extra_pages = ((profile as any)?.extra_pages || 0) + comprados;
            if (isFreeClaim) updates.pages_claimed = ((profile as any)?.pages_claimed || 0) + 1;
          }
          else if (prod.id.startsWith('s_')) {
            const comprados = parseInt(prod.id.split('_')[1]);
            updates.extra_separators = ((profile as any)?.extra_separators || 0) + comprados;
            if (isFreeClaim) updates.separators_claimed = ((profile as any)?.separators_claimed || 0) + 1;
          }

          const { error: updateError } = await supabase.from('profiles').update(updates).eq('user_id', auth.user.id);
          if (updateError) throw updateError;
          
          showAlert(t("shop.redeem_success_title"), t("shop.redeem_success_msg").replace('{name}', prod.name));
          refreshGlobal();
        } catch (err: any) {
          showAlert(t("shop.payment_error_title"), "No se pudo completar: " + err.message);
        }
      }
    });
  };

  const tabAccent = (key: string) => TAB_ACCENTS[key] || "var(--color-primary)";

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)", borderRadius: 24, padding: 24, border: "1px solid var(--color-border)",
    boxShadow: "0 10px 25px var(--shadow-card)", display: "flex",
    flexDirection: "column", transition: "all 0.3s ease", position: "relative", overflow: "hidden"
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: 18,
    right: -42,
    width: 170,
    background: "linear-gradient(90deg, #ff4fd8, #8b5cf6, #3b82f6)",
    color: "white",
    padding: "7px 0",
    fontSize: 11,
    letterSpacing: "0.04em",
    fontWeight: 950,
    transform: "rotate(45deg)",
    boxShadow: "0 8px 20px var(--overlay-faint)",
    textAlign: "center",
    textTransform: "uppercase",
  };

  const renderProducts = (items: any[]) => (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      {items.map((prod) => {
        
        const rawPlan = (profile as any)?.plan_type || "free";
        const effectivePlan = isUserVip && rawPlan === "free" ? "mensual" : rawPlan;

        const limits = {
          free: { binders: 3, pages: 30, separators: 5 },
          mensual: { binders: 15, pages: 60, separators: 15 },
          anual: { binders: 50, pages: 90, separators: 30 }
        };

        const userBaseLimit = limits[effectivePlan as keyof typeof limits] || limits.free;

        let packSize = 1;
        if (prod.id.includes('_3')) packSize = 3;
        if (prod.id.includes('_6')) packSize = 6;
        if (prod.id.includes('_10')) packSize = 10;
        if (prod.id.includes('_12')) packSize = 12;
        if (prod.id.includes('_15')) packSize = 15;
        if (prod.id.includes('_20')) packSize = 20;

        let cabeEnPlanGratis = false;

        if (prod.id.startsWith('b_')) {
          cabeEnPlanGratis = (usedCounts.binders + packSize) <= userBaseLimit.binders;
        } else if (prod.id.startsWith('p_')) {
          cabeEnPlanGratis = (usedCounts.pages + packSize) <= userBaseLimit.pages;
        } else if (prod.id.startsWith('s_')) {
          cabeEnPlanGratis = (usedCounts.separators + packSize) <= userBaseLimit.separators;
        }

        const isFreeVIP = (isAdmin || isUserVip) && cabeEnPlanGratis && !prod.isSub && !prod.id.startsWith('k_');

        let currentEuroPrice = prod.price;
        if (isFreeVIP) currentEuroPrice = 0;
        else if (isUserVip && prod.vipPrice) currentEuroPrice = prod.vipPrice;

        let currentKoinPrice = Math.round(prod.price * 100);
        if (isFreeVIP) currentKoinPrice = 0;
        else if (isUserVip && prod.pointPriceVIP) currentKoinPrice = prod.pointPriceVIP;

        const canAfford = userPuntos >= currentKoinPrice;

        const accent = tabAccent(activeTab);
        return (
          <div
            key={prod.id}
            style={{
              ...cardStyle,
              ...(prod.popular
                ? {
                    border: `2px solid ${accent}`,
                    boxShadow: `0 12px 32px color-mix(in srgb, ${accent} 22%, var(--shadow-card))`,
                  }
                : {
                    border: "1px solid var(--color-border)",
                    borderTop: `4px solid ${accent}`,
                  }),
            }}
          >
           {prod.popular && <div style={badgeStyle}>★ {t("shop.popular")} ★</div>}
            <h3 style={{ color: accent, fontSize: "20px", fontWeight: 900, margin: "0 0 10px 0" }}>{prod.name}</h3>
            {prod.desc && <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.5, marginBottom: "10px" }}>{prod.desc}</p>}
            
            {prod.isSub && (
              <button 
                onClick={() => setInfoModal(prod)} 
                style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 900, fontSize: "13px", cursor: "pointer", padding: 0, textAlign: "left", textDecoration: "underline", marginBottom: "15px" }}
              >
                {t("shop.see_more")}
              </button>
            )}

            <div style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px dashed var(--color-border)" }}>
              <div style={{ marginBottom: "20px" }}>
                {prod.isSub ? (
                  <div style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)" }}>
                    {prod.price}€ <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 700 }}>/ {prod.id === 'vip_month' ? t("shop.month") : t("shop.year")}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    
                    <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                      {isFreeVIP ? (
                        <>
                          <span style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-muted)", textDecoration: "line-through" }}>{prod.price}€</span>
                          <span style={{ fontSize: "24px", fontWeight: 900, color: "var(--color-primary)" }}>{t("shop.free")}</span>
                        </>
                      ) : isUserVip && prod.vipPrice ? (
                        <>
                          <span style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-muted)", textDecoration: "line-through" }}>{prod.price}€</span>
                          <span style={{ fontSize: "32px", fontWeight: 900, color: "var(--color-primary)" }}>{currentEuroPrice}€</span>
                          <span style={{ fontSize: "12px", background: "var(--bg-soft)", color: "var(--color-primary)", padding: "2px 6px", borderRadius: "4px", fontWeight: 900 }}>VIP</span>
                        </>
                      ) : (
                        <span style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)" }}>{currentEuroPrice}€</span>
                      )}
                    </div>
                    
                    {!prod.id.startsWith('k_') && !isFreeVIP && (
                      <div style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
                        o <Sparkles size={14} /> {currentKoinPrice} K-oins
                      </div>
                    )}

                    {prod.id.startsWith('k_') && (
                      <div style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Sparkles size={14} /> {t('shop.receive_koins')?.replace('{koins}', prod.koinsAmount.toString()) || `Recibes ${prod.koinsAmount} K-oins`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {isFreeVIP ? (
                  <button onClick={() => handleRedeemPoints(prod, 0)} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", background: "var(--color-primary)", color: "white", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <Crown size={18} /> {t("shop.btn_vip_free")}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={checkoutLoading}
                      onClick={() => handleCheckout(prod, currentEuroPrice)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "none",
                        background: checkoutLoading ? "var(--bg-soft)" : "var(--text-main)",
                        color: "var(--bg-main)",
                        fontWeight: 900,
                        cursor: checkoutLoading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        opacity: checkoutLoading ? 0.75 : 1,
                      }}
                    >
                      <CreditCard size={18} /> {checkoutLoading ? t("common.loading") : t("shop.btn_buy")}
                    </button>
                    
                    {!prod.isSub && !prod.id.startsWith('k_') && (
                      <button disabled={!canAfford} onClick={() => handleRedeemPoints(prod, currentKoinPrice)} style={{ width: "100%", padding: "12px", borderRadius: "14px", border: "2px solid var(--color-primary)", background: canAfford ? "var(--bg-card)" : "var(--bg-soft)", color: canAfford ? "var(--color-primary)" : "var(--text-muted)", fontWeight: 900, cursor: canAfford ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: canAfford ? 1 : 0.6 }}>
                        <Sparkles size={16} /> {canAfford ? t("shop.btn_redeem") : t("shop.btn_missing_koins")}
                      </button>
                    )}

                    {prod.isSub && isUserVip && (
                      <button disabled={!canAfford} onClick={() => handleRedeemPoints(prod, currentKoinPrice)} style={{ width: "100%", padding: "12px", borderRadius: "14px", border: "2px solid var(--color-primary)", background: canAfford ? "var(--bg-card)" : "var(--bg-soft)", color: canAfford ? "var(--color-primary)" : "var(--text-muted)", fontWeight: 900, cursor: canAfford ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: canAfford ? 1 : 0.6 }}>
                        <Sparkles size={16} /> {canAfford ? t("shop.btn_renew") : t("shop.btn_missing_koins")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const TABS = [
    { key: "suscripcion", label: `👑 ${t('shop.tab_vip')}`, icon: <Crown size={16} /> },
    { key: "binders", label: `🏢 ${t('shop.tab_binders')}`, icon: <BookOpen size={16} /> },
    { key: "paginas", label: `📄 ${t('shop.tab_pages')}`, icon: <LayoutGrid size={16} /> },
    { key: "separadores", label: `🔖 ${t('shop.tab_separators')}`, icon: <Bookmark size={16} /> },
    { key: "koins", label: `✨ ${t('shop.tab_koins')}`, icon: <Sparkles size={16} /> }
  ];

  return (
    <div
      className="shop-page-shell"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", transition: "background-color 0.3s ease" }}
    >
      <main className="shop-main" style={{ flex: 1, width: "100%", maxWidth: 1120, margin: "0 auto", padding: isMobile ? "20px 15px" : "40px 20px" }}>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div className="shop-koins-glow" style={{ padding: "12px 26px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 8px 28px var(--shadow-card)" }}>
            <Sparkles size={20} color="var(--color-primary)" fill="var(--color-primary)" />
            <span style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "16px" }}>
              {t("shop.your_koins")}{" "}
              <span style={{ color: "var(--color-primary)", fontSize: "22px", textShadow: "0 0 24px color-mix(in srgb, var(--color-primary) 35%, transparent)" }}>
                {userPuntos}
              </span>
            </span>
            <button
              type="button"
              title={t("shop.koins_info_title") || "Información sobre K-oins"}
              onClick={() =>
                showAlert(
                  t("shop.koins_info_title") || "Tus K-oins",
                  t("shop.koins_info_body") ||
                    "Los K-oins se ganan por actividad en la web: publicaciones e interacciones en Fan Zone (comentarios/reposteos = 1 K-oin), nuevas publicaciones con contenido trabajado (ej.: +50 letras = 5 K-oins), subir arte (100 K-oins), denuncias con fundamento y colaborar subiendo fotos de PCs. Puedes canjearlos en Shop por extras y ventajas dentro de la app."
                )
              }
              style={{ border: "none", background: "transparent", color: "var(--color-primary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <Info size={16} />
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <h1
            className="tan-font shop-hero-headline"
            style={{ fontSize: isMobile ? 32 : 46, fontWeight: 950, margin: "0 0 10px 0", lineHeight: 1.15 }}
          >
            {t("shop.title")}
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 600 }}>
            {t("shop.subtitle")}
          </p>
        </div>

        <div style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 15, marginBottom: 40, flexWrap: "wrap" }}>
            {TABS.map((tab) => {
              const ac = tabAccent(tab.key);
              const on = activeTab === tab.key;
              return (
              <button 
                key={tab.key} 
                onClick={() => router.push(`/shop?item=${tab.key}`)} 
                style={{ 
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 99, 
                  border: `2px solid ${ac}`, cursor: "pointer", fontWeight: 900, transition: "all 0.2s ease", fontSize: 14, 
                  background: on
                    ? `linear-gradient(145deg, color-mix(in srgb, ${ac} 88%, white), ${ac})`
                    : "color-mix(in srgb, var(--bg-card) 92%, transparent)",
                  color: on ? "#fff" : "var(--text-main)", 
                  boxShadow: on ? `0 6px 22px color-mix(in srgb, ${ac} 35%, transparent)` : "0 2px 10px var(--shadow-card)",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            );})}
          </div>
          
          {activeTab === 'suscripcion' && renderProducts(localizedProducts.suscripcion)}
          {activeTab === 'binders' && renderProducts(localizedProducts.binders)}
          {activeTab === 'paginas' && renderProducts(localizedProducts.paginas)}
          {activeTab === 'separadores' && renderProducts(localizedProducts.separadores)}
          {activeTab === 'koins' && renderProducts(localizedProducts.koins)}
        </div>

      {/* 🌟 MODAL PRECIOSO DE LA TIENDA 🌟 */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", backdropFilter: "blur(4px)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setConfirmDialog(null)}>
          <div style={{ background: "var(--bg-card)", padding: "30px", borderRadius: "24px", maxWidth: "420px", width: "100%", textAlign: "center", border: "1px solid var(--color-border)", boxShadow: "0 20px 40px var(--shadow-card)" }} onClick={e => e.stopPropagation()}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 15px 0", fontSize: "24px" }}>{confirmDialog.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 600, marginBottom: "25px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }}>
                {t("shop.cancel")}
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} style={{ flex: 1, background: "var(--color-primary)", color: "white", border: "none", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }}>
                {t("shop.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL DE MÁS INFORMACIÓN (VIP) 🌟 */}
      {infoModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", backdropFilter: "blur(4px)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setInfoModal(null)}>
          <div style={{ background: "var(--bg-main)", padding: "30px", borderRadius: "24px", maxWidth: "450px", width: "100%", border: "1px solid var(--color-border)", boxShadow: "0 20px 40px var(--shadow-card)", position: "relative" }} onClick={e => e.stopPropagation()}>
            
            <button onClick={() => setInfoModal(null)} style={{ position: "absolute", top: "15px", right: "15px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={24} />
            </button>
            
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <Crown size={40} color="var(--color-primary)" fill="color-mix(in srgb, var(--color-primary) 35%, transparent)" style={{ marginBottom: "10px" }} />
              <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0", fontSize: "28px" }}>{infoModal.name}</h3>
              <p style={{ fontSize: "18px", fontWeight: 900, color: "var(--text-main)", margin: "5px 0 0 0" }}>{infoModal.price}€ {infoModal.id === 'vip_month' ? t('shop.month') : t('shop.year')}</p>
            </div>

            <div style={{ background: "var(--bg-soft)", borderRadius: "16px", padding: "20px", border: "1px solid var(--color-border)", marginBottom: "25px" }}>
              <h4 style={{ color: "var(--color-primary)", margin: "0 0 15px 0", fontSize: "16px", fontWeight: 900 }}>
                {t("shop.vip_benefits")}
              </h4>
              <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                {(infoModal.features || []).map((feat: string, idx: number) => (
                  <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--text-main)", fontWeight: 600, lineHeight: 1.4 }}>
                    <CheckCircle2 size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    {feat}
                  </li>
                ))}
                {[
                  t("shop.vip_plus_theme") || "Selector completo de temas visuales (incluye temas VIP).",
                  t("shop.vip_plus_cursor") || "Cursores premium exclusivos para navegar por toda la web.",
                  t("shop.vip_plus_special_prices") || "Precios especiales una vez superas el cupo gratuito de tu plan.",
                  t("shop.vip_plus_welcome_koins")?.replace(
                    "{amount}",
                    String(infoModal.id === "vip_year" ? VIP_WELCOME_YEAR : VIP_WELCOME_MONTH)
                  ) ||
                    `Regalo de bienvenida: ${infoModal.id === "vip_year" ? VIP_WELCOME_YEAR : VIP_WELCOME_MONTH} K-oins.`,
                ].map((feat, idx) => (
                  <li key={`extra-${idx}`} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--text-main)", fontWeight: 600, lineHeight: 1.4 }}>
                    <CheckCircle2 size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            <button
              disabled={checkoutLoading}
              onClick={() => {
                setInfoModal(null);
                handleCheckout(infoModal, infoModal.price);
              }}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                border: "none",
                background: checkoutLoading ? "var(--bg-soft)" : "var(--color-primary)",
                color: "white",
                fontWeight: 900,
                cursor: checkoutLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "16px",
                transition: "opacity 0.2s",
                opacity: checkoutLoading ? 0.75 : 1,
              }}
            >
              <CreditCard size={20} /> {checkoutLoading ? t("common.loading") : t("shop.btn_buy_now")}
            </button>

          </div>
        </div>
      )}

      </main>
      <Footer />
    </div>
  );
}