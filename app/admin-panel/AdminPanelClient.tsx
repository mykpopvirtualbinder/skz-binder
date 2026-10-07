"use client";

import React, { useState, useEffect, useRef } from "react";

import { supabase } from "@/lib/supabase";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { useGlobal } from "../context/GlobalContext";
import {
  UploadCloud, Save, Download, Loader2, Plus, Minus, FileText, Film,
  Image as ImageIcon, ImagePlus, CheckCircle2, BookOpen,
  AlertTriangle, Star, Users, ShieldAlert, Mail, PenTool,
  Heart, Flag, CheckCircle, FilePlus, X,
  Trash2, ChevronLeft, ChevronRight, ExternalLink, Sparkles, UserX,
  ListFilter, Undo2, Search, RefreshCw,
  Crown, Ban, HelpCircle, MailOpen, ChevronDown, ChevronUp, Tags,
  KeyRound, Unlock, Lock, LogOut
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import CatalogLoadingFun from "../components/CatalogLoadingFun";
import { splitTitleBody } from "@/lib/fanfic-translation";
import {
  ADMIN_QUEUE_SUBJECT,
  actorFromEmail,
  aportacionNativeStatus,
  emptyCase,
  parseQueueMessage,
  queueKey,
  statusLabel,
  type QueueCase,
  type QueueKind,
} from "@/lib/admin-queue";
import { AdminQueueBar, AdminQueueFilters, caseMatchesFilters, historyOf } from "./AdminQueueBar";
import AdminManual from "./AdminManual";



type AdPlacement = "sidebar_left" | "sidebar_right" | "tablet_sidebar" | "mobile_inline_top" | "mobile_inline_bottom";
type AdDevice = "desktop" | "tablet" | "mobile";

type AdminAdCampaign = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  target_url: string;
  placement: AdPlacement;
  device: AdDevice;
  section: string | null;
  priority: number;
  active: boolean;
  start_at: string;
  end_at: string;
};

type AdminAccountBucket = "alta" | "baja" | "pendiente" | "restringido";
type AdminUsersFilter =
  | "todos"
  | AdminAccountBucket
  | "sin_perfil"
  | "premium"
  | "artista";

type AdminOverviewUser = {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  is_banned: boolean;
  is_deleted: boolean;
  bucket: AdminAccountBucket;
  status?: "alta" | "baja";
  is_restricted: boolean;
  is_premium: boolean;
  is_artist: boolean;
  is_featured_artist: boolean;
  has_profile: boolean;
  display_name: string | null;
  avatar_url: string | null;
  puntos: number;
  strikes: number;
  plan_type: string;
};

function deriveUserBucket(u: AdminOverviewUser): AdminAccountBucket {
  if (u.is_banned || u.is_deleted) return "baja";
  if (!u.email_confirmed) return "pendiente";
  if (u.is_restricted) return "restringido";
  return "alta";
}

function compactActionStyle(kind: "default" | "danger" | "success" | "warning" | "primary" = "default"): React.CSSProperties {
  const map = {
    default: { bg: "var(--bg-main)", fg: "var(--color-primary)", bd: "var(--color-border)" },
    danger: { bg: "var(--state-danger-bg)", fg: "var(--state-danger-fg)", bd: "var(--state-danger-border)" },
    success: { bg: "var(--state-success-bg)", fg: "var(--state-success-fg)", bd: "var(--state-success-border)" },
    warning: { bg: "var(--state-warning-bg)", fg: "var(--state-warning-fg)", bd: "var(--state-warning-border)" },
    primary: { bg: "var(--color-primary)", fg: "var(--bg-card)", bd: "var(--color-primary)" },
  }[kind];
  return {
    background: map.bg,
    color: map.fg,
    border: `1px solid ${map.bd}`,
    padding: "5px 8px",
    borderRadius: "6px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontWeight: 800,
    fontSize: "11px",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

function AdminUserActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
      <div style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>{children}</div>
    </div>
  );
}

function AdminPanelContent() {
  // Sacamos la 't' mágica de useGlobal para que sea la universal
const { profile, showAlert, t } = useGlobal();
// Forzamos un log para ver qué idioma está llegando al panel (míralo en la consola F12)
console.log("Idioma actual en Admin:", profile?.language);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const reopenId = searchParams.get('reopen');

  
  const [loadingDenuncias, setLoadingDenuncias] = useState(false);
  // Justo debajo de tus otros estados, por ejemplo después de 'loadingDenuncias'
const [menuEstadoDenuncia, setMenuEstadoDenuncia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // ESTADO DEL MODAL PRECIOSO
  const [confirmDialog, setConfirmDialog] = useState<{ title: string, message: string, onConfirm: () => void | Promise<void> } | null>(null);
  const [artistWorksModal, setArtistWorksModal] = useState<{
    userName: string;
    works: { id: string; title: string; category: string; thumb: string | null }[];
    picked: Record<string, boolean>;
  } | null>(null);

  type StrikeModalDuration = "no_restrict" | "indefinite" | "7d" | "30d" | "90d" | "180d" | "365d";
  const [strikeModal, setStrikeModal] = useState<{
    p: any;
    denunciaId?: string;
    motivo: string;
    duration: StrikeModalDuration;
  } | null>(null);

  // ESTADOS BUZÓN Y APORTACIONES
  const [buzon, setBuzon] = useState<any[]>([]);
  const [aportaciones, setAportaciones] = useState<any[]>([]);
  const [queueCases, setQueueCases] = useState<Record<string, QueueCase>>({});
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [solFiltroStatus, setSolFiltroStatus] = useState("todos");
  const [solFiltroGestor, setSolFiltroGestor] = useState("todos");
  const [solFiltroUser, setSolFiltroUser] = useState("");
  const [denFiltroGestor, setDenFiltroGestor] = useState("todos");
  const [denFiltroUser, setDenFiltroUser] = useState("");
  const [apoFiltroGestor, setApoFiltroGestor] = useState("todos");
  const [apoFiltroUser, setApoFiltroUser] = useState("");
  const [selectedBuzon, setSelectedBuzon] = useState<any | null>(null);
  const [selectedAportacion, setSelectedAportacion] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("publicar");
  const [adCampaigns, setAdCampaigns] = useState<AdminAdCampaign[]>([]);
  const [adForm, setAdForm] = useState({
    id: "",
    title: "",
    subtitle: "",
    image_url: "",
    target_url: "",
    placement: "sidebar_left" as AdPlacement,
    device: "desktop" as AdDevice,
    section: "all",
    priority: 10,
    active: true,
    start_at: "",
    end_at: "",
  });

  const [catalogGroups, setCatalogGroups] = useState<any[]>([]);
  const [catalogMembers, setCatalogMembers] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogGroupForm, setCatalogGroupForm] = useState({ id: null as number | null, name: "", slug: "", logo_url: "" });
  const [catalogMemberForm, setCatalogMemberForm] = useState({
    id: null as number | null,
    group_id: null as number | null,
    name: "",
    slug: "",
    image_url: "",
  });
  const catalogGroupLogoFileRef = React.useRef<HTMLInputElement>(null);
  const catalogMemberPhotoFileRef = React.useRef<HTMLInputElement>(null);
  // 1. RECUERDA PESTAÑA Y MENSAJE ABIERTO DESDE LA URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    const bId = searchParams.get("buzonId");
    const aId = searchParams.get("aportacionId");

    if (tab) setActiveTab(tab);
    
    // Si hay un ID en la URL y ya se han cargado los datos, lo abrimos
    if (bId && buzon.length > 0) {
      const item = buzon.find(x => x.id === bId);
      if (item && item.asunto !== ADMIN_QUEUE_SUBJECT) setSelectedBuzon(item);
    }
    if (aId && aportaciones.length > 0) {
      const item = aportaciones.find(x => x.id === aId);
      if (item) setSelectedAportacion(item);
    }
  }, [searchParams, buzon, aportaciones]); // Se dispara cuando cambian los parámetros o los datos
  const fetchNuevasTabs = async () => {
    const { data: bData } = await supabase.from('buzon_colaboraciones').select('*').order('created_at', { ascending: false });
    const { data: aData } = await supabase.from('aportaciones_pcs').select('*').order('created_at', { ascending: false });

    const buzonList = bData || [];
    const aportacionesList = aData || [];

    const userIds = new Set<string>();
    buzonList.forEach(b => { if (b.user_id) userIds.add(b.user_id); });
    aportacionesList.forEach(a => { if (a.user_id) userIds.add(a.user_id); });

    let profilesMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', Array.from(userIds));
      
      if (profs) {
        profs.forEach(p => { profilesMap[p.user_id] = p; });
      }
    }

    const buzonConNombres = buzonList.filter((b) => b.asunto !== ADMIN_QUEUE_SUBJECT).map(b => ({
      ...b,
      userName: profilesMap[b.user_id]?.display_name || "Usuario Anónimo"
    }));

    const aportacionesConNombres = aportacionesList.map(a => ({
      ...a,
      userName: profilesMap[a.user_id]?.display_name || "Usuario Anónimo"
    }));

    setBuzon(buzonConNombres);
    setAportaciones(aportacionesConNombres);
  };

  const loadQueueCases = async () => {
    const { data, error } = await supabase
      .from("buzon_colaboraciones")
      .select("id,email,mensaje,asunto")
      .eq("asunto", ADMIN_QUEUE_SUBJECT);
    if (error || !data) return;
    const next: Record<string, QueueCase> = {};
    data.forEach((row) => {
      const parsed = parseQueueMessage(row.mensaje);
      if (!parsed || !row.email) return;
      next[row.email] = { ...parsed, rowId: row.id };
    });
    setQueueCases(next);
  };

  const caseOf = (queue: QueueKind, caseId: string, nativeStatus?: string | null) =>
    queueCases[queueKey(queue, caseId)] || emptyCase(nativeStatus);

  const queueSink = React.useRef<{
    setDenuncias: React.Dispatch<React.SetStateAction<any[]>>;
    setSelectedDenuncia: React.Dispatch<React.SetStateAction<any | null>>;
  } | null>(null);

  const saveQueueCase = async (
    queue: QueueKind,
    caseId: string,
    patch: Partial<Pick<QueueCase, "leido" | "status" | "gestor">>,
    action: string,
    detail: string,
    nativeStatus?: string | null,
  ) => {
    const key = queueKey(queue, caseId);
    const prev = queueCases[key] || emptyCase(nativeStatus);
    const next: QueueCase = {
      ...prev,
      ...patch,
      historial: [
        ...prev.historial,
        { at: new Date().toISOString(), actor: actorFromEmail(userEmail), action, detail },
      ],
    };
    setQueueBusy(key);
    const mensaje = JSON.stringify({
      leido: next.leido,
      status: next.status,
      gestor: next.gestor,
      historial: next.historial,
    });
    let rowId = prev.rowId;
    if (!rowId) {
      const { data: found } = await supabase
        .from("buzon_colaboraciones")
        .select("id")
        .eq("asunto", ADMIN_QUEUE_SUBJECT)
        .eq("email", key)
        .maybeSingle();
      rowId = found?.id;
    }
    if (rowId) {
      const { error } = await supabase.from("buzon_colaboraciones").update({ mensaje }).eq("id", rowId);
      if (error) {
        showAlert("Error", error.message);
        setQueueBusy(null);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("buzon_colaboraciones")
        .insert({ asunto: ADMIN_QUEUE_SUBJECT, email: key, mensaje, status: "pendiente" })
        .select("id")
        .single();
      if (error || !data) {
        showAlert("Error", error?.message || "No se pudo guardar el seguimiento.");
        setQueueBusy(null);
        return;
      }
      rowId = data.id;
    }
    if (queue === "denuncia") {
      await supabase.from("denuncias").update({ estado: next.status }).eq("id", caseId);
      queueSink.current?.setDenuncias((list) => list.map((d) => (d.id === caseId ? { ...d, estado: next.status } : d)));
      queueSink.current?.setSelectedDenuncia((cur: any) => (cur && cur.id === caseId ? { ...cur, estado: next.status } : cur));
    }
    if (queue === "aportacion") {
      const native = aportacionNativeStatus(next.status);
      await supabase.from("aportaciones_pcs").update({ status: native }).eq("id", caseId);
      setAportaciones((list) => list.map((a) => (a.id === caseId ? { ...a, status: native } : a)));
    }
    setQueueCases((map) => ({ ...map, [key]: { ...next, rowId } }));
    setQueueBusy(null);
  };

  const fetchAdCampaigns = async () => {
    const canonicalSelect =
      "id,title,subtitle,image_url,target_url,placement,device,section,priority,active,start_at,end_at";
    const attempts: {
      select: string;
      patch?: (row: Record<string, unknown>) => Record<string, unknown>;
    }[] = [
      { select: canonicalSelect },
      {
        select: "id,title,image_url,target_url,placement,device,section,priority,active,start_at,end_at",
        patch: (row) => ({ ...row, subtitle: null }),
      },
    ];

    let lastError: { message: string } | null = null;
    for (const attempt of attempts) {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select(attempt.select)
        .order("priority", { ascending: false });
      if (!error && data) {
        const rows = attempt.patch
          ? data.map((row) => attempt.patch!(row as unknown as Record<string, unknown>))
          : data;
        setAdCampaigns(rows as AdminAdCampaign[]);
        return;
      }
      lastError = error;
    }
    showAlert(
      "Error",
      `No se pudieron cargar las campañas: ${lastError?.message || "desconocido"}. En Supabase SQL Editor ejecuta el script scripts/sync-ad-campaigns-schema.sql (añade todas las columnas de la pestaña Publicidad).`,
    );
  };

  useEffect(() => {
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setVisorImages([]);
      setStrikeModal(null);
      setConfirmDialog(null);
      setNotificarModal(null);
      setSuspenderModal(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    if (!confirmDialog) return;
    const onEnter = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const el = ev.target as HTMLElement | null;
      if (el?.tagName === "TEXTAREA") return;
      if (el?.tagName === "INPUT" && ((el as HTMLInputElement).type === "text" || (el as HTMLInputElement).type === "search")) return;
      ev.preventDefault();
      const fn = confirmDialog.onConfirm;
      setConfirmDialog(null);
      Promise.resolve(fn()).catch((err: unknown) =>
        showAlert("Error", err instanceof Error ? err.message : String(err)),
      );
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [confirmDialog, showAlert]);

  const resetAdForm = () => {
    setAdForm({
      id: "",
      title: "",
      subtitle: "",
      image_url: "",
      target_url: "",
      placement: "sidebar_left",
      device: "desktop",
      section: "all",
      priority: 10,
      active: true,
      start_at: "",
      end_at: "",
    });
  };

  const editAdCampaign = (ad: AdminAdCampaign) => {
    setAdForm({
      id: ad.id,
      title: ad.title ?? "",
      subtitle: ad.subtitle ?? "",
      image_url: ad.image_url ?? "",
      target_url: ad.target_url ?? "",
      placement: ad.placement,
      device: ad.device,
      section: ad.section ?? "all",
      priority: Number(ad.priority ?? 0),
      active: Boolean(ad.active),
      start_at: ad.start_at ? ad.start_at.slice(0, 16) : "",
      end_at: ad.end_at ? ad.end_at.slice(0, 16) : "",
    });
    setActiveTab("publicidad");
  };

  const saveAdCampaign = async () => {
    if (!adForm.title.trim() || !adForm.target_url.trim()) {
      showAlert("Error", "El titulo y la URL destino son obligatorios.");
      return;
    }
    setLoading(true);
    const payload = {
      title: adForm.title.trim(),
      subtitle: adForm.subtitle.trim() || null,
      image_url: adForm.image_url.trim() || null,
      target_url: adForm.target_url.trim(),
      placement: adForm.placement,
      device: adForm.device,
      section: adForm.section.trim() || "all",
      priority: Number(adForm.priority || 0),
      active: adForm.active,
      start_at: adForm.start_at ? new Date(adForm.start_at).toISOString() : new Date().toISOString(),
      end_at: adForm.end_at ? new Date(adForm.end_at).toISOString() : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    };

    const query = adForm.id
      ? supabase.from("ad_campaigns").update(payload).eq("id", adForm.id)
      : supabase.from("ad_campaigns").insert(payload);
    const { error } = await query;
    setLoading(false);
    if (error) {
      showAlert("Error", `No se pudo guardar la campaña: ${error.message}`);
      return;
    }
    showAlert("Perfecto", adForm.id ? "Campaña actualizada." : "Campaña creada.");
    resetAdForm();
    fetchAdCampaigns();
  };

  const deleteAdCampaign = async (id: string) => {
    setConfirmDialog({
      title: "Eliminar campaña",
      message: "Esta campaña publicitaria se eliminará. ¿Continuar?",
      onConfirm: async () => {
        const { error } = await supabase.from("ad_campaigns").delete().eq("id", id);
        if (error) {
          showAlert("Error", `No se pudo eliminar: ${error.message}`);
          return;
        }
        setAdCampaigns((prev) => prev.filter((c) => c.id !== id));
      },
    });
  };

  const [filtroEstadoBuzon, setFiltroEstadoBuzon] = useState("todos");
  const [selectedBuzonIds, setSelectedBuzonIds] = useState<Set<string>>(new Set());
  const [respuestaBuzon, setRespuestaBuzon] = useState("");
  const [respuestaAportacion, setRespuestaAportacion] = useState("");
  const [filtroEstadoAportaciones, setFiltroEstadoAportaciones] = useState("todos");
  const [selectedAportacionIds, setSelectedAportacionIds] = useState<Set<string>>(new Set());

  const eliminarBuzonMasivo = async () => {
    setConfirmDialog({
      title: "Eliminar Mensajes",
      message: "¿Seguro que quieres eliminar estos mensajes definitivamente?",
      onConfirm: async () => {
        await supabase.from('buzon_colaboraciones').delete().in('id', Array.from(selectedBuzonIds));
        setBuzon(prev => prev.filter(b => !selectedBuzonIds.has(b.id)));
        setSelectedBuzonIds(new Set());
        setSelectedBuzon(null);
      }
    });
  };

  const eliminarAportacionesMasivas = async () => {
    setConfirmDialog({
      title: "Eliminar Aportaciones",
      message: "¿Seguro que quieres eliminar estas aportaciones definitivamente?",
      onConfirm: async () => {
        await supabase.from('aportaciones_pcs').delete().in('id', Array.from(selectedAportacionIds));
        setAportaciones(prev => prev.filter(a => !selectedAportacionIds.has(a.id)));
        setSelectedAportacionIds(new Set());
        setSelectedAportacion(null);
      }
    });
  };
// FUNCIÓN PARA FORZAR LA DESCARGA EN EL PC
  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
      alert("Error al descargar. Intenta click derecho > Guardar imagen como...");
    }
  };
  const enviarRespuestaWeb = async () => {
    if (!respuestaBuzon.trim() || !selectedBuzon) return;
    const nuevaRespuesta = {
      admin: profile?.display_name || "Equipo MKB",
      texto: respuestaBuzon,
      fecha: new Date().toLocaleString()
    };
    const nuevasRespuestas = [...(selectedBuzon.respuestas || []), nuevaRespuesta];
    await supabase.from('buzon_colaboraciones')
      .update({ respuestas: nuevasRespuestas, status: 'gestionando' })
      .eq('id', selectedBuzon.id);
    const updatedBuzon = { ...selectedBuzon, respuestas: nuevasRespuestas, status: 'gestionando' };
    setSelectedBuzon(updatedBuzon);
    setBuzon(prev => prev.map(b => b.id === selectedBuzon.id ? updatedBuzon : b));
    setRespuestaBuzon("");
  };

  const enviarRespuestaAportacion = async () => {
    if (!respuestaAportacion.trim() || !selectedAportacion) return;
    const nuevaRespuesta = {
      admin: profile?.display_name || "Equipo MKB",
      texto: respuestaAportacion,
      fecha: new Date().toLocaleString()
    };
    const nuevasRespuestas = [...(selectedAportacion.respuestas || []), nuevaRespuesta];
    await supabase.from('aportaciones_pcs')
      .update({ respuestas: nuevasRespuestas })
      .eq('id', selectedAportacion.id);
    const updatedAportacion = { ...selectedAportacion, respuestas: nuevasRespuestas };
    setSelectedAportacion(updatedAportacion);
    setAportaciones(prev => prev.map(a => a.id === selectedAportacion.id ? updatedAportacion : a));
    setRespuestaAportacion("");
  };

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const openVisor = (urls: string[]) => {
    if (urls.length === 0) return;
    setPreviewUrls(urls);
    setPreviewIndex(0);
  };

  const [filtroDenuncia, setFiltroDenuncia] = useState("all");
  const [selectedDenuncias, setSelectedDenuncias] = useState<Set<string>>(new Set());
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const handleSelectAllDenuncias = (checked: boolean, listaFiltrada: any[]) => {
    if (checked) {
      setSelectedDenuncias(new Set(listaFiltrada.map(d => d.id)));
    } else {
      setSelectedDenuncias(new Set());
    }
  };

  const [visorImages, setVisorImages] = useState<string[]>([]);
  const [visorIndex, setVisorIndex] = useState(0);

  const eliminarDenunciasMasivas = async () => {
    if (selectedDenuncias.size === 0) return;
    setLoadingDenuncias(true);
    const ids = Array.from(selectedDenuncias);
    await supabase.from("denuncias").delete().in("id", ids); 
    setDenuncias(prev => prev.filter(d => !ids.includes(d.id)));
    setSelectedDenuncias(new Set());
    setSelectedDenuncia(null);
    setLoadingDenuncias(false);
  };

  const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=U&background=F3C7DA&color=8C659C";
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (activeTab === "buzon" || activeTab === "aportaciones") fetchNuevasTabs();
    if (activeTab === "solicitudes" || activeTab === "denuncias" || activeTab === "aportaciones" || activeTab === "buzon") {
      void loadQueueCases();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "publicidad") fetchAdCampaigns();
  }, [activeTab]);

  const [tutorialSlide, setTutorialSlide] = useState(0);

  useEffect(() => {
    if (activeTab === "denuncias") {
      fetchDenuncias();
    }
  }, [activeTab]);
const [historialModal, setHistorialModal] = useState<{user: any, history: any[]} | null>(null);
  const [selectedDenuncia, setSelectedDenuncia] = useState<any | null>(null);

  const fetchDenuncias = async () => {
    setLoadingDenuncias(true);
    const { data: reportes, error } = await supabase
      .from('denuncias')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error cargando denuncias:", error);
      setDenuncias([]);
    } else if (reportes) {
      const userIds = new Set<string>();
      reportes.forEach(r => {
        if (r.reporter_id) userIds.add(r.reporter_id);
        if (r.reported_user_id) userIds.add(r.reported_user_id);
      });

      let profilesMap: Record<string, any> = {};
      if (userIds.size > 0) {
       const { data: profs } = await supabase
            .from('profiles')
            // 👇 AÑADIMOS TODOS LOS CAMPOS NECESARIOS 👇
            .select('user_id, display_name, avatar_url, is_artist, is_featured_artist, is_premium, is_restricted, puntos, strikes, plan_type')
            .in('user_id', Array.from(userIds));

        if (profs) {
          profs.forEach(p => { profilesMap[p.user_id] = p; });
        }
      }

      const denunciasCompletas = reportes.map(r => ({
        ...r,
        denunciante: profilesMap[r.reporter_id] || null,
        denunciado: profilesMap[r.reported_user_id] || null
      }));

      setDenuncias(denunciasCompletas);
    }
    setLoadingDenuncias(false);
  };

  const enviarRespuestaAdmin = async (reporterId: string, tipo: string, denunciald: string, itemId?: string) => {
    if (!reporterId) return showAlert("Aviso", "Esta denuncia es anónima o no tiene ID de usuario al que responder.");
    let mensaje = "";
    if (tipo === "no_infringe") mensaje = "Hemos revisado tu reporte y no consideramos que infrinja nuestras normas.";
    if (tipo === "eliminado") mensaje = "Gracias por tu reporte. Hemos suprimido el perfil/contenido infractor.";
    if (tipo === "mas_info") mensaje = "Necesitamos que nos amplíes información sobre tu reporte para poder actuar.";
    
    if (itemId) {
      const isArtistWall = selectedDenuncia.motivo?.includes("[Muro Artista - Mensaje:");
      if (isArtistWall) {
        mensaje += `\n\nReferencia del contenido: ${window.location.origin}/artista-del-mes?highlight=${itemId}`;
      } else {
        mensaje += `\n\nReferencia del contenido: ${window.location.origin}/fanart?id=${itemId}`;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    await supabase.from('notifications').insert({
      user_id: reporterId,
      sender_id: authData.user?.id,
      type: 'admin_message',
      content: `RESOLUCIÓN DE TU REPORTE: ${mensaje}`
    });

    showAlert("Éxito", "Notificación enviada al usuario con éxito.");
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const pendingPublishRef = useRef<{ userId: string; name: string } | null>(null);
  const holdUserSearchRef = useRef(false);
  const [usersOverviewLoading, setUsersOverviewLoading] = useState(false);
  const [usersOverviewError, setUsersOverviewError] = useState<string | null>(null);
  const [usersOverview, setUsersOverview] = useState<AdminOverviewUser[]>([]);
  const [usersOverviewSummary, setUsersOverviewSummary] = useState({
    total: 0,
    alta: 0,
    baja: 0,
    pendiente: 0,
    restringido: 0,
    sinPerfil: 0,
    premium: 0,
    artistas: 0,
  });
  const [usersOverviewFilter, setUsersOverviewFilter] = useState<AdminUsersFilter>("todos");
  const [usersOverviewSearch, setUsersOverviewSearch] = useState("");
  const [usersListOpen, setUsersListOpen] = useState(false);
  const [openUserActionsId, setOpenUserActionsId] = useState<string | null>(null);
// --- SINCRONIZACIÓN TOTAL ENTRE PESTAÑAS ---
  const sincronizarCambioUsuario = (userId: string, nuevosDatos: any) => {
    // 1. Actualizar la pestaña de "Gestión de Usuarios"
    setProfiles(prev => prev.map(u => u.user_id === userId ? { ...u, ...nuevosDatos } : u));
    setUsersOverview(prev => prev.map(u => {
      if (u.user_id !== userId) return u;
      const next = { ...u, ...nuevosDatos };
      return { ...next, bucket: deriveUserBucket(next) };
    }));
    
    // 2. Actualizar la lista de "Denuncias" (la que está de fondo)
    setDenuncias(prev => prev.map(d => {
      let dCopia = { ...d };
      if (d.denunciado?.user_id === userId) dCopia.denunciado = { ...d.denunciado, ...nuevosDatos };
      if (d.denunciante?.user_id === userId) dCopia.denunciante = { ...d.denunciante, ...nuevosDatos };
      return dCopia;
    }));

    // 3. Actualizar la denuncia que tienes abierta ahora mismo (el Modal)
    if (selectedDenuncia) {
      setSelectedDenuncia((prev: any) => {
        if (!prev) return null;
        let sdCopia = { ...prev };
        if (prev.denunciado?.user_id === userId) sdCopia.denunciado = { ...prev.denunciado, ...nuevosDatos };
        if (prev.denunciante?.user_id === userId) sdCopia.denunciante = { ...prev.denunciante, ...nuevosDatos };
        return sdCopia;
      });
    }
  };
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  const IDIOMAS = [
    { code: 'es', name: 'Español' }, { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' }, { code: 'pt', name: 'Português' },
    { code: 'id', name: 'Bahasa Indonesia' }, { code: 'th', name: 'Thai' },
    { code: 'ko', name: 'Korean' }, { code: 'zh', name: 'Chinese' }, 
    { code: 'ja', name: 'Japanese' }
  ];

  const [file, setFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    artist_name: "",
    category: "Arte 2D",
    content_text: "",
    is_nsfw: false
  });

  const [isNewStory, setIsNewStory] = useState(true);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>("");
  const [newStoryDraftTitle, setNewStoryDraftTitle] = useState("");

  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [denuncias, setDenuncias] = useState<any[]>([]);
  queueSink.current = { setDenuncias, setSelectedDenuncia };

  useEffect(() => {
    const pending = pendingPublishRef.current;
    pendingPublishRef.current = null;
    if (pending && activeTab === "publicar") {
      holdUserSearchRef.current = true;
      setSelectedUserId(pending.userId);
      setSearchTerm(pending.name);
      setProfiles([]);
    } else {
      setSearchTerm("");
      setProfiles([]);
      setSelectedUserId(null);
    }
    if (activeTab !== "usuarios") {
      setUsersListOpen(false);
      setUsersOverviewSearch("");
      setOpenUserActionsId(null);
    }

    if (activeTab === "solicitudes") {
      const fetchSolicitudes = async () => {
        const { data, error } = await supabase.from('solicitudes_artistas').select('*').order('created_at', { ascending: false });
        if (error) console.error("Error al cargar solicitudes:", error);
        setSolicitudes(data || []);
      };
      fetchSolicitudes();
    } else if (activeTab === "denuncias") {
      fetchDenuncias();
    }
  }, [activeTab]);

 // --- EFECTO PARA REABRIR DENUNCIAS AUTOMÁTICAMENTE ---
  useEffect(() => {
    if (reopenId && denuncias.length > 0) {
      const found = denuncias.find(d => d.id === reopenId);
      if (found && (!selectedDenuncia || selectedDenuncia.id !== found.id)) {
        setSelectedDenuncia(found);
        if (activeTab !== 'denuncias') {
           setActiveTab('denuncias');
        }
      }
    }
  }, [reopenId, denuncias]);

  const resolverDenuncia = async (id: string) => {
    await supabase.from('denuncias').delete().eq('id', id);
    setDenuncias(prev => prev.filter(d => d.id !== id));
    setSelectedDenuncia(null);
  };
const levantarSancion = async (userId: string, ticketId: string) => {
  setLoading(true);
  try {
    // Usamos el RPC que acabas de crear en Supabase para saltar el bloqueo de seguridad
    const { error: errorPerfil } = await supabase.rpc('admin_quitar_restriccion', { 
      target_user_id: userId 
    });

    if (errorPerfil) throw errorPerfil;

    // Marcamos la denuncia como completada
    await supabase.from('denuncias').update({ estado: 'completada' }).eq('id', ticketId);

    // Actualizamos la vista local
    if (typeof sincronizarCambioUsuario === 'function') {
      sincronizarCambioUsuario(userId, { is_restricted: false });
    }

    showAlert("Éxito", "Usuario reactivado. El banner rojo ha desaparecido para siempre.");
    fetchDenuncias();
    setSelectedDenuncia(null); 
  } catch (err: any) {
    showAlert("Error", err.message);
  } finally {
    setLoading(false);
  }
};
  const resolverSolicitud = async (id: string) => {
    await supabase.from('solicitudes_artistas').delete().eq('id', id);
    setSolicitudes(prev => prev.filter(s => s.id !== id));
  };

  useEffect(() => {
    if (selectedUserId && formData.category === "Fanfics") {
      const fetchStories = async () => {
        // Fuente principal: tabla obras (más fiable para capítulos/historias existentes)
        const { data: obrasRows, error: obrasErr } = await supabase
          .from("obras")
          .select("id, created_at")
          .eq("autor_id", selectedUserId)
          .order("created_at", { ascending: false });

        let stories: Array<{ id: string; title: string; chapterCount: number }> = [];

        if (!obrasErr && (obrasRows || []).length > 0) {
          const obraIds = (obrasRows || []).map((o: any) => o.id);
          const { data: fanartTitles } = await supabase
            .from("fanarts")
            .select("id, title, category")
            .in("id", obraIds);

          const titleById = new Map<string, string>();
          (fanartTitles || []).forEach((row: any) => {
            const rawCategory = String(row?.category || "").toLowerCase();
            if (!rawCategory.includes("fanfic")) return;
            if (row?.id && row?.title) titleById.set(row.id, row.title);
          });

          const { data: chaptersRows } = await supabase
            .from("capitulos")
            .select("obra_id")
            .in("obra_id", obraIds);
          const chapterCountByObra = new Map<string, number>();
          (chaptersRows || []).forEach((row: any) => {
            if (!row?.obra_id) return;
            chapterCountByObra.set(row.obra_id, (chapterCountByObra.get(row.obra_id) || 0) + 1);
          });

          stories = obraIds.map((id: string) => ({
            id,
            title: titleById.get(id) || `Obra ${id.slice(0, 8)}`,
            chapterCount: chapterCountByObra.get(id) || 0,
          }));
        } else {
          // Fallback para datos legacy: fanfics directos en fanarts aunque no exista obra vinculada
          const { data: fallbackRows } = await supabase
            .from("fanarts")
            .select("id, title, category")
            .eq("user_id", selectedUserId);

          stories = (fallbackRows || [])
            .filter((row: any) => String(row?.category || "").toLowerCase().includes("fanfic"))
            .map((row: any) => ({
              id: row.id,
              title: row.title || `Obra ${String(row.id || "").slice(0, 8)}`,
              chapterCount: 0,
            }));
        }

        setUserStories(stories);
        if (stories.length === 0) {
          setIsNewStory(true);
          setSelectedStoryId("");
        } else if (!isNewStory && !stories.some((s: any) => s.id === selectedStoryId)) {
          setSelectedStoryId("");
        }
      };
      fetchStories();
    } else if (formData.category !== "Fanfics") {
      setUserStories([]);
      setIsNewStory(true);
      setSelectedStoryId("");
    }
  }, [selectedUserId, formData.category, isNewStory, selectedStoryId]);

  useEffect(() => {
    if (formData.category !== "Fanfics") return;
    if (isNewStory) return;
    if (!selectedStoryId) return;
    const selectedStory = userStories.find((s: any) => s.id === selectedStoryId);
    if (!selectedStory?.title) return;
    setFormData((prev) => ({ ...prev, title: selectedStory.title }));
  }, [formData.category, isNewStory, selectedStoryId, userStories]);

  useEffect(() => {
    if (formData.category !== "Fanfics") return;
    if (!isNewStory) return;
    const draft = newStoryDraftTitle.trim();
    if (!draft) return;
    setFormData((prev) => {
      if ((prev.title || "").trim().length > 0) return prev;
      return { ...prev, title: draft };
    });
  }, [formData.category, isNewStory, newStoryDraftTitle]);

  useEffect(() => {
    const searchUsers = async () => {
      if (holdUserSearchRef.current) {
        holdUserSearchRef.current = false;
        setProfiles([]);
        return;
      }
      if (searchTerm.length < 2) {
        setProfiles([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        // 👇 AÑADIMOS strikes y plan_type AL SELECT 👇
        .select('user_id, display_name, is_artist, is_featured_artist, is_premium, is_restricted, puntos, strikes, plan_type')
        .ilike('display_name', `%${searchTerm}%`);
      
      const ordered = [...(data || [])].sort((a: any, b: any) => {
        const aStar = a.is_featured_artist ? 1 : 0;
        const bStar = b.is_featured_artist ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        return String(a.display_name || "").localeCompare(String(b.display_name || ""));
      });
      setProfiles(ordered);
    };
    searchUsers();
  }, [searchTerm]);

  const cargarResumenUsuarios = async () => {
    setUsersOverviewLoading(true);
    setUsersOverviewError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
      const res = await fetch("/api/admin/users-overview", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        users?: AdminOverviewUser[];
        summary?: {
          total?: number;
          alta?: number;
          baja?: number;
          pendiente?: number;
          restringido?: number;
          sinPerfil?: number;
          premium?: number;
          artistas?: number;
        };
      };
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setUsersOverview(
        (json.users || []).map((u) => ({
          ...u,
          puntos: Math.max(0, Number(u.puntos) || 0),
          strikes: Math.min(99, Math.max(0, Number(u.strikes) || 0)),
          plan_type: u.plan_type || "free",
          bucket: u.bucket || deriveUserBucket(u),
        })),
      );
      setUsersOverviewSummary({
        total: Number(json.summary?.total || 0),
        alta: Number(json.summary?.alta || 0),
        baja: Number(json.summary?.baja || 0),
        pendiente: Number(json.summary?.pendiente || 0),
        restringido: Number(json.summary?.restringido || 0),
        sinPerfil: Number(json.summary?.sinPerfil || 0),
        premium: Number(json.summary?.premium || 0),
        artistas: Number(json.summary?.artistas || 0),
      });
    } catch (err: any) {
      setUsersOverviewError(err?.message || "No se pudo cargar el resumen de usuarios.");
    } finally {
      setUsersOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "usuarios") return;
    void cargarResumenUsuarios();
  }, [activeTab]);

  const usersOverviewLiveSummary = {
    total: usersOverview.length,
    alta: usersOverview.filter((u) => deriveUserBucket(u) === "alta").length,
    baja: usersOverview.filter((u) => deriveUserBucket(u) === "baja").length,
    pendiente: usersOverview.filter((u) => deriveUserBucket(u) === "pendiente").length,
    restringido: usersOverview.filter((u) => deriveUserBucket(u) === "restringido").length,
    sinPerfil: usersOverview.filter((u) => !u.has_profile).length,
    premium: usersOverview.filter((u) => u.is_premium).length,
    artistas: usersOverview.filter((u) => u.is_artist).length,
  };
  const usersSummary = usersOverview.length > 0 ? usersOverviewLiveSummary : usersOverviewSummary;

  const matchesUsersOverviewFilter = (u: AdminOverviewUser, filter: AdminUsersFilter) => {
    const bucket = deriveUserBucket(u);
    if (filter === "todos") return true;
    if (filter === "alta" || filter === "baja" || filter === "pendiente" || filter === "restringido") return bucket === filter;
    if (filter === "sin_perfil") return !u.has_profile;
    if (filter === "premium") return !!u.is_premium;
    if (filter === "artista") return !!u.is_artist;
    return true;
  };

  const usersOverviewFiltered = usersOverview.filter((u) => {
    if (!matchesUsersOverviewFilter(u, usersOverviewFilter)) return false;
    const q = usersOverviewSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${u.display_name || ""} ${u.email || ""} ${u.user_id}`.toLowerCase();
    return haystack.includes(q);
  });

  const openUsersList = (filter: AdminUsersFilter) => {
    setUsersOverviewFilter(filter);
    setUsersListOpen(true);
    setOpenUserActionsId(null);
  };

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setAuthLoading(false);
    }
    checkAdmin();
  }, []);

  const fulminarUsuario = async (userIdMalicioso: string, userName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      title: "⚠️ ALERTA NUCLEAR ⚠️",
      message: `¿Estás completamente segura de que quieres ELIMINAR a ${userName} de la base de datos?\n\nEsta acción borrará su cuenta, sus obras, sus me gustas y sus comentarios. NO SE PUEDE DESHACER.`,
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userIdMalicioso });
        setLoading(false);
        if (error) {
          showAlert("Error", "Error al borrar usuario: " + error.message);
        } else {
          showAlert("Usuario Eliminado", `El usuario ${userName} ha sido eliminado de la existencia.`);
          setSearchTerm("");
          setProfiles([]);
          setUsersOverview((prev) => prev.filter((u) => u.user_id !== userIdMalicioso));
          if (selectedUserId === userIdMalicioso) {
            setSelectedUserId(null);
          }
          if (selectedDenuncia) setSelectedDenuncia(null);
        }
      }
    });
  };

  const toggleStatus = async (userId: string, userName: string, field: string, currentValue: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const action = currentValue ? "quitar" : "dar";
    let fieldNameEs = field === 'is_premium' ? 'Premium' : field === 'is_artist' ? 'Artista' : 'Restricción';
    const removingArtist = field === "is_artist" && currentValue;

    setConfirmDialog({
      title: "Confirmar Acción",
      message: removingArtist
        ? `¿Seguro que quieres quitar el estado de Artista a ${userName}?\n\nDespués puedes dejar sus obras, borrarlas todas o elegir cuáles salen de la web.`
        : `¿Seguro que quieres ${action} el estado de ${fieldNameEs} a ${userName}?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const { error } = await supabase.rpc('admin_toggle_status', { target_user: userId, toggle_field: field, new_value: !currentValue });
          if (error) throw error;

          let mensajeNoti = field === 'is_restricted' ? (!currentValue ? "Cuenta RESTRINGIDA." : "Restricción levantada.") 
            : field === 'is_premium' ? (!currentValue ? "Cuenta PREMIUM." : "Premium terminado.") 
            : (!currentValue ? "Artista Verificado." : "Permisos revocados.");

          const { data: authData } = await supabase.auth.getUser();
          await supabase.from('notifications').insert({ user_id: userId, sender_id: authData.user?.id, type: 'admin_message', content: `ACTUALIZACIÓN: ${mensajeNoti}`, read: false });

          sincronizarCambioUsuario(userId, { [field]: !currentValue });
          if (removingArtist) {
            await openArtistWorksCleanup(userName, userId);
          } else {
            showAlert("Éxito", `¡Estado de ${fieldNameEs} actualizado!`);
          }
        } catch (err: any) {
          showAlert("Error", err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const openArtistWorksCleanup = async (userName: string, userId: string) => {
    const { data, error } = await supabase
      .from("fanarts")
      .select("id, title, category, thumbnail_url, image_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      showAlert("Artista quitado", `${userName} ya no es artista. No pude cargar sus obras: ${error.message}`);
      return;
    }
    const works = (data || []).map((row) => ({
      id: String(row.id),
      title: String(row.title || "Sin título"),
      category: String(row.category || "Obra"),
      thumb: (row.thumbnail_url || row.image_url || null) as string | null,
    }));
    if (works.length === 0) {
      showAlert("Artista quitado", `${userName} ya no es artista. No tiene obras en la web.`);
      return;
    }
    const picked: Record<string, boolean> = {};
    works.forEach((work) => {
      picked[work.id] = false;
    });
    setArtistWorksModal({ userName, works, picked });
  };

  const deleteArtistWorks = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data: comments } = await supabase.from("fanart_comments").select("id, parent_id").in("fanart_id", ids);
    const commentRows = (comments || []) as { id: string; parent_id?: string | null }[];
    const replyIds = commentRows.filter((row) => row.parent_id).map((row) => row.id);
    const rootIds = commentRows.filter((row) => !row.parent_id).map((row) => row.id);
    const commentIds = [...replyIds, ...rootIds];
    if (commentIds.length > 0) {
      await supabase.from("fanart_comment_likes").delete().in("comment_id", commentIds);
      if (replyIds.length > 0) await supabase.from("fanart_comments").delete().in("id", replyIds);
      if (rootIds.length > 0) await supabase.from("fanart_comments").delete().in("id", rootIds);
    }
    await supabase.from("fanart_likes").delete().in("fanart_id", ids);
    await supabase.from("fanzone_notifications").delete().in("fanart_id", ids);

    const { data: chapters } = await supabase.from("capitulos").select("id").in("obra_id", ids);
    const chapterIds = (chapters || []).map((row) => String(row.id));
    if (chapterIds.length > 0) {
      await supabase.from("traducciones").delete().in("capitulo_id", chapterIds);
      await supabase.from("capitulos").delete().in("id", chapterIds);
    }
    await supabase.from("obras").delete().in("id", ids);

    const { error } = await supabase.from("fanarts").delete().in("id", ids);
    if (error) throw error;
  };
  // --- FUNCIÓN PARA AÑADIR STRIKE ---
  const addStrike = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStrikes = p.strikes || 0;
    
    if (currentStrikes >= 3) {
      showAlert("Límite alcanzado", "Este usuario ya tiene 3 strikes. Debes decidir si fulminarlo o mantenerlo restringido.");
      return;
    }

    const newStrikes = currentStrikes + 1;

    setConfirmDialog({
      title: `¿Añadir Strike ${newStrikes}/3?`,
      message: `Vas a ponerle una falta a ${p.display_name}. Al llegar a 3, la cuenta quedará marcada para eliminación.`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const shouldRestrict = newStrikes >= 3;
          const { error } = await supabase
            .from('profiles')
            .update({ strikes: newStrikes, is_restricted: shouldRestrict })
            .eq('user_id', p.user_id);
          
          if (error) throw error;

          const { data: authData } = await supabase.auth.getUser();
          const msg = shouldRestrict
            ? `Has recibido un STRIKE (${newStrikes}/3). Tu cuenta ha sido restringida por acumulación de strikes.`
            : `Has recibido un STRIKE (${newStrikes}/3). Consulta las normas de la comunidad para evitar llegar a 3 strikes.`;
          await supabase.from('notifications').insert({ 
            user_id: p.user_id, 
            sender_id: authData.user?.id, 
            type: 'admin_message', 
            content: msg, 
            read: false 
          });

          sincronizarCambioUsuario(p.user_id, { strikes: newStrikes, is_restricted: shouldRestrict });
          showAlert("Strike Añadido", `Usuario ${p.display_name} ahora tiene ${newStrikes} strikes.${shouldRestrict ? " Cuenta restringida (3.er strike)." : ""}`);
        } catch (err: any) {
          showAlert("Error", err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  /** Un clic: persiste el estado actual de la fila (incl. K-oins del input si lo editaste). */
  const guardarUsuarioPerfil = async (p: any) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

      const ptsEl =
        typeof document !== "undefined"
          ? (document.getElementById(`pts-${p.user_id}`) as HTMLInputElement | null)
          : null;
      const puntosParsed = ptsEl ? parseInt(ptsEl.value || "0", 10) : (p.puntos ?? 0);

      const body = {
        user_id: p.user_id,
        is_premium: !!p.is_premium,
        is_artist: !!p.is_artist,
        is_featured_artist: !!p.is_featured_artist,
        is_restricted: !!p.is_restricted,
        plan_type: p.plan_type || "free",
        puntos: Math.max(0, Number.isFinite(puntosParsed) ? puntosParsed : 0),
        strikes: Math.min(99, Math.max(0, Number(p.strikes) || 0)),
      };

      const res = await fetch("/api/admin/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      sincronizarCambioUsuario(p.user_id, body);
      showAlert("Éxito", "Perfil guardado en base de datos.");
    } catch (err: any) {
      showAlert("Error", err?.message || "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const runUserAuthAction = async (
    p: AdminOverviewUser,
    action: "reset_password" | "unlock_login" | "lock_login" | "confirm_email" | "sign_out_all",
  ) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
    const res = await fetch("/api/admin/user-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ user_id: p.user_id, action }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      recovery_link?: string | null;
      is_banned?: boolean;
      email_confirmed?: boolean;
    };
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    if (action === "unlock_login") sincronizarCambioUsuario(p.user_id, { is_banned: false });
    if (action === "lock_login") sincronizarCambioUsuario(p.user_id, { is_banned: true });
    if (action === "confirm_email") sincronizarCambioUsuario(p.user_id, { email_confirmed: true });
    if (json.recovery_link && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json.recovery_link);
      } catch {
        /* ignore clipboard failures */
      }
    }
    showAlert(
      "Listo",
      json.recovery_link
        ? `${json.message || "Acción completada."}\n\nEnlace (también copiado si el navegador lo permite):\n${json.recovery_link}`
        : json.message || "Acción completada.",
    );
  };

  const confirmUserAuthAction = (
    p: AdminOverviewUser,
    action: "reset_password" | "unlock_login" | "lock_login" | "confirm_email" | "sign_out_all",
    title: string,
    message: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setConfirmDialog({
      title,
      message,
      onConfirm: async () => {
        setLoading(true);
        try {
          await runUserAuthAction(p, action);
        } catch (err: any) {
          showAlert("Error", err?.message || "No se pudo completar la acción.");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const toggleFeaturedArtist = async (p: AdminOverviewUser, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
      const body = {
        user_id: p.user_id,
        is_premium: !!p.is_premium,
        is_artist: !!p.is_artist,
        is_featured_artist: !p.is_featured_artist,
        is_restricted: !!p.is_restricted,
        plan_type: p.plan_type || "free",
        puntos: Math.max(0, Number(p.puntos) || 0),
        strikes: Math.min(99, Math.max(0, Number(p.strikes) || 0)),
      };
      const res = await fetch("/api/admin/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      sincronizarCambioUsuario(p.user_id, { is_featured_artist: !p.is_featured_artist });
      showAlert("Éxito", !p.is_featured_artist ? "Usuario marcado como Artista Estrella." : "Usuario quitado de Artista Estrella.");
    } catch (err: any) {
      showAlert("Error", err.message || "No se pudo actualizar Artista Estrella.");
    }
  };

  const catalogAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
    return { Authorization: `Bearer ${token}` };
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const h = await catalogAuthHeaders();
      const res = await fetch("/api/admin/catalog", { headers: h });
      const json = (await res.json().catch(() => ({}))) as { groups?: any[]; members?: any[]; error?: string };
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setCatalogGroups(json.groups || []);
      setCatalogMembers(json.members || []);
    } catch (err: any) {
      showAlert("Catálogo", err?.message || "No se pudo cargar.");
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "catalogo") void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al entrar en la pestaña
  }, [activeTab]);

  const uploadCatalogAsset = async (file: File, kind: "group" | "member") => {
    const h = await catalogAuthHeaders();
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const res = await fetch("/api/admin/catalog-upload", { method: "POST", headers: h, body: fd });
    const json = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string };
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    if (!json.publicUrl) throw new Error("Sin URL pública");
    return json.publicUrl;
  };

  const saveCatalogGroup = async () => {
    setLoading(true);
    try {
      const h = await catalogAuthHeaders();
      const body = {
        action: "upsert_group",
        id: catalogGroupForm.id ?? undefined,
        name: catalogGroupForm.name.trim(),
        slug: catalogGroupForm.slug.trim() || undefined,
        logo_url: catalogGroupForm.logo_url.trim() || null,
      };
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      showAlert("Catálogo", catalogGroupForm.id ? "Grupo actualizado." : "Grupo creado.");
      setCatalogGroupForm({ id: null, name: "", slug: "", logo_url: "" });
      await loadCatalog();
    } catch (err: any) {
      showAlert("Catálogo", err?.message || "Error al guardar grupo.");
    } finally {
      setLoading(false);
    }
  };

  const saveCatalogMember = async () => {
    if (catalogMemberForm.group_id == null) {
      showAlert("Catálogo", "Elige un grupo para el miembro.");
      return;
    }
    setLoading(true);
    try {
      const h = await catalogAuthHeaders();
      const body = {
        action: "upsert_member",
        id: catalogMemberForm.id ?? undefined,
        group_id: catalogMemberForm.group_id,
        name: catalogMemberForm.name.trim(),
        slug: catalogMemberForm.slug.trim() || undefined,
        image_url: catalogMemberForm.image_url.trim() || null,
      };
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      showAlert("Catálogo", catalogMemberForm.id ? "Miembro actualizado." : "Miembro creado.");
      setCatalogMemberForm((p) => ({ id: null, group_id: p.group_id, name: "", slug: "", image_url: "" }));
      await loadCatalog();
    } catch (err: any) {
      showAlert("Catálogo", err?.message || "Error al guardar miembro.");
    } finally {
      setLoading(false);
    }
  };

const togglePremium = async (p: any, planToSet: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isGivingPremium = !p.is_premium;
    const planText = planToSet === 'anual' ? 'Anual' : 'Mensual';
    const action = isGivingPremium ? `dar el pase Premium ${planText}` : "quitar el Premium";

    setConfirmDialog({
      title: "Confirmar Premium",
      message: `¿Seguro que quieres ${action} a ${p.display_name}?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          // 1. Toggle booleano
          const { error } = await supabase.rpc('admin_toggle_status', { target_user: p.user_id, toggle_field: 'is_premium', new_value: isGivingPremium });
          if (error) throw error;

          // 2. Asignar el tipo de plan
          const finalPlan = isGivingPremium ? planToSet : 'free';
          await supabase.from('profiles').update({ plan_type: finalPlan }).eq('user_id', p.user_id);

          // 3. Notificar
          const { data: authData } = await supabase.auth.getUser();
          const msg = isGivingPremium ? `¡Enhorabuena! Tienes una cuenta PREMIUM ${planText.toUpperCase()}.` : "Tu suscripción Premium ha terminado o ha sido revocada.";
          await supabase.from('notifications').insert({ user_id: p.user_id, sender_id: authData.user?.id, type: 'admin_message', content: `ACTUALIZACIÓN: ${msg}`, read: false });

          // 4. UI
          sincronizarCambioUsuario(p.user_id, { is_premium: isGivingPremium, plan_type: finalPlan });
          showAlert("Éxito", `Estado Premium actualizado a ${finalPlan}.`);
        } catch(err: any) {
          showAlert("Error", err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const toggleRestriccion = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();

    if (p.is_restricted) {
      // Quitar restricción no resta strikes (el antecedente se queda)
      setConfirmDialog({
        title: "Levantar Restricción",
        message: `¿Seguro que quieres quitar la restricción a ${p.display_name}? (Mantendrá su historial de ${p.strikes || 0}/3 strikes)`,
        onConfirm: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.rpc('admin_toggle_status', { target_user: p.user_id, toggle_field: 'is_restricted', new_value: false });
            if (error) throw error;

            const { data: authData } = await supabase.auth.getUser();
            await supabase.from('notifications').insert({ user_id: p.user_id, sender_id: authData.user?.id, type: 'admin_message', content: `ACTUALIZACIÓN: Tu restricción ha sido levantada. Vuelves a tener acceso a las funciones comunitarias.`, read: false });

            sincronizarCambioUsuario(p.user_id, { is_restricted: false });
            showAlert("Éxito", "Restricción levantada.");
          } catch(err: any) {
            showAlert("Error", err.message);
          } finally {
            setLoading(false);
          }
        }
      });
     {/* 🌟 MODAL HISTORIAL DE STRIKES 🌟 */}
      {historialModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--modal-overlay)", zIndex: 21000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setHistorialModal(null)}>
          <div style={{ background: "var(--bg-modal)", padding: "25px", borderRadius: "24px", maxWidth: "500px", width: "100%", maxHeight: "85vh", overflowY: "auto", border: "2px solid var(--border-modal)", boxShadow: "0 20px 40px var(--shadow-modal)", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setHistorialModal(null)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer", color: "var(--color-primary)" }}><X size={24} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "20px" }}>
               <FileText color="var(--color-primary)" size={28} />
               <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: 0, fontSize: "24px" }}>Historial de {historialModal.user.display_name}</h3>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {historialModal.history.map(s => (
                <div key={s.id} style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "14px", border: "1px solid var(--border-card)", boxShadow: "0 4px 10px var(--shadow-card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)" }}>{s.admin_name}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)" }}>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text-main)", lineHeight: 1.4 }}>{s.reason}</p>
                  
                  {/* ✨ BOTÓN MÁGICO A LA DENUNCIA */}
                  {s.denuncia_id && (
                    <button 
                      onClick={() => {
                        setHistorialModal(null);
                        if (selectedDenuncia) setSelectedDenuncia(null); // Cierra si hay una abierta
                        router.push(`/admin-panel?tab=denuncias&reopen=${s.denuncia_id}`);
                      }} 
                      style={{ background: "var(--badge-bg)", color: "var(--color-primary)", border: "1px solid var(--badge-border)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 900, fontSize: "11px" }}
                    >
                      <ExternalLink size={14} /> VER EXPEDIENTE ORIGINAL
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    }
  };
  const aprobarArtista = async (targetId: string, userName: string, isAlreadyArtist: boolean, e: React.MouseEvent, solicitudId?: string) => {
    e.stopPropagation();
    if (isAlreadyArtist) {
      showAlert("Aviso", `${userName} ya tiene permisos de artista.`);
      return;
    }

    setConfirmDialog({
      title: "Aprobar Artista",
      message: `¿Quieres autorizar a ${userName} para que pueda publicar su propio arte de forma autónoma?`,
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.rpc('admin_verify_artist', { target_user_id: targetId });
        setLoading(false);

        if (error) {
          showAlert("Error", "Error al dar permisos: " + error.message);
        } else {
          if (solicitudId) {
            await saveQueueCase("solicitud", solicitudId, { status: "aprobada", leido: true }, "estado", "Aprobada como artista");
          }
          showAlert("Éxito", `¡Listo! ${userName} ahora es un Artista Verificado.`);
          setSearchTerm(searchTerm + " ");
          setTimeout(() => setSearchTerm(searchTerm.trim()), 100);
        }
      }
    });
  };
// --- FUNCIÓN MAESTRA DE SINCRONIZACIÓN ---
  // Esta función busca a un usuario en todas las listas y lo actualiza para que no se "resetee" nada
  const actualizarUsuarioEnTodasPartes = (userId: string, datosNuevos: any) => {
    // 1. Actualizar lista de perfiles (Gestión de Usuarios)
    setProfiles(prev => prev.map(u => u.user_id === userId ? { ...u, ...datosNuevos } : u));
    setUsersOverview(prev => prev.map(u => {
      if (u.user_id !== userId) return u;
      const next = { ...u, ...datosNuevos };
      return { ...next, bucket: deriveUserBucket(next) };
    }));
    
    // 2. Actualizar lista de denuncias (Fondo)
    setDenuncias(prev => prev.map(d => {
      let nuevoD = { ...d };
      if (d.denunciado?.user_id === userId) nuevoD.denunciado = { ...d.denunciado, ...datosNuevos };
      if (d.denunciante?.user_id === userId) nuevoD.denunciante = { ...d.denunciante, ...datosNuevos };
      return nuevoD;
    }));

    // 3. Actualizar modal abierto (Si el usuario es el de la denuncia actual)
    if (selectedDenuncia) {
      setSelectedDenuncia((prev: any) => {
        if (!prev) return null;
        let nuevoSD = { ...prev };
        if (prev.denunciado?.user_id === userId) nuevoSD.denunciado = { ...prev.denunciado, ...datosNuevos };
        if (prev.denunciante?.user_id === userId) nuevoSD.denunciante = { ...prev.denunciante, ...datosNuevos };
        return nuevoSD;
      });
    }
  };

  const openStrikeModal = (p: any, e: React.MouseEvent, denunciaId?: string) => {
    e.stopPropagation();
    const currentStrikes = p.strikes || 0;
    if (currentStrikes >= 3) {
      showAlert("Límite", "Este usuario ya tiene 3 strikes.");
      return;
    }
    const nextN = currentStrikes + 1;
    setStrikeModal({
      p,
      denunciaId,
      motivo: denunciaId ? `Infracción en expediente #${String(denunciaId).slice(0, 8)}` : "",
      duration: nextN >= 3 ? "indefinite" : "no_restrict",
    });
  };

  const ejecutarStrikeModal = async () => {
    if (!strikeModal) return;
    const trimmed = strikeModal.motivo.trim();
    if (!trimmed) {
      showAlert("Motivo obligatorio", "Describe el motivo del strike.");
      return;
    }
    const { p, denunciaId, duration } = strikeModal;
    const restrict = duration !== "no_restrict";

    let restrictedUntilIso: string | null = null;
    if (restrict) {
      if (duration === "7d") restrictedUntilIso = new Date(Date.now() + 7 * 86400000).toISOString();
      else if (duration === "30d") restrictedUntilIso = new Date(Date.now() + 30 * 86400000).toISOString();
      else if (duration === "90d") restrictedUntilIso = new Date(Date.now() + 90 * 86400000).toISOString();
      else if (duration === "180d") restrictedUntilIso = new Date(Date.now() + 180 * 86400000).toISOString();
      else if (duration === "365d") restrictedUntilIso = new Date(Date.now() + 365 * 86400000).toISOString();
      else restrictedUntilIso = null;
    }

    const currentStrikes = p.strikes || 0;
    const newStrikes = currentStrikes + 1;

    setStrikeModal(null);
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();

      await supabase.from("strike_history").insert({
        user_id: p.user_id,
        admin_name: profile?.display_name || "Admin",
        reason: trimmed,
        denuncia_id: denunciaId || null,
      });

      const { error } = await supabase.rpc("admin_update_strikes", {
        target_user_id: p.user_id,
        nuevos_strikes: newStrikes,
        restringir: restrict,
      });
      if (error) throw error;

      if (restrict) {
        const { error: ruErr } = await supabase
          .from("profiles")
          .update({ restricted_until: restrictedUntilIso })
          .eq("user_id", p.user_id);
        if (ruErr && !String(ruErr.message || "").includes("restricted_until")) throw ruErr;
      }

      let restriccionTxt = "";
      if (!restrict) {
        restriccionTxt =
          "Con este strike tu cuenta no ha sido restringida (solo queda constancia interna). Si llegas a 3 strikes, revisa las normas.";
      } else if (duration === "indefinite") {
        restriccionTxt =
          "Tu cuenta ha sido RESTRINGIDA hasta nueva revisión manual por el equipo.";
      } else if (restrictedUntilIso) {
        const dl =
          duration === "7d"
            ? "7 días"
            : duration === "30d"
              ? "30 días"
              : duration === "90d"
                ? "90 días"
                : duration === "180d"
                  ? "6 meses"
                  : duration === "365d"
                    ? "1 año"
                    : "";
        restriccionTxt = `Tu cuenta ha sido RESTRINGIDA hasta el ${new Date(restrictedUntilIso).toLocaleDateString()}${dl ? ` (${dl})` : ""}.`;
      } else {
        restriccionTxt = "Tu cuenta ha sido RESTRINGIDA temporalmente.";
      }

      const mensajeNotificacion = `⚠️ HAS RECIBIDO UN STRIKE (${newStrikes}/3). Motivo: ${trimmed}.

${restriccionTxt}

🚫 Si estás restringido/a: pueden aplicarse límites en Fan Zone, muros, market, etc., según las normas.

Si crees que es un error, entra en tu Perfil y pulsa «Recurrir sanción».`;

      await supabase.from("notifications").insert({
        user_id: p.user_id,
        sender_id: auth.user?.id,
        type: "admin_message",
        content: mensajeNotificacion,
        read: false,
      });

      sincronizarCambioUsuario(p.user_id, { strikes: newStrikes, is_restricted: restrict });
      showAlert("Éxito", `Strike ${newStrikes}/3 registrado y notificado.`);
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN QUITAR STRIKE ---
  const quitarStrike = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!p.strikes || p.strikes <= 0) return showAlert("Aviso", "No tiene strikes.");
    
    setLoading(true);
    try {
      const newStrikes = p.strikes - 1;
      // Usamos el RPC para saltar el bloqueo de Supabase
      const { error } = await supabase.rpc('admin_update_strikes', { target_user_id: p.user_id, nuevos_strikes: newStrikes, restringir: p.is_restricted });
      if (error) throw error;

      sincronizarCambioUsuario(p.user_id, { strikes: newStrikes });
      showAlert("Éxito", `Strike retirado. Ahora tiene ${newStrikes}/3.`);
    } catch (err: any) { showAlert("Error", err.message); } 
    finally { setLoading(false); }
  };

  // --- FUNCIÓN RESTAURAR PERFIL (QUITAR RESTRICCIÓN) ---
  const removerRestriccion = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('profiles').update({ is_restricted: false }).eq('user_id', p.user_id);
      
      // Le avisamos de que ha sido perdonado
      await supabase.from('notifications').insert({
        user_id: p.user_id, sender_id: auth.user?.id, type: 'admin_message',
        content: `✅ TU PERFIL HA SIDO RESTAURADO. Ya puedes volver a interactuar con normalidad.`, read: false
      });

      sincronizarCambioUsuario(p.user_id, { is_restricted: false });
      showAlert("Éxito", "Perfil restaurado y usuario notificado.");
    } catch (err: any) { showAlert("Error", err.message); } 
    finally { setLoading(false); }
  };
const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(false);
  // --- FUNCIÓN NOTAS CON TIMESTAMP (FECHA + HORA) ---
  const guardarNotaAdmin = async (denunciaId: string, nuevaNota: string) => {
    if (!nuevaNota.trim()) return;
    setLoading(true);
    try {
      const ahora = new Date();
      const fechaHora = `${ahora.toLocaleDateString()} ${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const adminName = profile?.display_name || 'Admin';
      const notaFormateada = `\n[${fechaHora} - ${adminName}]: ${nuevaNota}`;
      const notaFinal = (selectedDenuncia.notas_admin || "") + notaFormateada;

      await supabase.from('denuncias').update({ notas_admin: notaFinal }).eq('id', denunciaId);
      
      setSelectedDenuncia((prev:any) => ({...prev, notas_admin: notaFinal}));
      setDenuncias(prev => prev.map(d => d.id === denunciaId ? {...d, notas_admin: notaFinal} : d));
      
      const input = document.getElementById("input-nueva-nota") as HTMLTextAreaElement;
      if (input) input.value = "";
      showAlert("Éxito", "Comentario guardado con fecha y hora.");
    } catch (err: any) { showAlert("Error", err.message); }
    finally { setLoading(false); }
  };

  // --- 2. FUNCIÓN NOTIFICAR (ABRE EL MODAL) ---
  const [notificarModal, setNotificarModal] = useState<any | null>(null);
  const [mensajeNotif, setMensajeNotif] = useState("");
// --- ESTADO PARA EL MODAL DE SUSPENSIÓN ---
  const [suspenderModal, setSuspenderModal] = useState<any | null>(null);

  // --- FUNCIÓN APLICAR SUSPENSIÓN (SISTEMA DE TICKET ÚNICO) ---
const aplicarSuspension = async (tipo: '1_mes' | '6_meses' | 'definitivo') => {
  if (!suspenderModal) return;
  setLoading(true);
  try {
    const p = suspenderModal;
    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth.user?.id;
    let fechaDate = new Date();
    let fechaVencimiento = "";
    let estadoTicket = "completada"; // Por defecto lo cerramos si es definitivo
    let msjUsuario = "";
    let msjHistorial = "";

    if (tipo === '1_mes') {
      fechaDate.setMonth(fechaDate.getMonth() + 1);
      fechaVencimiento = fechaDate.toLocaleDateString();
      estadoTicket = "revisar_reactivacion"; // Nuevo estado flotante
      msjHistorial = `[SANCIONADO]: Suspensión de 1 MES. Vence el ${fechaVencimiento}.`;
      msjUsuario = `Tu cuenta ha sido SUSPENDIDA TEMPORALMENTE por 1 mes (hasta el ${fechaVencimiento}).`;
    } else if (tipo === '6_meses') {
      fechaDate.setMonth(fechaDate.getMonth() + 6);
      fechaVencimiento = fechaDate.toLocaleDateString();
      estadoTicket = "revisar_reactivacion";
      msjHistorial = `[SANCIONADO]: Suspensión de 6 MESES. Vence el ${fechaVencimiento}.`;
      msjUsuario = `Tu cuenta ha sido SUSPENDIDA TEMPORALMENTE por 6 meses (hasta el ${fechaVencimiento}).`;
    } else {
      msjHistorial = `[EXPULSADO]: Suspensión DEFINITIVA el ${new Date().toLocaleDateString()}.`;
      msjUsuario = `Tu cuenta ha sido SUSPENDIDA DEFINITIVAMENTE por faltas graves.`;
    }

    // 1. Restringir usuario
    const { error } = await supabase.rpc('admin_update_strikes', {
      target_user_id: p.user_id,
      nuevos_strikes: p.strikes || 0,
      restringir: true
    });
    if (error) throw error;

    // 2. Notificación al usuario
    await supabase.from('notifications').insert({
      user_id: p.user_id, sender_id: adminId, type: 'admin_message',
      content: msjUsuario, read: false
    });

    // 3. ACTUALIZAR EL TICKET EXISTENTE (En lugar de crear uno nuevo)
      if (selectedDenuncia) {
        const ahora = new Date();
        const fechaLog = `${ahora.toLocaleDateString()} ${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const adminName = profile?.display_name || 'Admin';
        
        // 1. Quitamos el \n del principio del mensaje nuevo
        const notaFormateada = `[${fechaLog} ${adminName}]: ${msjHistorial}`; 
        
        // 2. Le damos la vuelta: Mensaje Nuevo + Salto de línea + Mensaje Viejo
        const notaFinal = notaFormateada + "\n" + (selectedDenuncia.notas_admin || "");

        await supabase.from('denuncias').update({ 
          estado: estadoTicket,
          notas_admin: notaFinal 
        }).eq('id', selectedDenuncia.id);

        setSelectedDenuncia((prev:any) => ({...prev, notas_admin: notaFinal, estado: estadoTicket}));
        setDenuncias(prev => prev.map(d => d.id === selectedDenuncia.id ? {...d, notas_admin: notaFinal, estado: estadoTicket} : d));
      }

    sincronizarCambioUsuario(p.user_id, { is_restricted: true });
    setSuspenderModal(null);
    showAlert("Éxito", `Usuario suspendido. El ticket ha quedado actualizado.`);
  } catch (err: any) { 
    showAlert("Error", err.message); 
  } finally { 
    setLoading(false); 
  }
};
  const enviarNotificacionSancion = async () => {
    if (!mensajeNotif.trim()) return showAlert("Error", "Escribe un mensaje.");
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('notifications').insert({
        user_id: notificarModal.user_id,
        sender_id: auth.user?.id,
        type: 'admin_message',
        content: `⚠️ AVISO DE MODERACIÓN: ${mensajeNotif}`,
        read: false
      });
      showAlert("Enviado", "Notificación enviada al usuario.");
      setNotificarModal(null);
      setMensajeNotif("");
    } catch (err: any) { showAlert("Error", err.message); }
    finally { setLoading(false); }
  };

  // --- 2. FUNCIÓN PARA VER EL HISTORIAL ---
  const verHistorialStrikes = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { data, error } = await supabase.from('strike_history').select('*').eq('user_id', p.user_id).order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        showAlert("Historial Vacío", "No hay motivos registrados.");
      } else {
        const listaMotivos = data.map(s => `• [${new Date(s.created_at).toLocaleDateString()}] ${s.admin_name}: ${s.reason}`).join('\n');
        setConfirmDialog({
          title: `Historial de ${p.display_name}`,
          message: listaMotivos,
          onConfirm: () => setConfirmDialog(null)
        });
      }
    } catch (err: any) { showAlert("Error", err.message); } 
    finally { setLoading(false); }
  };

  // --- 3. FUNCIÓN PARA RESETEAR STRIKES ---
  const resetStrikes = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      title: "Resetear Historial",
      message: `¿Seguro que quieres borrar TODOS los strikes de ${p.display_name}? Esto volverá su contador a 0/3.`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await supabase.from('profiles').update({ strikes: 0 }).eq('user_id', p.user_id);
          await supabase.from('strike_history').delete().eq('user_id', p.user_id);
          sincronizarCambioUsuario(p.user_id, { strikes: 0 });
          showAlert("Historial Limpiado", "Contador vuelto a 0.");
        } catch (err: any) { showAlert("Error", err.message); } 
        finally { setLoading(false); }
      }
    });
  };

  
  // 👇 FUNCIONES DE PUNTOS 👇
  const updatePuntos = async (userId: string, name: string, current: number, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (current || 0) + delta;
    
    if (next < 0 && delta < 0) {
      return showAlert("Aviso", "No puedes dejar al usuario con K-oins negativos.");
    }

    setConfirmDialog({
      title: delta > 0 ? "🎁 Premiar Usuario" : "⚠️ Penalizar Usuario",
      message: `¿Quieres ${delta > 0 ? 'darle' : 'quitarle'} ${Math.abs(delta)} K-oins a @${name}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('admin_update_puntos', { target_user_id: userId, nuevos_puntos: next });
          if (error) throw error;
          
          const { data: authData } = await supabase.auth.getUser();
          await supabase.from('notifications').insert({
            user_id: userId, sender_id: authData.user?.id, type: 'admin_message', 
            content: delta > 0 ? `🎁 Has recibido ${delta} K-oins por tu colaboración.` : `⚠️ Se han retirado ${Math.abs(delta)} K-oins de tu cuenta.`, 
            read: false
          });

          showAlert("K-oins Actualizados", `Saldo de @${name} actualizado a ${next} K-oins.`);
          sincronizarCambioUsuario(userId, { puntos: next });
        } catch(err:any) {
          showAlert("Error", err.message);
        }
      }
    });
  };

  const updatePuntosExact = async (userId: string, name: string, exact: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (exact < 0) return showAlert("Aviso", "No puedes dejar al usuario con K-oins negativos.");

    setConfirmDialog({
      title: "Fijar K-oins",
      message: `¿Quieres fijar los K-oins de @${name} exactamente en ${exact}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('admin_update_puntos', { target_user_id: userId, nuevos_puntos: exact });
          if (error) throw error;
          
          const { data: authData } = await supabase.auth.getUser();
          await supabase.from('notifications').insert({
            user_id: userId, sender_id: authData.user?.id, type: 'admin_message', 
            content: `Administración ha ajustado tus K-oins. Tu saldo actual es de ${exact} K-oins.`, 
            read: false
          });

          showAlert("K-oins Actualizados", `Saldo de @${name} fijado en ${exact} K-oins.`);
          sincronizarCambioUsuario(userId, { puntos: exact });
        } catch(err:any) {
          showAlert("Error", err.message);
        }
      }
    });
  };
  // 👆 FIN FUNCIONES DE PUNTOS 👆

  const uploadToStorage = async (fileToUpload: File) => {
    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
    
    const { error: storageError } = await supabase.storage
      .from('fanart-pics')
      .upload(fileName, fileToUpload);

    if (storageError) throw storageError;

    const { data: { publicUrl } } = supabase.storage
      .from('fanart-pics')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const traducirTodoJSON = async (
    texto: string,
    targetLangs: string[],
    intentos = 3
  ): Promise<Record<string, string> | null> => {
    for (let i = 0; i < intentos; i++) {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "batch",
            text: texto,
            targetLangs,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const reason = String((json as any)?.reason || "").toLowerCase();
          if (
            reason.includes("api_key_invalid") ||
            reason.includes("permission_denied") ||
            reason.includes("api_not_enabled_or_restricted")
          ) {
            return null;
          }
          throw new Error((json as any)?.error || "TRANSLATION_REQUEST_FAILED");
        }
        return ((json as any)?.translations || null) as Record<string, string> | null;
      } catch (error) {
        console.error(`Error de la IA (Intento ${i + 1} de ${intentos}):`, error);
        if (i === intentos - 1) return null;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    return null;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión de usuario");

      if (!selectedUserId) {
        setLoading(false);
        return showAlert("Atención", "¡Error! Debes seleccionar un usuario del buscador.");
      }

      let mainUrl: string = "text-only";
      let finalThumbUrl: string | null = null;

      if (formData.category === "Fanfics") {
        if (!formData.content_text.trim()) {
          setLoading(false);
          return showAlert("Atención", "El contenido del fanfic no puede estar vacío.");
        }

        if (!isNewStory && !selectedStoryId) {
          setLoading(false);
          return showAlert("Atención", "Por favor, selecciona una historia existente.");
        }

        const textoParaTraducir = `${formData.title}\n|||\n${formData.content_text}`;
        const IDIOMAS_CODIGOS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'id', 'th', 'ko', 'zh', 'ja'];
        const idiomasDestino = IDIOMAS_CODIGOS.filter((lang) => lang !== "es");
        const traduccionesIA = await traducirTodoJSON(textoParaTraducir, idiomasDestino);

        if (!traduccionesIA) {
          showAlert(
            "Atención",
            "No se pudieron generar traducciones automáticas ahora (API de Gemini no disponible o clave inválida). Se publicará solo en español."
          );
        }

        let currentObraId = selectedStoryId;

        if (isNewStory) {
          const { data: newObra, error: errO } = await supabase
            .from('obras')
            .insert([{ autor_id: selectedUserId, idioma_original: 'es' }])
            .select('id').single();

          if (errO || !newObra) throw new Error("Error creando obra: " + errO?.message);
          currentObraId = newObra.id;
        } else {
          const { data: checkObra } = await supabase.from('obras').select('id').eq('id', currentObraId).maybeSingle();
          if (!checkObra) {
            const { error: errMig } = await supabase.from('obras').insert([{ id: currentObraId, autor_id: selectedUserId, idioma_original: 'es' }]);
            if (errMig) throw new Error("Error adaptando historia antigua: " + errMig.message);
          }
        }

        const { data: capsExistentes } = await supabase
          .from('capitulos').select('numero_capitulo')
          .eq('obra_id', currentObraId).order('numero_capitulo', { ascending: false }).limit(1);
        
        const sigCapitulo = (capsExistentes?.[0]?.numero_capitulo ?? 0) + 1;

        const { data: newCap, error: errC } = await supabase
          .from('capitulos')
          .insert([{ obra_id: currentObraId, numero_capitulo: sigCapitulo }])
          .select('id').single();

        if (errC || !newCap) throw new Error("Error creando capítulo: " + errC?.message);

        const rowsTraducciones = IDIOMAS_CODIGOS.flatMap(lang => {
          if (lang === 'es') {
            return [{
              capitulo_id: newCap.id,
              idioma: lang,
              titulo: formData.title,
              contenido: formData.content_text
            }];
          }
          if (!traduccionesIA?.[lang]) return [];
          const parsed = splitTitleBody(traduccionesIA[lang], formData.title, formData.content_text);
          if (
            parsed.title.trim() === formData.title.trim() &&
            parsed.body.trim() === formData.content_text.trim()
          ) {
            return [];
          }
          return [{
            capitulo_id: newCap.id,
            idioma: lang,
            titulo: parsed.title,
            contenido: parsed.body
          }];
        });

        const { error: errT } = await supabase.from('traducciones').insert(rowsTraducciones);
        if (errT) console.error("Error en traducciones:", errT);

        if (isNewStory) {
          if (thumbFile) { finalThumbUrl = await uploadToStorage(thumbFile); mainUrl = finalThumbUrl; }
          await supabase.from('fanarts').insert({
            id: currentObraId, title: formData.title, artist_name: formData.artist_name,
            user_id: selectedUserId, category: "Fanfics", image_url: mainUrl,
            thumbnail_url: finalThumbUrl, content_text: formData.content_text, active: true
          });
        }

        showAlert("Éxito", `¡${isNewStory ? 'HISTORIA' : 'CAPÍTULO ' + sigCapitulo} PUBLICADA!`);
        
        setFormData({ title: "", artist_name: "", category: "Arte 2D", content_text: "", is_nsfw: false });
        setFile(null); setThumbFile(null); setSearchTerm(""); setSelectedUserId(null);
        setLoading(false);
        return;
      } else {
        if (!file) {
          setLoading(false);
          return showAlert("Atención", "Selecciona un archivo para la galería.");
        }

        mainUrl = await uploadToStorage(file);
        finalThumbUrl = thumbFile ? await uploadToStorage(thumbFile) : mainUrl;

        const { error: dbError } = await supabase.from('fanarts').insert({
          title: formData.title,
          artist_name: formData.artist_name,
          user_id: selectedUserId,
          category: formData.category,
          image_url: mainUrl,
          thumbnail_url: finalThumbUrl,
          is_nsfw: formData.is_nsfw,
          media_type: file.type.includes("video") ? "video" : (file.type.includes("pdf") ? "pdf" : "image")
        });

        if (dbError) throw dbError;

        await supabase.from('notifications').insert({
          user_id: selectedUserId,
          sender_id: user.id,
          type: 'admin_approval',
          content: `Tu obra "${formData.title}" ha sido publicada.`
        });

        showAlert("Éxito", "¡Publicado con éxito!");
        
        setFormData({ title: "", artist_name: "", category: "Arte 2D", content_text: "", is_nsfw: false });
        setFile(null);
        setThumbFile(null);
        setSearchTerm("");
        setSelectedUserId(null);
      }

    } catch (error: any) {
      console.error("Error detallado:", error);
      showAlert("Error", "Error en la subida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAdminDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  const usersFilterTitle: Record<AdminUsersFilter, string> = {
    todos: "Todos los usuarios",
    alta: "Usuarios dados de alta",
    baja: "Usuarios dados de baja",
    pendiente: "Pendientes de confirmación",
    restringido: "Usuarios restringidos",
    sin_perfil: "Sin perfil",
    premium: "Usuarios Premium",
    artista: "Artistas",
  };

  const renderAdminUserCard = (p: AdminOverviewUser) => {
    const bucket = deriveUserBucket(p);
    const who = p.display_name || p.email || "usuario";
    const bucketColor =
      p.is_banned && !p.is_deleted
        ? "var(--state-danger-fg)"
        : bucket === "alta"
          ? "var(--state-success-fg)"
          : bucket === "pendiente"
            ? "var(--state-warning-fg)"
            : bucket === "restringido"
              ? "var(--state-danger-fg)"
              : "var(--text-muted)";
    const bucketText =
      p.is_deleted
        ? "ELIMINADA"
        : p.is_banned
          ? "BLOQUEADO"
          : bucket === "alta"
            ? "ALTA"
            : bucket === "pendiente"
              ? "PENDIENTE"
              : bucket === "restringido"
                ? "RESTRINGIDO"
                : "BAJA";
    const actionsOpen = openUserActionsId === p.user_id;
    return (
      <div key={p.user_id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--bg-soft)", display: "flex", flexDirection: "column", gap: actionsOpen ? "10px" : "0", background: actionsOpen ? "var(--bg-soft)" : "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, color: p.is_restricted || p.is_banned ? "var(--state-danger-fg)" : "var(--text-main)", fontSize: "14px", textDecoration: p.is_restricted ? "line-through" : "none" }}>
                {p.display_name || p.email || p.user_id.slice(0, 8)} {p.is_premium && <span title="Usuario Premium">👑</span>} {p.is_artist && <span title="Artista Verificado">✨</span>} {p.is_featured_artist && <span title="Artista Estrella">🌟</span>} {p.is_restricted && <span title="Cuenta Restringida">🛑</span>} {p.is_banned && <span title="Login bloqueado">🔒</span>}
              </span>
              <span style={{ fontSize: "10px", fontWeight: 900, color: bucketColor }}>{bucketText}</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, marginTop: "2px" }}>
              {p.email || "Sin email"} · Alta: {formatAdminDate(p.created_at)} · Último acceso: {formatAdminDate(p.last_sign_in_at)}
            </div>
          </div>
          <button
            type="button"
            aria-expanded={actionsOpen}
            onClick={() => setOpenUserActionsId(actionsOpen ? null : p.user_id)}
            style={{ ...compactActionStyle(actionsOpen ? "primary" : "default"), flexShrink: 0 }}
          >
            {actionsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {actionsOpen ? "Cerrar" : "Acciones"}
          </button>
        </div>

        {actionsOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!p.is_deleted && (
            <AdminUserActionGroup label="ACCESO">
              <button
                type="button"
                onClick={(e) =>
                  confirmUserAuthAction(
                    p,
                    "reset_password",
                    "Restablecer contraseña",
                    `Se enviará un email a ${p.email || who} para que elija una nueva contraseña.`,
                    e,
                  )
                }
                style={compactActionStyle()}
              >
                <KeyRound size={12} /> Restablecer contraseña
              </button>
              {p.is_banned ? (
                <button
                  type="button"
                  onClick={(e) =>
                    confirmUserAuthAction(
                      p,
                      "unlock_login",
                      "Desbloquear inicio de sesión",
                      `¿Desbloquear el acceso de ${who}? Podrá volver a entrar con su email y contraseña.`,
                      e,
                    )
                  }
                  style={compactActionStyle("success")}
                >
                  <Unlock size={12} /> Desbloquear login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) =>
                    confirmUserAuthAction(
                      p,
                      "lock_login",
                      "Bloquear inicio de sesión",
                      `¿Bloquear el acceso de ${who}? La cuenta no se borra, pero no podrá iniciar sesión. Luego puedes desbloquearla.`,
                      e,
                    )
                  }
                  style={compactActionStyle("warning")}
                >
                  <Lock size={12} /> Bloquear login
                </button>
              )}
              {!p.email_confirmed && (
                <button
                  type="button"
                  onClick={(e) =>
                    confirmUserAuthAction(
                      p,
                      "confirm_email",
                      "Confirmar email",
                      `¿Marcar el email de ${who} como confirmado? Útil si no le llega el correo de verificación.`,
                      e,
                    )
                  }
                  style={compactActionStyle("success")}
                >
                  <MailOpen size={12} /> Confirmar email
                </button>
              )}
              <button
                type="button"
                onClick={(e) =>
                  confirmUserAuthAction(
                    p,
                    "sign_out_all",
                    "Cerrar todas las sesiones",
                    `¿Cerrar todas las sesiones de ${who}? Tendrá que volver a iniciar sesión en todos sus dispositivos. Útil si cree que le han robado la cuenta.`,
                    e,
                  )
                }
                style={compactActionStyle()}
              >
                <LogOut size={12} /> Cerrar sesiones
              </button>
            </AdminUserActionGroup>
          )}

          <AdminUserActionGroup label="CUENTA">
            <button type="button" onClick={() => router.push(`/user/${p.user_id}`)} style={compactActionStyle()}>
              <ExternalLink size={12} /> Perfil
            </button>
            {p.is_premium ? (
              <button onClick={(e) => togglePremium(p, "free", e)} style={compactActionStyle("warning")}>
                <Crown size={12} /> Quitar premium
              </button>
            ) : (
              <>
                <button onClick={(e) => togglePremium(p, "mensual", e)} style={compactActionStyle()}>
                  <Crown size={12} /> + Mes
                </button>
                <button onClick={(e) => togglePremium(p, "anual", e)} style={compactActionStyle()}>
                  <Crown size={12} /> + Año
                </button>
              </>
            )}
            <button onClick={(e) => toggleStatus(p.user_id, who, "is_artist", p.is_artist, e)} style={compactActionStyle(p.is_artist ? "success" : "default")}>
              <Star size={12} /> {p.is_artist ? "Quitar artista" : "Artista"}
            </button>
            <button onClick={(e) => void toggleFeaturedArtist(p, e)} style={compactActionStyle(p.is_featured_artist ? "warning" : "default")}>
              <Sparkles size={12} /> {p.is_featured_artist ? "Quitar estrella" : "Estrella"}
            </button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--bg-main)", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "10px", fontWeight: 900, color: "var(--color-primary)" }}>K-oins</span>
              <input
                type="number"
                defaultValue={p.puntos || 0}
                id={`pts-${p.user_id}`}
                style={{ width: "52px", textAlign: "center", fontWeight: 800, border: "1px solid var(--color-border)", borderRadius: "4px", padding: "2px 4px", fontSize: "11px" }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const val = (document.getElementById(`pts-${p.user_id}`) as HTMLInputElement).value;
                  updatePuntosExact(p.user_id, who, parseInt(val || "0", 10), e);
                }}
                style={{ ...compactActionStyle("primary"), padding: "3px 6px" }}
              >
                OK
              </button>
            </div>
          </AdminUserActionGroup>

          <AdminUserActionGroup label="MODERACIÓN">
            <button onClick={(e) => openStrikeModal(p, e)} disabled={p.strikes >= 3} style={{ ...compactActionStyle(p.strikes >= 3 ? "default" : "danger"), opacity: p.strikes >= 3 ? 0.55 : 1, cursor: p.strikes >= 3 ? "not-allowed" : "pointer" }}>
              <ShieldAlert size={12} /> Strike {p.strikes || 0}/3
            </button>
            <button onClick={(e) => verHistorialStrikes(p, e)} style={compactActionStyle()}>
              <FileText size={12} /> Historial
            </button>
            {p.strikes > 0 && (
              <button onClick={(e) => resetStrikes(p, e)} style={compactActionStyle("danger")}>
                <Undo2 size={12} /> Reset strikes
              </button>
            )}
            {p.is_restricted && (
              <button onClick={(e) => removerRestriccion(p, e)} style={compactActionStyle("success")}>
                <CheckCircle size={12} /> Perdonar
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void guardarUsuarioPerfil(p);
              }}
              disabled={loading}
              style={{ ...compactActionStyle(), opacity: loading ? 0.75 : 1, cursor: loading ? "wait" : "pointer" }}
            >
              <Save size={12} /> Guardar
            </button>
            {!p.is_deleted && (
              <button type="button" onClick={(e) => fulminarUsuario(p.user_id, who, e)} style={compactActionStyle("danger")}>
                <AlertTriangle size={12} /> Fulminar
              </button>
            )}
          </AdminUserActionGroup>
        </div>
        )}
      </div>
    );
  };

  const adminNav = [
    {
      label: "Contenido",
      items: [
        { id: "publicar", label: "Publicar", icon: PenTool },
        { id: "catalogo", label: "Catálogo", icon: Tags },
        { id: "publicidad", label: "Publicidad", icon: Sparkles },
      ],
    },
    {
      label: "Comunidad",
      items: [
        { id: "usuarios", label: "Usuarios", icon: Users },
        { id: "solicitudes", label: "Solicitudes", icon: Mail },
        { id: "denuncias", label: "Denuncias", icon: ShieldAlert },
        { id: "buzon", label: "Buzón", icon: MailOpen },
        { id: "aportaciones", label: "Aportaciones", icon: ImagePlus },
      ],
    },
    {
      label: "Ayuda",
      items: [{ id: "manual", label: "Manual", icon: HelpCircle }],
    },
  ];

  const openAdminTab = (id: string) => {
    setActiveTab(id);
    const params = new URLSearchParams(searchParams.toString());
    const already =
      params.get("tab") === id &&
      !params.get("reopen") &&
      !params.get("buzonId") &&
      !params.get("aportacionId");
    if (already) return;
    params.set("tab", id);
    params.delete("reopen");
    params.delete("buzonId");
    params.delete("aportacionId");
    setSelectedDenuncia(null);
    setSelectedBuzon(null);
    setSelectedAportacion(null);
    router.replace(`/admin-panel?${params.toString()}`, { scroll: false });
  };

  const openPublishFor = (userId: string | null | undefined, name: string) => {
    const label = name.trim() || "esta persona";
    if (!userId) {
      showAlert("Sin usuario", `La solicitud de ${label} no tiene cuenta vinculada. Búscala a mano en Publicar.`);
      openAdminTab("publicar");
      return;
    }
    if (activeTab === "publicar") {
      holdUserSearchRef.current = true;
      setSelectedUserId(userId);
      setSearchTerm(label);
      setProfiles([]);
      return;
    }
    pendingPublishRef.current = { userId, name: label };
    openAdminTab("publicar");
  };

  if (authLoading) {
    return <CatalogLoadingFun fullPage />;
  }

  if (!isAdminTeamEmail(userEmail)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-main)", padding: "24px", textAlign: "center", gap: "16px" }}>
        <ShieldAlert size={48} color="var(--state-danger-fg)" />
        <h1 className="tan-font" style={{ color: "var(--color-primary)", margin: 0 }}>Acceso restringido</h1>
        <p style={{ color: "var(--text-muted)", fontWeight: 600, maxWidth: "360px" }}>No tienes permiso para ver el panel de administración.</p>
        <button type="button" onClick={() => router.push("/")} style={{ background: "var(--color-primary)", color: "white", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: 900, cursor: "pointer" }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="admin-panel-root" style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", color: "var(--text-main)", paddingBottom: "100px" }}>
      <div className="admin-shell">
        <aside className="admin-side">
          <div className="admin-brand">
            <span className="admin-kicker">My K-pop Binder</span>
            <h1 className="tan-font">Admin</h1>
            <p>Gestión de la plataforma</p>
          </div>
          <nav className="admin-nav" aria-label="Secciones del panel">
            {adminNav.map((group) => (
              <div key={group.label} className="admin-nav-group">
                <span className="admin-nav-label">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={active ? "admin-nav-btn is-active" : "admin-nav-btn"}
                      aria-current={active ? "page" : undefined}
                      onClick={() => openAdminTab(item.id)}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="admin-stage">
        <div className={activeTab === "manual" ? "admin-stage-body is-plain" : "admin-stage-body"}>
          
          {/* PESTAÑA 1: PUBLICAR OBRA */}
          {activeTab === "publicar" && (
            <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", borderBottom: "2px dashed var(--color-border)", paddingBottom: "15px" }}>
                <UploadCloud color="var(--color-primary)" size={28} />
                <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Publicar en nombre de un usuario</h2>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={labelStyle}>Título de la obra *</label>
                  <input
                    required
                    disabled={formData.category === "Fanfics" && !isNewStory}
                    style={{
                      ...inputStyle,
                      opacity: formData.category === "Fanfics" && !isNewStory ? 0.75 : 1,
                      cursor: formData.category === "Fanfics" && !isNewStory ? "not-allowed" : "text",
                    }}
                    value={formData.title}
                    onChange={e => {
                      const nextTitle = e.target.value;
                      setFormData({...formData, title: nextTitle});
                      if (formData.category === "Fanfics" && isNewStory) {
                        setNewStoryDraftTitle(nextTitle);
                      }
                    }}
                    placeholder={formData.category === "Fanfics" && !isNewStory ? "Se rellena automáticamente con la obra elegida" : "Ej: Fanfic de Bang Chan"}
                  />
                  {formData.category === "Fanfics" && !isNewStory && (
                    <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>
                      En continuación, el título se vincula automáticamente a la obra seleccionada.
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Categoría *</label>
                  <select style={inputStyle} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option>Arte 2D</option>
                    <option>Arte 3D</option>
                    <option>Artesanía</option>
                    <option>Fanfics</option>
                    <option>Multimedia</option>
                  </select>
                </div>

                {formData.category === "Fanfics" && selectedUserId && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-soft)", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                    <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 800, fontSize: "14px", color: "var(--color-primary)" }}>
                        <input
                          type="radio"
                          checked={isNewStory}
                          onChange={() => {
                            setIsNewStory(true);
                            setSelectedStoryId("");
                            setFormData((prev) => ({ ...prev, title: newStoryDraftTitle || prev.title }));
                          }}
                        /> Primera obra
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: userStories.length > 0 ? "pointer" : "not-allowed", fontWeight: 800, fontSize: "14px", color: userStories.length > 0 ? "var(--color-primary)" : "var(--text-muted)" }}>
                        <input
                          type="radio"
                          checked={!isNewStory}
                          onChange={() => {
                            if (isNewStory && formData.category === "Fanfics") {
                              setNewStoryDraftTitle(formData.title);
                            }
                            setIsNewStory(false);
                          }}
                          disabled={userStories.length === 0}
                        />
                        Continuación de obra existente
                      </label>
                    </div>
                    {!isNewStory && (
                      <select style={{ ...inputStyle, flex: 1, padding: "8px" }} value={selectedStoryId} onChange={(e) => setSelectedStoryId(e.target.value)}>
                        <option value="">-- Elige la obra existente --</option>
                        {userStories.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.title} {typeof s.chapterCount === "number" ? `(${s.chapterCount} cap.)` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {userStories.length === 0 && (
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", fontWeight: 700 }}>
                        Este usuario no tiene fanfics previos. Solo se puede publicar como primera obra.
                      </p>
                    )}
                  </div>
                )}

                <div style={{ position: 'relative', gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Buscar Usuario (Para asignarle la obra) *</label>
                  <input style={inputStyle} placeholder="Busca por nombre de usuario..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  {selectedUserId && (
                    <p style={{ margin: "8px 0 0", fontSize: "13px", fontWeight: 800, color: "var(--color-primary)" }}>
                      La obra se publicará a nombre de {searchTerm || "este usuario"}.
                    </p>
                  )}
                  
                  {profiles.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 100, background: 'var(--bg-card)', width: '100%', border: '1px solid var(--color-border)', borderRadius: '12px', marginTop: '4px', overflow: 'hidden', boxShadow: '0 4px 12px var(--overlay-faint)' }}>
                      {profiles.map((p) => (
                        <div 
                          key={p.user_id} 
                          onClick={() => {
                            setSelectedUserId(p.user_id);
                            setSearchTerm(p.display_name);
                            setProfiles([]);
                            setUserStories([]);
                            setIsNewStory(true);
                            setSelectedStoryId("");
                          }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-soft)'}
                          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'}
                          style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', fontSize: "14px", color: "var(--text-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                        >
                          <span style={{ fontWeight: selectedUserId === p.user_id ? 900 : 500, color: selectedUserId === p.user_id ? "var(--color-primary)" : "inherit" }}>
                            {p.display_name} {selectedUserId === p.user_id && " ✓"} {p.is_artist && <span title="Artista Verificado">✨</span>} {p.is_featured_artist && <span title="Artista Estrella">🌟</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <hr style={{ border: "0.5px solid var(--color-border)", margin: "10px 0" }} />

              {formData.category === "Fanfics" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={labelStyle}><BookOpen size={16} style={{ display: "inline", marginBottom: "-3px" }}/> Texto de la Historia *</label>
                    <textarea required style={{ ...inputStyle, minHeight: "350px", resize: "vertical", fontFamily: "Georgia, serif", fontSize: "15px", lineHeight: "1.6" }} value={formData.content_text} onChange={e => setFormData({...formData, content_text: e.target.value})} placeholder="Érase una vez..." />
                  </div>
                  {isNewStory && (
                    <div>
                      <label style={labelStyle}>Portada de la obra (opcional, solo imagen)</label>
                      <div style={dropzoneStyle(!!thumbFile, "var(--state-info-bg)")}>
                        <input type="file" accept="image/*" onChange={e => setThumbFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="thumb-file-fanfic" />
                        <label htmlFor="thumb-file-fanfic" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                          {thumbFile ? <CheckCircle2 color="var(--state-info-fg)" /> : <ImagePlus color="var(--state-info-fg)" />}
                          <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--state-info-fg)" }}>{thumbFile ? thumbFile.name : "Subir portada (JPG/PNG)"}</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>1. Archivo Principal (PDF, Vídeo o Imagen) *</label>
                    <div style={dropzoneStyle(!!file)}>
                      <input type="file" accept="image/*,video/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="main-file" />
                      <label htmlFor="main-file" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                        {file ? <CheckCircle2 color="var(--color-primary)" /> : <UploadCloud color="var(--color-primary)" />}
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--color-primary)" }}>{file ? file.name : "Subir contenido"}</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>{formData.category === "Fanfics" ? "Portada (Opcional pero recomendada)" : `2. Portada (Solo Imagen) ${file?.type?.includes('image') ? ' (Opcional)' : '*'}`}</label>
                    <div style={dropzoneStyle(!!thumbFile, "var(--state-info-bg)")}>
                      <input type="file" accept="image/*" onChange={e => setThumbFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="thumb-file" />
                      <label htmlFor="thumb-file" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                        {thumbFile ? <CheckCircle2 color="var(--state-info-fg)" /> : <ImagePlus color="var(--state-info-fg)" />}
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--state-info-fg)" }}>{thumbFile ? thumbFile.name : "Subir portada (JPG/PNG)"}</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "15px", backgroundColor: formData.is_nsfw ? "var(--bg-soft)" : "transparent", borderRadius: "12px", border: formData.is_nsfw ? "1px solid var(--color-border)" : "1px solid transparent", transition: "0.2s" }}>
                <input type="checkbox" checked={formData.is_nsfw} onChange={e => setFormData({...formData, is_nsfw: e.target.checked})} style={{ width: "20px", height: "20px", accentColor: "var(--color-primary)" }} />
                <span style={{ fontSize: "14px", color: "var(--color-primary)", fontWeight: 800 }}>🔞 Marcar como Contenido +18</span>
              </label>

              <button type="submit" disabled={loading} style={{ background: "var(--color-primary)", color: "var(--bg-card)", border: "none", padding: "20px", borderRadius: "15px", fontWeight: 900, fontSize: "16px", cursor: loading ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "10px", boxShadow: "0 10px 20px var(--shadow-card)" }}>
                {loading ? <Loader2 className="spinner" /> : "PUBLICAR EN LA GALERÍA"}
              </button>
            </form>
          )}

          {/* PESTAÑA 2: GESTIÓN DE USUARIOS */}
          {activeTab === "usuarios" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", borderBottom: "2px dashed var(--color-border)", paddingBottom: "15px" }}>
                <Users color="var(--color-primary)" size={28} />
                <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Administración de Cuentas</h2>
              </div>

              {usersOverviewError && (
                <p style={{ margin: 0, color: "var(--state-danger-fg)", fontSize: "13px", fontWeight: 800 }}>{usersOverviewError}</p>
              )}

              {!usersListOpen ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 700, margin: 0 }}>Resumen de altas, bajas y cuentas pendientes de confirmar. Entra en cada tipo para ver el listado y actuar.</p>
                    <button
                      type="button"
                      onClick={() => void cargarResumenUsuarios()}
                      disabled={usersOverviewLoading}
                      style={{ background: "var(--bg-main)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 12px", borderRadius: "10px", cursor: usersOverviewLoading ? "wait" : "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {usersOverviewLoading ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                      Actualizar
                    </button>
                  </div>

                  <div style={{ background: "var(--bg-main)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "18px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "12px" }}>Distribución de cuentas</div>
                    {(() => {
                      const bars = [
                        { id: "alta" as AdminUsersFilter, label: "Alta", count: usersSummary.alta, color: "var(--state-success-fg)" },
                        { id: "pendiente" as AdminUsersFilter, label: "Pendiente", count: usersSummary.pendiente, color: "var(--state-warning-fg)" },
                        { id: "restringido" as AdminUsersFilter, label: "Restringidos", count: usersSummary.restringido, color: "var(--state-danger-fg)" },
                        { id: "baja" as AdminUsersFilter, label: "Baja", count: usersSummary.baja, color: "var(--text-muted)" },
                      ];
                      const max = Math.max(1, ...bars.map((b) => b.count));
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {bars.map((b) => (
                            <button key={b.id} type="button" onClick={() => openUsersList(b.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 800, color: "var(--text-main)", marginBottom: "4px" }}>
                                <span>{b.label}</span>
                                <span style={{ color: b.color }}>{b.count}</span>
                              </div>
                              <div style={{ height: "10px", borderRadius: "99px", background: "var(--bg-soft)", overflow: "hidden" }}>
                                <div style={{ width: `${Math.round((b.count / max) * 100)}%`, height: "100%", background: b.color, borderRadius: "99px" }} />
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    {[
                      { id: "todos" as AdminUsersFilter, label: "Total", count: usersSummary.total, hint: "Todas las cuentas" },
                      { id: "alta" as AdminUsersFilter, label: "Dados de alta", count: usersSummary.alta, hint: "Email confirmado y activos" },
                      { id: "pendiente" as AdminUsersFilter, label: "Pendientes", count: usersSummary.pendiente, hint: "Sin confirmar el email" },
                      { id: "baja" as AdminUsersFilter, label: "Dados de baja", count: usersSummary.baja, hint: "Eliminados o suspendidos" },
                      { id: "restringido" as AdminUsersFilter, label: "Restringidos", count: usersSummary.restringido, hint: "Cuentas con sanción" },
                      { id: "premium" as AdminUsersFilter, label: "Premium", count: usersSummary.premium, hint: "Plan de pago" },
                      { id: "artista" as AdminUsersFilter, label: "Artistas", count: usersSummary.artistas, hint: "Verificados" },
                      { id: "sin_perfil" as AdminUsersFilter, label: "Sin perfil", count: usersSummary.sinPerfil, hint: "Alta incompleta" },
                    ].map((card) => (
                      <div key={card.id} style={{ background: "var(--bg-main)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{card.label}</div>
                        <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--color-primary)", lineHeight: 1 }}>{usersOverviewLoading && usersOverview.length === 0 ? "…" : card.count}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>{card.hint}</div>
                        <button type="button" onClick={() => openUsersList(card.id)} style={{ marginTop: "auto", background: "var(--color-primary)", color: "var(--bg-card)", border: "none", borderRadius: "10px", padding: "8px 10px", cursor: "pointer", fontWeight: 900, fontSize: "12px" }}>
                          Ver listado
                        </button>
                      </div>
                    ))}
                  </div>
                  <input
                    style={{ ...inputStyle, padding: "14px 16px", fontSize: "15px" }}
                    placeholder="Buscar un usuario para abrir su ficha con acciones..."
                    value={usersOverviewSearch}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUsersOverviewSearch(v);
                      if (v.trim().length >= 2) openUsersList("todos");
                    }}
                  />
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => { setUsersListOpen(false); setUsersOverviewSearch(""); setOpenUserActionsId(null); }}
                      style={{ background: "var(--bg-main)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 12px", borderRadius: "10px", cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <ChevronLeft size={16} /> Volver al resumen
                    </button>
                    <button
                      type="button"
                      onClick={() => void cargarResumenUsuarios()}
                      disabled={usersOverviewLoading}
                      style={{ background: "var(--bg-main)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 12px", borderRadius: "10px", cursor: usersOverviewLoading ? "wait" : "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {usersOverviewLoading ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                      Actualizar
                    </button>
                  </div>
                  <h3 style={{ margin: 0, color: "var(--color-primary)", fontSize: "18px", fontWeight: 900 }}>
                    {usersFilterTitle[usersOverviewFilter]} ({usersOverviewFiltered.length})
                  </h3>
                  <input
                    style={{ ...inputStyle, padding: "14px 16px", fontSize: "15px" }}
                    placeholder="Filtra este listado por nombre, email o id..."
                    value={usersOverviewSearch}
                    onChange={(e) => setUsersOverviewSearch(e.target.value)}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {([
                      ["todos", "Todos"],
                      ["alta", "Alta"],
                      ["pendiente", "Pendientes"],
                      ["baja", "Baja"],
                      ["restringido", "Restringidos"],
                      ["premium", "Premium"],
                      ["artista", "Artistas"],
                      ["sin_perfil", "Sin perfil"],
                    ] as Array<[AdminUsersFilter, string]>).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setUsersOverviewFilter(id)}
                        style={{
                          border: "1px solid var(--color-border)",
                          background: usersOverviewFilter === id ? "var(--color-primary)" : "var(--bg-main)",
                          color: usersOverviewFilter === id ? "var(--bg-card)" : "var(--color-primary)",
                          borderRadius: "999px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ border: "1px solid var(--color-border)", borderRadius: "16px", overflow: "hidden", background: "var(--bg-card)" }}>
                    {usersOverviewLoading && usersOverview.length === 0 ? (
                      <div style={{ padding: "20px", color: "var(--text-muted)", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                        <Loader2 size={14} className="spinner" /> Cargando usuarios...
                      </div>
                    ) : usersOverviewFiltered.length === 0 ? (
                      <div style={{ padding: "20px", color: "var(--text-muted)", fontWeight: 800 }}>No hay usuarios en este grupo.</div>
                    ) : (
                      usersOverviewFiltered.map((u) => renderAdminUserCard(u))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA SOLICITUDES */}
          {activeTab === "solicitudes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Bandeja de Solicitudes</h2>
              <AdminQueueFilters
                queue="solicitud"
                status={solFiltroStatus}
                gestor={solFiltroGestor}
                userQuery={solFiltroUser}
                onStatus={setSolFiltroStatus}
                onGestor={setSolFiltroGestor}
                onUserQuery={setSolFiltroUser}
                events={historyOf(solicitudes.map((sol) => ({ label: sol.nombre || "Solicitud", state: caseOf("solicitud", sol.id) })))}
              />
              
              {solicitudes.length === 0 ? <p style={{color: "var(--text-muted)", fontWeight: 700}}>No hay solicitudes.</p> : 
                solicitudes.filter((sol) => caseMatchesFilters(caseOf("solicitud", sol.id), solFiltroStatus, solFiltroGestor, solFiltroUser, `${sol.nombre || ""} ${sol.email || ""}`)).length === 0 ? <p style={{color: "var(--text-muted)", fontWeight: 700}}>Nada con estos filtros.</p> :
                solicitudes.filter((sol) => caseMatchesFilters(caseOf("solicitud", sol.id), solFiltroStatus, solFiltroGestor, solFiltroUser, `${sol.nombre || ""} ${sol.email || ""}`)).map(sol => {
                  const rawText = sol.comentarios || "";
                  const links = rawText.match(/(https?:\/\/[^\s"]+)/g) || [];
                  const adjuntos = (Array.from(new Set(links)) as string[]).filter((l: string) => !l.includes('ui-avatars'));
                  const textoLimpio = rawText.replace(/(https?:\/\/[^\s"']+)/g, '').replace(/URLs del portfolio:/gi, '').trim();

                  return (
                    <div key={sol.id} style={{ border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", background: "var(--bg-main)", boxShadow: "0 4px 12px var(--shadow-card)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px" }}>
                        <div>
                          <p style={{margin: "0 0 8px 0", fontSize: "15px"}}><strong>Nombre:</strong> {sol.nombre}</p>
                          <p style={{margin: "0 0 8px 0", fontSize: "14px"}}><strong>Email:</strong> {sol.email}</p>
                          <p style={{margin: "0 0 8px 0", fontSize: "14px"}}><strong>Redes:</strong> {sol.redes}</p>
                          <p style={{margin: "15px 0 5px 0", fontSize: "13px", color: "var(--color-primary)", fontWeight: 800}}>MENSAJE DEL ARTISTA:</p>
                          <p style={{margin: 0, whiteSpace: "pre-wrap", fontSize: "14px", color: "var(--text-main)", lineHeight: "1.5"}}>{textoLimpio || "[Sin mensaje]"}</p>
                        </div>
                        <div>
                          <p style={{margin: "0 0 10px 0", fontSize: "13px", color: "var(--color-primary)", fontWeight: 800}}>ARCHIVOS ADJUNTOS ({adjuntos.length}):</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {adjuntos.length > 0 ? (
                              <button onClick={(e) => { e.preventDefault(); openVisor(adjuntos); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "10px 15px", background: "var(--color-primary)", color: "var(--bg-card)", border: "none", borderRadius: "12px", fontWeight: 900, fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 12px var(--shadow-card)" }}>
                                <FilePlus size={16} /> VER ADJUNTOS EN GALERÍA
                              </button>
                            ) : (
                              <div style={{ padding: "15px", background: "var(--bg-soft)", borderRadius: "12px", textAlign: "center" }}><p style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 700, margin: 0 }}>No hay archivos.</p></div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ marginTop: "16px" }}>
                        <AdminQueueBar
                          queue="solicitud"
                          state={caseOf("solicitud", sol.id)}
                          busy={queueBusy === queueKey("solicitud", sol.id)}
                          onPatch={(patch, action, detail) => void saveQueueCase("solicitud", sol.id, patch, action, detail)}
                        />
                      </div>
                      <div style={{ marginTop: "16px", paddingTop: "15px", borderTop: "1px dashed var(--color-border)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button onClick={(e) => aprobarArtista(sol.user_id, sol.nombre, false, e, sol.id)} style={{ background: "var(--color-primary)", color: "var(--bg-card)", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>Aprobar como Artista</button>
                        <button type="button" onClick={() => openPublishFor(sol.user_id, sol.nombre || "")} style={{ background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-primary)", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>Publicar su obra</button>
                        <button onClick={() => void saveQueueCase("solicitud", sol.id, { status: "denegada", leido: true }, "estado", "Denegada")} style={{ background: "transparent", color: "var(--text-main)", border: "1px solid var(--text-main)", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>Denegar</button>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          )}

          {/* PESTAÑA DENUNCIAS */}
          {activeTab === "denuncias" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ color: "var(--color-primary)", margin: "0 0 20px 0", fontSize: "20px", fontWeight: 900 }}>Bandeja de Moderación</h2>

{/* CONTENEDOR DE FILTROS ALINEADOS A LA IZQUIERDA */}
<div style={{ display: "flex", flexDirection: "row", gap: "15px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "25px" }}>
  
  {/* FILTRO DE CATEGORÍA (ESTILO PÍLDORA MORADA) */}
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <span style={{ fontWeight: 900, fontSize: "11px", color: "var(--color-primary)", textTransform: "uppercase", marginLeft: "10px" }}>Categoría</span>
    <div style={{ 
      display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-soft)", 
      padding: "8px 16px", borderRadius: "99px", border: "1px solid var(--color-border)" 
    }}>
      <ListFilter size={18} color="var(--color-primary)" />
      <select 
        value={filtroDenuncia} 
        onChange={(e) => setFiltroDenuncia(e.target.value)} 
        style={{ border: "none", background: "transparent", outline: "none", color: "var(--color-primary)", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}
      >
        <option value="all">📁 Todas las denuncias</option>
        <option value="comentario">💬 Comentarios</option>
        <option value="obra">🎨 Obras / Publicaciones</option>
        <option value="abuso">🛡️ Reporte de Abuso General</option>
      </select>
    </div>
  </div>

  <AdminQueueFilters
    queue="denuncia"
    status={filtroEstado}
    gestor={denFiltroGestor}
    userQuery={denFiltroUser}
    onStatus={setFiltroEstado}
    onGestor={setDenFiltroGestor}
    onUserQuery={setDenFiltroUser}
    events={historyOf(denuncias.map((d) => ({ label: d.motivo?.slice?.(0, 42) || "Denuncia", state: caseOf("denuncia", d.id, d.estado) })))}
  />
</div>
</div>

              {selectedDenuncias.size > 0 && (
                <div style={{ display: "flex", gap: "10px", background: "var(--bg-soft)", padding: "10px 15px", borderRadius: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)" }}>{selectedDenuncias.size} seleccionadas</span>
                  <button onClick={eliminarDenunciasMasivas} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--text-main)", padding: "6px 12px", borderRadius: "8px", fontWeight: 900, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Trash2 size={14} /> Eliminar Seleccionadas
                  </button>
                </div>
              )}

              {loadingDenuncias ? (
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", gap: "10px" }}>
  <Loader2 className="spinner" size={32} color="var(--color-primary)" />
  <span style={{ color: "var(--color-primary)", fontWeight: 800 }}>{t('common.loading')}</span>
</div>              ) : (
                (() => {
                  const denunciasClasificadas = denuncias.map(d => {
                    const raw = JSON.stringify(d).toLowerCase();
                    let categoria = "Reporte de Abuso";
                    let filterKey = "abuso";

                    if (raw.includes("comentario") || raw.includes("muro artista")) { 
                      categoria = "Denuncia de Comentario"; filterKey = "comentario"; 
                    } else if (raw.includes("publicación") || raw.includes("obra") || d.item_id) { 
                      categoria = "Denuncia de Obra"; filterKey = "obra"; 
                    }
                    
                    return { ...d, categoria, filterKey };
                  });

                  const filtradasPorCat = filtroDenuncia === "all" ? denunciasClasificadas : denunciasClasificadas.filter(d => d.filterKey === filtroDenuncia);
                  const filtradas = filtradasPorCat.filter((d) => caseMatchesFilters(
                    caseOf("denuncia", d.id, d.estado),
                    filtroEstado,
                    denFiltroGestor,
                    denFiltroUser,
                    `${d.denunciante?.display_name || ""} ${d.denunciado?.display_name || ""} ${d.motivo || ""}`,
                  ));

                  if (filtradas.length === 0) return <p style={{color: "var(--text-muted)", fontWeight: 700, textAlign: "center", padding: "20px", background: "var(--bg-card)", borderRadius: "16px", border: "1px dashed var(--color-border)"}}>No hay reportes con estos filtros.</p>;

                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 5px" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedDenuncias.size === filtradas.length && filtradas.length > 0} 
                          onChange={(e) => handleSelectAllDenuncias(e.target.checked, filtradas)} 
                          style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", cursor: "pointer" }} 
                        />
                        <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--color-primary)" }}>Seleccionar todas</span>
                      </div>

                      {filtradas.map((d) => {
                        const caso = caseOf("denuncia", d.id, d.estado);
                        return (
                        <div key={d.id} style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--color-border)", padding: "15px 20px", borderRadius: "16px", background: selectedDenuncias.has(d.id) ? "var(--bg-soft)" : "var(--bg-card)", transition: "0.2s" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                            <input 
                              type="checkbox" 
                              checked={selectedDenuncias.has(d.id)} 
                              onChange={(e) => {
                                const next = new Set(selectedDenuncias);
                                if (e.target.checked) next.add(d.id); else next.delete(d.id);
                                setSelectedDenuncias(next);
                              }} 
                              style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", cursor: "pointer" }} 
                            />
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                                <ShieldAlert size={18} color="var(--color-primary)" />
                                <span style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "16px" }}>{d.categoria}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold" }}>{new Date(d.created_at).toLocaleDateString()}</span>
                                <span style={{ 
                                  padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase",
                               background: d.estado === 'completada'? "var(--state-success-bg)": d.estado === 'en_investigacion'? "var(--state-warning-bg)": d.estado === 'revisar_reactivacion' ? "var(--state-info-bg)" : "var(--bg-soft)",
 color: d.estado === 'completada' ? "var(--state-success-fg)" : d.estado === 'en_investigacion'? "var(--state-warning-fg)": d.estado === 'revisar_reactivacion' ? "var(--state-info-fg)" : "var(--color-primary)"
                                }}>
                                  {statusLabel(caso.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button onClick={() => {
   setSelectedDenuncia({ ...d, estado: caso.status });
   router.push(`/admin-panel?tab=denuncias&reopen=${d.id}`);
}}
style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 900, fontSize: "13px" }}>
                              Revisar
                            </button>
                            <button onClick={() => resolverDenuncia(d.id)} style={{ background: "transparent", color: "var(--text-main)", border: "none", padding: "8px", cursor: "pointer" }} title="Eliminar/Archivar">
                              <Trash2 size={20} />
                            </button>
                          </div>
                          </div>
                          <AdminQueueBar
                            queue="denuncia"
                            state={caso}
                            busy={queueBusy === queueKey("denuncia", d.id)}
                            onPatch={(patch, action, detail) => void saveQueueCase("denuncia", d.id, patch, action, detail, d.estado)}
                          />
                        </div>
                        );
                      })}
                    </>
                  );
                })()
              )}
            </div>
          )}

         {/* PESTAÑA: BUZÓN DE COLABORACIONES */}
          {activeTab === "buzon" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Buzón de Colaboraciones</h2>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: "12px", color: "var(--color-primary)" }}>ESTADO:</span>
                  {["todos", "pendiente", "gestionando", "cerrado"].map(est => (
                    <button key={est} onClick={() => setFiltroEstadoBuzon(est)} style={{ padding: "6px 12px", borderRadius: "99px", border: "1px solid var(--color-border)", fontSize: "11px", fontWeight: 800, cursor: "pointer", background: filtroEstadoBuzon === est ? "var(--color-primary)" : "var(--bg-card)", color: filtroEstadoBuzon === est ? "var(--bg-card)" : "var(--color-primary)", textTransform: "uppercase", transition: "0.2s" }}>
                      {est}
                    </button>
                  ))}
                </div>
              </div>

              {selectedBuzonIds.size > 0 && (
                <div style={{ display: "flex", gap: "10px", background: "var(--bg-soft)", padding: "10px 15px", borderRadius: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)" }}>{selectedBuzonIds.size} seleccionados</span>
                  <button onClick={eliminarBuzonMasivo} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--text-main)", padding: "6px 12px", borderRadius: "8px", fontWeight: 900, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              )}
              
              {!selectedBuzon ? (
                (() => {
                  const filtrados = filtroEstadoBuzon === "todos" ? buzon : buzon.filter(b => (b.status || 'pendiente') === filtroEstadoBuzon);
                  if (filtrados.length === 0) return <p style={{color: "var(--text-muted)", fontWeight: 700, textAlign: "center", padding: "20px", background: "var(--bg-card)", borderRadius: "16px", border: "1px dashed var(--color-border)"}}>Bandeja limpia.</p>;
                  
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 5px" }}>
                        <input type="checkbox" checked={selectedBuzonIds.size === filtrados.length} onChange={(e) => setSelectedBuzonIds(e.target.checked ? new Set(filtrados.map(f => f.id)) : new Set())} style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--color-primary)" }}>Seleccionar todos</span>
                      </div>
                      
                      {filtrados.map((b) => {
                        return (
                          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-border)", padding: "15px 20px", borderRadius: "16px", background: selectedBuzonIds.has(b.id) ? "var(--bg-soft)" : "var(--bg-card)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                              <input type="checkbox" checked={selectedBuzonIds.has(b.id)} onChange={(e) => { const next = new Set(selectedBuzonIds); e.target.checked ? next.add(b.id) : next.delete(b.id); setSelectedBuzonIds(next); }} style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", cursor: "pointer" }} />
                              <MailOpen size={18} color="var(--color-primary)" />
                              <div>
                                <span style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "16px" }}>{b.asunto}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold" }}>De: {b.userName || "Usuario Anónimo"}</span>
                                  <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", background: b.status === 'cerrado' ? "var(--state-success-bg)" : b.status === 'gestionando' ? "var(--state-warning-bg)" : "var(--bg-soft)", color: b.status === 'cerrado' ? "var(--state-success-fg)" : b.status === 'gestionando' ? "var(--state-warning-fg)" : "var(--color-primary)" }}>{b.status || 'pendiente'}</span>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => {
  setSelectedBuzon(b);
  router.push(`/admin-panel?tab=buzon&buzonId=${b.id}`);
}} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 900, fontSize: "13px" }}>Abrir Hilo</button>
                          </div>
                        );
                      })}
                    </>
                  );
                })()
              ) : (
                <div style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                  <button onClick={() => {
  setSelectedBuzon(null);
  router.push(`/admin-panel?tab=buzon`);
}}style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer", marginBottom: "15px", display: "flex", alignItems: "center", gap: "5px" }}><ChevronLeft size={16}/> Volver al Buzón</button>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: "0 0 5px 0", color: "var(--text-main)" }}>{selectedBuzon.asunto}</h3>
                      <p style={{ fontSize: "13px", color: "var(--color-primary)", fontWeight: 800, margin: "0 0 15px 0" }}>
                        Usuario Registrado:{" "}
                        <span 
                          onClick={() => router.push(`/me?u=${selectedBuzon.user_id}&fromAdmin=true`)}
                          style={{ textDecoration: "underline", cursor: "pointer", color: "var(--text-main)" }}
                        >
                          @{selectedBuzon.userName || "Anónimo"}
                        </span> <br/>
                        Email de Contacto: {selectedBuzon.email}
                      </p>
                    </div>
                    <select value={selectedBuzon.status || 'pendiente'} onChange={async (e) => {
                      const st = e.target.value;
                      setSelectedBuzon({...selectedBuzon, status: st});
                      setBuzon(prev => prev.map(x => x.id === selectedBuzon.id ? {...x, status: st} : x));
                      await supabase.from('buzon_colaboraciones').update({status: st}).eq('id', selectedBuzon.id);
                    }} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", outline: "none", fontWeight: 900, color: "var(--color-primary)", cursor: "pointer" }}>
                      <option value="pendiente">Pendiente</option>
                      <option value="gestionando">Gestionando</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ background: "var(--bg-main)", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)", fontSize: "14px", lineHeight: "1.5" }}>
                      <strong style={{ color: "var(--text-main)", fontSize: "12px", display: "block", marginBottom: "5px" }}>MENSAJE ORIGINAL DEL USUARIO:</strong>
                      {selectedBuzon.mensaje}
                     {selectedBuzon.adjuntos && (
  <div style={{ marginTop: "10px", padding: "15px", background: "var(--bg-soft)", borderRadius: "8px", border: "1px dashed var(--color-border)" }}>
    <strong style={{ fontSize: "11px", color: "var(--color-primary)", display: "block", marginBottom: "5px" }}>🔍 INSPECCIÓN DE SEGURIDAD (URL):</strong>
    <code style={{ fontSize: "12px", color: "var(--text-main)", wordBreak: "break-all", display: "block", marginBottom: "10px", background: "var(--color-border)", padding: "5px", borderRadius: "4px" }}>
      {selectedBuzon.adjuntos} 
    </code>
    <a href={selectedBuzon.adjuntos} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--color-primary)", color: "var(--bg-card)", padding: "10px 20px", borderRadius: "10px", fontWeight: 900, textDecoration: "none", fontSize: "13px" }}>
      <ExternalLink size={16} /> Abrir enlace verificado
    </a>
  </div>
)}
                      
                    </div>
                    {(selectedBuzon.respuestas || []).map((r: any, i: number) => (
                      <div key={i} style={{ background: "var(--bg-soft)", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)", marginLeft: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                          <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 900 }}>{r.admin} (Equipo MKB)</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>{r.fecha}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-main)", whiteSpace: "pre-wrap" }}>{r.texto}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "15px" }}>
                    <textarea rows={3} placeholder="Añade una respuesta o nota interna al hilo..." value={respuestaBuzon} onChange={(e) => setRespuestaBuzon(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", marginBottom: "10px" }} />
                    <button onClick={enviarRespuestaWeb} style={{ background: "var(--color-primary)", color: "var(--bg-card)", padding: "10px 20px", borderRadius: "10px", fontWeight: 900, cursor: "pointer", border: "none" }}>Guardar Respuesta en Hilo</button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* PESTAÑA: GESTIÓN DE NUEVAS PCs */}
          {activeTab === "aportaciones" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Mejoras de Photocards</h2>
              </div>
              <AdminQueueFilters
                queue="aportacion"
                status={filtroEstadoAportaciones}
                gestor={apoFiltroGestor}
                userQuery={apoFiltroUser}
                onStatus={setFiltroEstadoAportaciones}
                onGestor={setApoFiltroGestor}
                onUserQuery={setApoFiltroUser}
                events={historyOf(aportaciones.map((a) => ({ label: `PC #${a.item_id}`, state: caseOf("aportacion", a.id, a.status) })))}
              />

              {selectedAportacionIds.size > 0 && (
                <div style={{ display: "flex", gap: "10px", background: "var(--bg-soft)", padding: "10px 15px", borderRadius: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)" }}>{selectedAportacionIds.size} seleccionadas</span>
                  <button onClick={eliminarAportacionesMasivas} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--text-main)", padding: "6px 12px", borderRadius: "8px", fontWeight: 900, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              )}

              {!selectedAportacion ? (
                (() => {
                  const filtrados = aportaciones.filter((a) => caseMatchesFilters(
                    caseOf("aportacion", a.id, a.status),
                    filtroEstadoAportaciones,
                    apoFiltroGestor,
                    apoFiltroUser,
                    `${a.userName || ""} ${a.item_id || ""}`,
                  ));
                  if (filtrados.length === 0) return <p style={{color: "var(--text-muted)", fontWeight: 700, textAlign: "center", padding: "20px", background: "var(--bg-card)", borderRadius: "16px", border: "1px dashed var(--color-border)"}}>Bandeja limpia.</p>;
                  
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 5px" }}>
                        <input type="checkbox" checked={selectedAportacionIds.size === filtrados.length} onChange={(e) => setSelectedAportacionIds(e.target.checked ? new Set(filtrados.map(f => f.id)) : new Set())} style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--color-primary)" }}>Seleccionar todas</span>
                      </div>

                      {filtrados.map((a) => {
                        const caso = caseOf("aportacion", a.id, a.status);
                        return (
                        <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--color-border)", padding: "15px 20px", borderRadius: "16px", background: selectedAportacionIds.has(a.id) ? "var(--bg-soft)" : "var(--bg-card)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                            <input type="checkbox" checked={selectedAportacionIds.has(a.id)} onChange={(e) => { const next = new Set(selectedAportacionIds); e.target.checked ? next.add(a.id) : next.delete(a.id); setSelectedAportacionIds(next); }} style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", cursor: "pointer" }} />
                            <ImagePlus size={18} color="var(--color-primary)" />
                            <div>
                              <span style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "16px" }}>Mejora para Photocard #{a.item_id} ({a.face})</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold" }}>Por: {a.userName || "Usuario Anónimo"}</span>
                                <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", background: caso.status === "aprobada" ? "var(--state-success-bg)" : caso.status === "denegada" ? "var(--bg-soft)" : "var(--state-warning-bg)", color: caso.status === "aprobada" ? "var(--state-success-fg)" : "var(--color-primary)" }}>{statusLabel(caso.status)}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => {
  setSelectedAportacion(a);
  router.push(`/admin-panel?tab=aportaciones&aportacionId=${a.id}`);
}}style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 900, fontSize: "13px" }}>Revisar</button>
                          </div>
                          <AdminQueueBar
                            queue="aportacion"
                            state={caso}
                            busy={queueBusy === queueKey("aportacion", a.id)}
                            onPatch={(patch, action, detail) => void saveQueueCase("aportacion", a.id, patch, action, detail, a.status)}
                          />
                        </div>
                        );
                      })}
                    </>
                  );
                })()
              ) : (
                <div style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                     <button onClick={() => {
  setSelectedAportacion(null);
  router.push(`/admin-panel?tab=aportaciones`);
}}style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}><ChevronLeft size={16}/> Volver a la lista</button>
                     
                     <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-muted)" }}>
                       Aportado por:{" "}
                       <span 
                         onClick={() => router.push(`/me?u=${selectedAportacion.user_id}&fromAdmin=true`)} 
                         style={{ color: "var(--color-primary)", textDecoration: "underline", cursor: "pointer" }}
                         title="Ir al perfil para dar K-oins"
                       >
                         @{selectedAportacion.userName || "Anónimo"}
                       </span>
                     </span>
                   </div>
                   
                   <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center", justifyContent: "center", background: "var(--bg-main)", padding: "20px", borderRadius: "12px" }}>
                     <img src={selectedAportacion.image_url} style={{ height: "250px", borderRadius: "10px", boxShadow: "0 10px 20px var(--overlay-faint)" }} alt="Nueva" />
                     
                     <button 
  onClick={async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(selectedAportacion.image_url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `PC-${selectedAportacion.item_id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      setSelectedAportacion(null); // Cierra y vuelve atrás
    } catch (err) {
      window.open(selectedAportacion.image_url, '_blank');
    }
  }}
  style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--color-primary)", color: "var(--bg-card)", padding: "10px 20px", borderRadius: "10px", fontWeight: 900, border: "none", cursor: "pointer", fontSize: "13px", boxShadow: "0 4px 10px var(--shadow-card)" }}
>
  <Download size={16} /> Descargar y Volver
</button>
  </div>
                   
                   <div style={{ borderTop: "1px dashed var(--color-border)", paddingTop: "15px", marginTop: "15px" }}>
                    <AdminQueueBar
                      queue="aportacion"
                      state={caseOf("aportacion", selectedAportacion.id, selectedAportacion.status)}
                      busy={queueBusy === queueKey("aportacion", selectedAportacion.id)}
                      onPatch={(patch, action, detail) => void saveQueueCase("aportacion", selectedAportacion.id, patch, action, detail, selectedAportacion.status)}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", marginTop: "20px" }}>
                    {(selectedAportacion.respuestas || []).map((r: any, i: number) => (
                      <div key={i} style={{ background: "var(--bg-soft)", padding: "15px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                          <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 900 }}>{r.admin} (Equipo MKB)</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>{r.fecha}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-main)", whiteSpace: "pre-wrap" }}>{r.texto}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "15px" }}>
                    <textarea rows={3} placeholder="Añade una nota interna sobre esta aportación (ej: 'Le pedí otra foto por correo')..." value={respuestaAportacion} onChange={(e) => setRespuestaAportacion(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", resize: "none", marginBottom: "10px" }} />
                    <button onClick={enviarRespuestaAportacion} style={{ background: "var(--color-primary)", color: "var(--bg-card)", padding: "10px 20px", borderRadius: "10px", fontWeight: 900, cursor: "pointer", border: "none" }}>Guardar Nota Interna</button>
                  </div>

                </div>
              )}
            </div>
          )}

          {activeTab === "publicidad" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", borderBottom: "2px dashed var(--color-border)", paddingBottom: "15px" }}>
                <Sparkles color="var(--color-primary)" size={28} />
                <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Campañas de Publicidad</h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px" }}>
                <input style={inputStyle} placeholder="Titulo del anuncio*" value={adForm.title} onChange={(e) => setAdForm((p) => ({ ...p, title: e.target.value }))} />
                <input style={inputStyle} placeholder="Subtitulo" value={adForm.subtitle} onChange={(e) => setAdForm((p) => ({ ...p, subtitle: e.target.value }))} />
                <input style={inputStyle} placeholder="URL destino*" value={adForm.target_url} onChange={(e) => setAdForm((p) => ({ ...p, target_url: e.target.value }))} />
                <input style={inputStyle} placeholder="URL imagen (opcional)" value={adForm.image_url} onChange={(e) => setAdForm((p) => ({ ...p, image_url: e.target.value }))} />
                <select style={inputStyle} value={adForm.placement} onChange={(e) => setAdForm((p) => ({ ...p, placement: e.target.value as AdPlacement }))}>
                  <option value="sidebar_left">Sidebar izquierda</option>
                  <option value="sidebar_right">Sidebar derecha</option>
                  <option value="tablet_sidebar">Tablet inline</option>
                  <option value="mobile_inline_top">Movil inline superior</option>
                  <option value="mobile_inline_bottom">Movil inline inferior</option>
                </select>
                <select style={inputStyle} value={adForm.device} onChange={(e) => setAdForm((p) => ({ ...p, device: e.target.value as AdDevice }))}>
                  <option value="desktop">Desktop</option>
                  <option value="tablet">Tablet</option>
                  <option value="mobile">Movil</option>
                </select>
                <input style={inputStyle} placeholder="Seccion (all, market, fanart...)" value={adForm.section} onChange={(e) => setAdForm((p) => ({ ...p, section: e.target.value }))} />
                <input style={inputStyle} type="number" placeholder="Prioridad" value={adForm.priority} onChange={(e) => setAdForm((p) => ({ ...p, priority: Number(e.target.value || 0) }))} />
                <input style={inputStyle} type="datetime-local" value={adForm.start_at} onChange={(e) => setAdForm((p) => ({ ...p, start_at: e.target.value }))} />
                <input style={inputStyle} type="datetime-local" value={adForm.end_at} onChange={(e) => setAdForm((p) => ({ ...p, end_at: e.target.value }))} />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "var(--color-primary)" }}>
                <input type="checkbox" checked={adForm.active} onChange={(e) => setAdForm((p) => ({ ...p, active: e.target.checked }))} />
                Campaña activa
              </label>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button onClick={saveAdCampaign} disabled={loading} style={{ background: "var(--color-primary)", color: "var(--bg-card)", border: "none", padding: "12px 20px", borderRadius: "10px", fontWeight: 900, cursor: "pointer" }}>
                  {loading ? "Guardando..." : adForm.id ? "Guardar cambios" : "Crear campaña"}
                </button>
                <button onClick={resetAdForm} style={{ background: "var(--bg-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "12px 20px", borderRadius: "10px", fontWeight: 900, cursor: "pointer" }}>
                  Limpiar formulario
                </button>
                <button onClick={fetchAdCampaigns} style={{ background: "var(--bg-card)", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "12px 20px", borderRadius: "10px", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <RefreshCw size={16} /> Recargar campañas
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                {adCampaigns.map((ad) => (
                  <div key={ad.id} style={{ border: "1px solid var(--color-border)", borderRadius: 14, padding: "12px", background: "var(--bg-main)", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: "var(--color-primary)" }}>{ad.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {ad.device} · {ad.placement} · {ad.section || "all"} · prioridad {ad.priority} · {ad.active ? "activa" : "pausada"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => editAdCampaign(ad)} style={{ border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--color-primary)", borderRadius: 10, padding: "8px 10px", fontWeight: 900, cursor: "pointer" }}>Editar</button>
                      <button onClick={() => deleteAdCampaign(ad.id)} style={{ border: "1px solid var(--state-danger-border)", background: "var(--state-danger-bg)", color: "var(--state-danger-fg)", borderRadius: 10, padding: "8px 10px", fontWeight: 900, cursor: "pointer" }}>Eliminar</button>
                    </div>
                  </div>
                ))}
                {!adCampaigns.length && (
                  <div style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 14 }}>No hay campañas creadas todavía.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "catalogo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "2px dashed var(--color-border)", paddingBottom: "15px", flexWrap: "wrap" }}>
                <Tags color="var(--color-primary)" size={28} />
                <h2 style={{ color: "var(--color-primary)", margin: 0, fontSize: "20px", fontWeight: 900 }}>Grupos y miembros</h2>
                <button
                  type="button"
                  onClick={() => void loadCatalog()}
                  disabled={catalogLoading}
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--bg-soft)",
                    color: "var(--color-primary)",
                    border: "1px solid var(--color-border)",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    fontWeight: 900,
                    cursor: catalogLoading ? "wait" : "pointer",
                  }}
                >
                  <RefreshCw size={16} /> Recargar
                </button>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.55 }}>
                Lo que pongas en nombre e imágenes es lo que verán los usuarios en el alta y en el perfil. El slug es solo para uso interno (opcional).
              </p>
              <details style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                <summary style={{ cursor: "pointer", color: "var(--color-primary)", fontWeight: 800 }}>
                  Primera vez: Storage y slugs en Supabase
                </summary>
                <p style={{ margin: "10px 0 0 0", lineHeight: 1.5 }}>
                  Para que la subida de archivos funcione, en Supabase (SQL Editor) ejecuta{" "}
                  <code style={{ fontSize: 11 }}>scripts/create-catalog-storage-bucket.sql</code>. Si quieres columna{" "}
                  <code style={{ fontSize: 11 }}>slug</code> en tablas, usa{" "}
                  <code style={{ fontSize: 11 }}>scripts/add-catalog-slug-columns.sql</code>.
                </p>
              </details>

              {catalogLoading && catalogGroups.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 className="spinner" size={36} color="var(--color-primary)" />
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px", alignItems: "start" }}>
                    <div style={{ border: "1px solid var(--color-border)", borderRadius: 16, padding: 18, background: "var(--bg-main)" }}>
                      <h3 style={{ margin: "0 0 14px 0", color: "var(--color-primary)", fontWeight: 900, fontSize: 16 }}>Grupo</h3>
                      <label style={labelStyle}>Nombre (visible)</label>
                      <input
                        style={inputStyle}
                        value={catalogGroupForm.name}
                        onChange={(e) => setCatalogGroupForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Ej: Stray Kids"
                      />
                      <label style={{ ...labelStyle, marginTop: 12 }}>Slug interno (opcional)</label>
                      <input
                        style={inputStyle}
                        value={catalogGroupForm.slug}
                        onChange={(e) => setCatalogGroupForm((p) => ({ ...p, slug: e.target.value }))}
                        placeholder="stray-kids"
                      />
                      <label style={{ ...labelStyle, marginTop: 12 }}>Logo (pega una URL o elige un archivo)</label>
                      <input
                        style={inputStyle}
                        value={catalogGroupForm.logo_url}
                        onChange={(e) => setCatalogGroupForm((p) => ({ ...p, logo_url: e.target.value }))}
                        placeholder="https://… o /groups/…"
                      />
                      <input
                        ref={catalogGroupLogoFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        tabIndex={-1}
                        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          try {
                            setLoading(true);
                            const url = await uploadCatalogAsset(f, "group");
                            setCatalogGroupForm((p) => ({ ...p, logo_url: url }));
                            showAlert("Catálogo", "Imagen subida. Pulsa «Guardar en base de datos» para guardar el grupo.");
                          } catch (err: any) {
                            showAlert("Catálogo", err?.message || "Error al subir.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => catalogGroupLogoFileRef.current?.click()}
                        style={{
                          marginTop: 10,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          background: "var(--bg-soft)",
                          color: "var(--color-primary)",
                          border: "1px solid var(--color-border)",
                          padding: "10px 16px",
                          borderRadius: "10px",
                          fontWeight: 900,
                          fontSize: 13,
                          cursor: loading ? "wait" : "pointer",
                        }}
                      >
                        <ImagePlus size={18} /> Elegir imagen en el ordenador
                      </button>
                      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void saveCatalogGroup()}
                          style={{
                            background: "var(--color-primary)",
                            color: "var(--bg-card)",
                            border: "none",
                            padding: "10px 18px",
                            borderRadius: "10px",
                            fontWeight: 900,
                            cursor: loading ? "wait" : "pointer",
                          }}
                        >
                          Guardar en base de datos
                        </button>
                        <button
                          type="button"
                          title="Vacía solo este formulario. No borra grupos ya guardados."
                          onClick={() => setCatalogGroupForm({ id: null, name: "", slug: "", logo_url: "" })}
                          style={{
                            background: "var(--bg-soft)",
                            color: "var(--color-primary)",
                            border: "1px solid var(--color-border)",
                            padding: "10px 18px",
                            borderRadius: "10px",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Limpiar formulario
                        </button>
                      </div>
                      <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.4 }}>
                        «Guardar» escribe en Supabase. «Limpiar» solo borra lo que has escrito aquí para empezar otro grupo (no toca la lista de abajo hasta que borres desde la lista).
                      </p>
                    </div>

                    <div style={{ border: "1px solid var(--color-border)", borderRadius: 16, padding: 18, background: "var(--bg-main)" }}>
                      <h3 style={{ margin: "0 0 14px 0", color: "var(--color-primary)", fontWeight: 900, fontSize: 16 }}>Miembro</h3>
                      <label style={labelStyle}>Grupo</label>
                      <select
                        style={inputStyle}
                        value={catalogMemberForm.group_id ?? ""}
                        onChange={(e) =>
                          setCatalogMemberForm((p) => ({
                            ...p,
                            group_id: e.target.value ? parseInt(e.target.value, 10) : null,
                          }))
                        }
                      >
                        <option value="">— Elige grupo —</option>
                        {catalogGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} (id {g.id})
                          </option>
                        ))}
                      </select>
                      <label style={{ ...labelStyle, marginTop: 12 }}>Nombre (visible)</label>
                      <input
                        style={inputStyle}
                        value={catalogMemberForm.name}
                        onChange={(e) => setCatalogMemberForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Ej: Bang Chan"
                      />
                      <label style={{ ...labelStyle, marginTop: 12 }}>Slug interno (opcional)</label>
                      <input
                        style={inputStyle}
                        value={catalogMemberForm.slug}
                        onChange={(e) => setCatalogMemberForm((p) => ({ ...p, slug: e.target.value }))}
                        placeholder="bang-chan"
                      />
                      <label style={{ ...labelStyle, marginTop: 12 }}>Foto (pega una URL o elige un archivo)</label>
                      <input
                        style={inputStyle}
                        value={catalogMemberForm.image_url}
                        onChange={(e) => setCatalogMemberForm((p) => ({ ...p, image_url: e.target.value }))}
                        placeholder="https://… o /members/…"
                      />
                      <input
                        ref={catalogMemberPhotoFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        tabIndex={-1}
                        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          try {
                            setLoading(true);
                            const url = await uploadCatalogAsset(f, "member");
                            setCatalogMemberForm((p) => ({ ...p, image_url: url }));
                            showAlert("Catálogo", "Imagen subida. Pulsa «Guardar en base de datos» para guardar el miembro.");
                          } catch (err: any) {
                            showAlert("Catálogo", err?.message || "Error al subir.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => catalogMemberPhotoFileRef.current?.click()}
                        style={{
                          marginTop: 10,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          background: "var(--bg-soft)",
                          color: "var(--color-primary)",
                          border: "1px solid var(--color-border)",
                          padding: "10px 16px",
                          borderRadius: "10px",
                          fontWeight: 900,
                          fontSize: 13,
                          cursor: loading ? "wait" : "pointer",
                        }}
                      >
                        <ImagePlus size={18} /> Elegir imagen en el ordenador
                      </button>
                      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void saveCatalogMember()}
                          style={{
                            background: "var(--color-primary)",
                            color: "var(--bg-card)",
                            border: "none",
                            padding: "10px 18px",
                            borderRadius: "10px",
                            fontWeight: 900,
                            cursor: loading ? "wait" : "pointer",
                          }}
                        >
                          Guardar en base de datos
                        </button>
                        <button
                          type="button"
                          title="Vacía solo este formulario. No borra miembros ya guardados."
                          onClick={() =>
                            setCatalogMemberForm((p) => ({
                              id: null,
                              group_id: p.group_id,
                              name: "",
                              slug: "",
                              image_url: "",
                            }))
                          }
                          style={{
                            background: "var(--bg-soft)",
                            color: "var(--color-primary)",
                            border: "1px solid var(--color-border)",
                            padding: "10px 18px",
                            borderRadius: "10px",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Limpiar formulario
                        </button>
                      </div>
                      <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.4 }}>
                        «Guardar» escribe en Supabase. «Limpiar» solo vacía nombre, slug y foto para dar de alta otro miembro del mismo grupo (no borra filas de la lista hasta que uses Borrar).
                      </p>
                    </div>
                  </div>

                  <div style={{ border: "1px solid var(--color-border)", borderRadius: 16, padding: 16, background: "var(--bg-main)" }}>
                    <h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)", fontWeight: 900, fontSize: 15 }}>Lista de grupos</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                      {catalogGroups.map((g) => (
                        <div
                          key={g.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid var(--color-border)",
                            background: "var(--bg-card)",
                          }}
                        >
                          {g.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={g.logo_url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-soft)" }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: 14 }}>{g.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                              id {g.id}
                              {g.slug ? ` · slug ${g.slug}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCatalogGroupForm({
                                id: Number(g.id),
                                name: String(g.name || ""),
                                slug: g.slug != null ? String(g.slug) : "",
                                logo_url: g.logo_url != null ? String(g.logo_url) : "",
                              })
                            }
                            style={{
                              border: "1px solid var(--color-border)",
                              background: "var(--bg-soft)",
                              color: "var(--color-primary)",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontWeight: 900,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                title: "Borrar grupo",
                                message: `Se borrarán también todos los miembros del grupo «${g.name}». ¿Continuar?`,
                                onConfirm: async () => {
                                  setLoading(true);
                                  try {
                                    const h = await catalogAuthHeaders();
                                    const res = await fetch("/api/admin/catalog", {
                                      method: "POST",
                                      headers: { ...h, "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "delete_group", id: g.id }),
                                    });
                                    const json = (await res.json().catch(() => ({}))) as { error?: string };
                                    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
                                    showAlert("Catálogo", "Grupo eliminado.");
                                    if (catalogGroupForm.id === Number(g.id)) {
                                      setCatalogGroupForm({ id: null, name: "", slug: "", logo_url: "" });
                                    }
                                    await loadCatalog();
                                  } catch (err: any) {
                                    showAlert("Catálogo", err?.message || "Error al borrar.");
                                  } finally {
                                    setLoading(false);
                                  }
                                },
                              });
                            }}
                            style={{
                              border: "1px solid var(--state-danger-border)",
                              background: "var(--state-danger-bg)",
                              color: "var(--state-danger-fg)",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontWeight: 900,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Borrar
                          </button>
                        </div>
                      ))}
                      {!catalogGroups.length && (
                        <p style={{ color: "var(--text-muted)", fontWeight: 700, margin: 0 }}>No hay grupos.</p>
                      )}
                    </div>
                  </div>

                  <div style={{ border: "1px solid var(--color-border)", borderRadius: 16, padding: 16, background: "var(--bg-main)" }}>
                    <h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)", fontWeight: 900, fontSize: 15 }}>Miembros</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                      {catalogMembers.map((m) => {
                        const mid = Number(m.member_id ?? m.id);
                        const gid = m.group_id != null ? Number(m.group_id) : NaN;
                        const gname = catalogGroups.find((x) => Number(x.id) === gid)?.name ?? `Grupo ${gid}`;
                        return (
                          <div
                            key={String(m.member_id ?? m.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid var(--color-border)",
                              background: "var(--bg-card)",
                            }}
                          >
                            {m.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.image_url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-soft)" }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: 14 }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                {gname} · bias id {mid}
                                {m.slug ? ` · slug ${m.slug}` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCatalogMemberForm({
                                  id: mid,
                                  group_id: Number.isFinite(gid) ? gid : null,
                                  name: String(m.name || ""),
                                  slug: m.slug != null ? String(m.slug) : "",
                                  image_url: m.image_url != null ? String(m.image_url) : "",
                                })
                              }
                              style={{
                                border: "1px solid var(--color-border)",
                                background: "var(--bg-soft)",
                                color: "var(--color-primary)",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontWeight: 900,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDialog({
                                  title: "Borrar miembro",
                                  message: `¿Eliminar a «${m.name}» del catálogo? Los biases de usuario pueden quedar huérfanos.`,
                                  onConfirm: async () => {
                                    setLoading(true);
                                    try {
                                      const h = await catalogAuthHeaders();
                                      const res = await fetch("/api/admin/catalog", {
                                        method: "POST",
                                        headers: { ...h, "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "delete_member", id: mid }),
                                      });
                                      const json = (await res.json().catch(() => ({}))) as { error?: string };
                                      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
                                      showAlert("Catálogo", "Miembro eliminado.");
                                      if (catalogMemberForm.id === mid) {
                                        setCatalogMemberForm((p) => ({
                                          id: null,
                                          group_id: p.group_id,
                                          name: "",
                                          slug: "",
                                          image_url: "",
                                        }));
                                      }
                                      await loadCatalog();
                                    } catch (err: any) {
                                      showAlert("Catálogo", err?.message || "Error al borrar.");
                                    } finally {
                                      setLoading(false);
                                    }
                                  },
                                });
                              }}
                              style={{
                                border: "1px solid var(--state-danger-border)",
                                background: "var(--state-danger-bg)",
                                color: "var(--state-danger-fg)",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontWeight: 900,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              Borrar
                            </button>
                          </div>
                        );
                      })}
                      {!catalogMembers.length && (
                        <p style={{ color: "var(--text-muted)", fontWeight: 700, margin: 0 }}>No hay miembros.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PESTAÑA 5: MANUAL INTERACTIVO */}
          {activeTab === "manual" && (
            <AdminManual />
          )}


        </div>
        {/* MODAL VISOR DE ARCHIVOS PAGINADO */}
        {previewUrls.length > 0 && (
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--overlay-heavy)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
            onClick={() => setPreviewUrls([])}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              
              <button onClick={() => setPreviewUrls([])} style={{ position: 'absolute', top: '20px', right: '20px', background: 'color-mix(in srgb, var(--bg-card) 20%, transparent)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                <X size={24} />
              </button>

              {previewUrls.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(prev => prev === 0 ? previewUrls.length - 1 : prev - 1); }} style={{ position: 'absolute', left: '20px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                  <ChevronLeft size={30} />
                </button>
              )}

              {previewUrls[previewIndex].match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img src={previewUrls[previewIndex]} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px' }} alt={`Adjunto ${previewIndex + 1}`} />
              ) : (
                <iframe src={previewUrls[previewIndex]} style={{ width: '100%', height: '85vh', border: 'none', borderRadius: '12px', background: 'white' }} />
              )}

              {previewUrls.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(prev => (prev + 1) % previewUrls.length); }} style={{ position: 'absolute', right: '20px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                  <ChevronRight size={30} />
                </button>
              )}

              {previewUrls.length > 1 && (
                <div style={{ position: 'absolute', bottom: '20px', background: 'var(--overlay-medium)', color: 'white', padding: '8px 16px', borderRadius: '99px', fontSize: '14px', fontWeight: 900 }}>
                  {previewIndex + 1} / {previewUrls.length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL DE RESOLUCIÓN DE DENUNCIAS */}
        {selectedDenuncia && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--overlay-strong)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={() => { setSelectedDenuncia(null); router.push(`/admin-panel?tab=denuncias`); }}>
            <div style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', background: 'var(--bg-main)', borderRadius: '24px', padding: '30px', overflowY: 'auto', border: '1px solid var(--color-border)', boxShadow: '0 20px 50px var(--overlay-soft)', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setSelectedDenuncia(null); router.push(`/admin-panel?tab=denuncias`); }} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--color-primary)" /></button>
              
              {/* CABECERA */}
              <div style={{ 
  display: "flex", 
  gap: "12px", 
  marginTop: "20px", 
  padding: "15px", 
  borderTop: "1px solid var(--color-border)",
  justifyContent: "center" 
}}>
  <button
    onClick={() => {
      const idx = denuncias.findIndex(d => d.id === selectedDenuncia.id);
      if (idx > 0) {
        const prevD = denuncias[idx - 1];
        setSelectedDenuncia(prevD);
        router.push(`/admin-panel?tab=denuncias&reopen=${prevD.id}`);
      }
    }}
    disabled={denuncias.findIndex(d => d.id === selectedDenuncia.id) <= 0}
    style={{ 
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      background: "var(--text-main)", 
      color: "var(--bg-card)", 
      border: "none",
      borderRadius: "12px", 
      padding: "12px 20px", 
      cursor: "pointer", 
      fontWeight: 700, 
      fontSize: "14px",
      opacity: denuncias.findIndex(d => d.id === selectedDenuncia.id) <= 0 ? 0.3 : 1,
      transition: "all 0.2s"
    }}
  >
    <ChevronLeft size={18} /> <span>Anterior</span>
  </button>

  <button
    onClick={() => {
      const idx = denuncias.findIndex(d => d.id === selectedDenuncia.id);
      if (idx >= 0 && idx < denuncias.length - 1) {
        const nextD = denuncias[idx + 1];
        setSelectedDenuncia(nextD);
        router.push(`/admin-panel?tab=denuncias&reopen=${nextD.id}`);
      }
    }}
    disabled={denuncias.findIndex(d => d.id === selectedDenuncia.id) >= denuncias.length - 1}
    style={{ 
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      background: "var(--text-main)", 
      color: "var(--bg-card)", 
      border: "none",
      borderRadius: "12px", 
      padding: "12px 20px", 
      cursor: "pointer", 
      fontWeight: 700, 
      fontSize: "14px",
      opacity: denuncias.findIndex(d => d.id === selectedDenuncia.id) >= denuncias.length - 1 ? 0.3 : 1,
      transition: "all 0.2s"
    }}
  >
    <span>Siguiente</span> <ChevronRight size={18} />
  </button>


              </div>

             <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
            
            {/* --- COLUMNA 1: DENUNCIANTE --- */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ background: "var(--bg-card)", padding: "15px", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                <p style={{ margin: "0 0 10px 0", fontSize: "11px", color: "var(--text-muted)", fontWeight: 900, textTransform: "uppercase" }}> Reportado por:</p>
                <div
                 onClick={() => selectedDenuncia.denunciante?.user_id && router.push(`/me?u=${selectedDenuncia.denunciante.user_id}&fromAdmin=true&reopen=${selectedDenuncia.id}`)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "var(--bg-main)", padding: "8px 15px", borderRadius: "99px", border: "2px solid var(--color-border)", cursor: "pointer", width: "100%", boxSizing: "border-box" }}
                >
                  <img src={selectedDenuncia.denunciante?.avatar_url || DEFAULT_AVATAR} style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover" }} alt="" />
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    @{selectedDenuncia.denunciante?.display_name || "Anónimo"}
                  </span>
                </div>
              </div>

            {/* CONTROLES DE K-OINS DENUNCIANTE */}
            {selectedDenuncia.denunciante && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--bg-main)", padding: "6px 12px", borderRadius: "10px", border: "1px solid var(--color-border)", justifyContent: "center", width: "fit-content", margin: "0 auto" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: "11px", fontWeight: 900, color: "var(--color-primary)", marginRight: "2px" }}>K-OINS:</span>
                
                {/* Botón -5 */}
                <button onClick={(e) => { updatePuntos(selectedDenuncia.denunciante.user_id, selectedDenuncia.denunciante.display_name, selectedDenuncia.denunciante.puntos, -5, e); setSelectedDenuncia((prev:any) => ({...prev, denunciante: {...prev.denunciante, puntos: (prev.denunciante.puntos||0)-5}})); }} style={{ background: "var(--bg-soft)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "var(--color-primary)", fontWeight: "bold", fontSize: "11px" }}>-5</button>
                
                {/* Input Text */}
                <input
                  id={`pts-denunciante-${selectedDenuncia.id}`}
                  defaultValue={selectedDenuncia.denunciante.puntos || 0}
                  style={{ width: "45px", textAlign: "center", fontWeight: 900, color: "var(--text-main)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px", fontSize: "13px", outline: "none", background: "var(--bg-card)" }}
                />
                
                {/* Botón +5 */}
                <button onClick={(e) => { updatePuntos(selectedDenuncia.denunciante.user_id, selectedDenuncia.denunciante.display_name, selectedDenuncia.denunciante.puntos, 5, e); setSelectedDenuncia((prev:any) => ({...prev, denunciante: {...prev.denunciante, puntos: (prev.denunciante.puntos||0)+5}})); }} style={{ background: "var(--state-success-bg)", border: "1px solid var(--state-success-border)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "var(--state-success-fg)", fontWeight: "bold", fontSize: "11px" }}>+5</button>
                
                {/* Botón Guardar (Icono) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const val = (document.getElementById(`pts-denunciante-${selectedDenuncia.id}`) as HTMLInputElement).value;
                    const exact = parseInt(val || "0");
                    updatePuntosExact(selectedDenuncia.denunciante.user_id, selectedDenuncia.denunciante.display_name, exact, e);
                    setSelectedDenuncia((prev:any) => ({...prev, denunciante: {...prev.denunciante, puntos: exact}}));
                  }}
                  title="Guardar K-oins exactos"
                  style={{ background: "var(--color-primary)", color: "var(--bg-card)", border: "none", borderRadius: "6px", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px var(--overlay-faint)" }}
                >
                  <Save size={14} />
                </button>
              </div>
            )}
            </div>

           {/* --- COLUMNA 2: DENUNCIADO --- */}
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
  <div style={{ background: "var(--bg-card)", padding: "15px", borderRadius: "16px", border: "1px dashed var(--text-main)" }}>
    <p style={{ margin: "0 0 10px 0", fontSize: "11px", color: "var(--text-main)", fontWeight: 900, textTransform: "uppercase" }}> Perfil Denunciado:</p>
    {selectedDenuncia.denunciado ? (
      <div
        onClick={() => {
          // Usamos una pequeña comprobación por si el campo se llama 'id' o 'user_id'
          const targetId = selectedDenuncia.denunciado.user_id || selectedDenuncia.denunciado.id;
          router.push(`/me?u=${targetId}&fromAdmin=true&reopen=${selectedDenuncia.id}`);
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "var(--bg-main)", padding: "8px 15px", borderRadius: "99px", border: "2px solid var(--color-border)", cursor: "pointer", width: "100%", boxSizing: "border-box" }}
      >
        <img src={selectedDenuncia.denunciado.avatar_url || DEFAULT_AVATAR} style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover" }} alt="" />
        <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          @{selectedDenuncia.denunciado.display_name}
        </span>
      </div>
    ) : (
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>Perfil no registrado</span>
    )}
  </div>



             {/* CONTROLES DE K-OINS DENUNCIADO */}
              {selectedDenuncia.denunciado && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--bg-main)", padding: "6px 12px", borderRadius: "10px", border: "1px solid var(--color-border)", justifyContent: "center", width: "fit-content", margin: "0 auto" }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontSize: "11px", fontWeight: 900, color: "var(--color-primary)", marginRight: "2px" }}>K-OINS:</span>
                  
                  {/* Botón -5 */}
                  <button onClick={(e) => { updatePuntos(selectedDenuncia.denunciado.user_id, selectedDenuncia.denunciado.display_name, selectedDenuncia.denunciado.puntos, -5, e); setSelectedDenuncia((prev:any) => ({...prev, denunciado: {...prev.denunciado, puntos: (prev.denunciado.puntos||0)-5}})); }} style={{ background: "var(--bg-soft)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "var(--color-primary)", fontWeight: "bold", fontSize: "11px" }}>-5</button>
                  
                  {/* Input Text */}
                  <input
                    id={`pts-denunciado-${selectedDenuncia.id}`}
                    defaultValue={selectedDenuncia.denunciado.puntos || 0}
                    style={{ width: "45px", textAlign: "center", fontWeight: 900, color: "var(--text-main)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px", fontSize: "13px", outline: "none", background: "var(--bg-card)" }}
                  />
                  
                  {/* Botón +5 */}
                  <button onClick={(e) => { updatePuntos(selectedDenuncia.denunciado.user_id, selectedDenuncia.denunciado.display_name, selectedDenuncia.denunciado.puntos, 5, e); setSelectedDenuncia((prev:any) => ({...prev, denunciado: {...prev.denunciado, puntos: (prev.denunciado.puntos||0)+5}})); }} style={{ background: "var(--state-success-bg)", border: "1px solid var(--state-success-border)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "var(--state-success-fg)", fontWeight: "bold", fontSize: "11px" }}>+5</button>
                  
                  {/* Botón Guardar (Icono) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const val = (document.getElementById(`pts-denunciado-${selectedDenuncia.id}`) as HTMLInputElement).value;
                      const exact = parseInt(val || "0");
                      updatePuntosExact(selectedDenuncia.denunciado.user_id, selectedDenuncia.denunciado.display_name, exact, e);
                      setSelectedDenuncia((prev:any) => ({...prev, denunciado: {...prev.denunciado, puntos: exact}}));
                    }}
                    title="Guardar K-oins exactos"
                    style={{ background: "var(--color-primary)", color: "var(--bg-card)", border: "none", borderRadius: "6px", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px var(--overlay-faint)" }}
                  >
                    <Save size={14} />
                  </button>
                </div>
              )}
            </div>

          </div>

            {/* ASIGNADOR DE ESTADO (MANDO DE CONTROL REAL) */}
<div style={{ position: 'relative', width: '100%', gridColumn: "1 / -1", marginTop: '15px' }}>
  <span style={{ fontWeight: 900, fontSize: "11px", color: "var(--color-primary)", textTransform: "uppercase", display: "block", marginBottom: "8px", marginLeft: "10px" }}>
    Asignar Estado a esta Denuncia
  </span>
  
  <div 
    onClick={() => setMenuEstadoDenuncia(!menuEstadoDenuncia)}
    style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: "10px", 
      background: "var(--bg-soft)", 
      padding: "10px 18px", 
      borderRadius: "99px", 
      border: "1px solid var(--color-border)",
      cursor: "pointer",
      justifyContent: "space-between"
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary)", fontWeight: 800, fontSize: "13px" }}>
      <span>{statusLabel(caseOf("denuncia", selectedDenuncia.id, selectedDenuncia.estado).status)}</span>
    </div>
    <ChevronDown size={14} color="var(--color-primary)" style={{ transform: menuEstadoDenuncia ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
  </div>

  {/* MENÚ DESPLEGABLE DE ACCIÓN */}
  {menuEstadoDenuncia && (
    <div style={{ 
      position: 'absolute', top: '110%', left: 0, zIndex: 1000, 
      background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '18px', 
      boxShadow: '0 10px 25px var(--shadow-card)', padding: '8px', width: '100%' 
    }}>
      {[
        { id: 'pendiente', label: 'Pendiente', icon: <AlertTriangle size={16} />, color: "var(--state-warning-fg)" },
        { id: 'en_proceso', label: 'En proceso', icon: <RefreshCw size={16} />, color: "var(--color-primary)" },
        { id: 'en_investigacion', label: 'En investigación', icon: <Search size={16} />, color: "var(--state-info-border)" },
        { id: 'revisar_reactivacion', label: 'Revisar reactivación', icon: <RefreshCw size={16} />, color: "var(--text-muted)" },
        { id: 'aprobada', label: 'Aprobada', icon: <CheckCircle2 size={16} />, color: "var(--state-success-border)" },
        { id: 'denegada', label: 'Denegada', icon: <AlertTriangle size={16} />, color: "var(--state-danger-fg)" },
        { id: 'completada', label: 'Completada', icon: <CheckCircle2 size={16} />, color: "var(--state-success-border)" }
      ].map((opt) => (
        <div
          key={opt.id}
          onClick={() => {
            setMenuEstadoDenuncia(false);
            void saveQueueCase("denuncia", selectedDenuncia.id, { status: opt.id as QueueCase["status"] }, "estado", opt.label, selectedDenuncia.estado);
          }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', 
            borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
            color: selectedDenuncia.estado === opt.id ? 'var(--bg-card)' : 'var(--text-muted)',
            background: selectedDenuncia.estado === opt.id ? 'var(--color-primary)' : 'transparent',
            transition: '0.2s'
          }}
        >
          <span style={{ color: selectedDenuncia.estado === opt.id ? 'var(--bg-card)' : opt.color }}>{opt.icon}</span>
          {opt.label}
        </div>
      ))}
    </div>
  )}
</div>
<div style={{ marginTop: 12 }}>
  <AdminQueueBar
    queue="denuncia"
    state={caseOf("denuncia", selectedDenuncia.id, selectedDenuncia.estado)}
    busy={queueBusy === queueKey("denuncia", selectedDenuncia.id)}
    onPatch={(patch, action, detail) => void saveQueueCase("denuncia", selectedDenuncia.id, patch, action, detail, selectedDenuncia.estado)}
  />
</div>

             {/* NUEVA LÓGICA DE RUTEO INTELIGENTE (PARA FANART, MURO Y FANZONE) */}
              {(() => {
                const motivoText = selectedDenuncia.motivo || "";
                const linkMatch = motivoText.match(/https?:\/\/(?:www\.)?mykpopbinder\.com([^\s"'\\]+)/);
                let targetUrl = "";

                if (linkMatch) {
                  // Si el motivo incluye un enlace a nuestra propia web (ej. Fanzone, Muro de alguien, etc)
                  try {
                    const urlObj = new URL(linkMatch[0]);
                    urlObj.searchParams.set('fromAdmin', 'true');
                    urlObj.searchParams.set('reopen', selectedDenuncia.id);
                    targetUrl = urlObj.pathname + urlObj.search + urlObj.hash;
                  } catch (e) {
                    targetUrl = "";
                  }
                } else if (selectedDenuncia.fanart_id) {
                  // Lógica para fanarts antiguos
                  const commentMatch = motivoText.match(/\[Comentario: (.*?)\]/);
                  const commentId = commentMatch ? commentMatch[1] : null;
                  targetUrl = `/fanart?admin=true&fromAdmin=true&reopen=${selectedDenuncia.id}&denunciaId=${selectedDenuncia.id}${commentId ? `&highlight=${commentId}` : ''}`;
                  sessionStorage.setItem("open_fanart_id", selectedDenuncia.fanart_id);
                } else if (motivoText.includes(" [Muro Artista")) {
                  // Lógica para el muro de artista antiguo
                  const commentMatch = motivoText.match(/Mensaje: (.*?)]/);
                  const commentId = commentMatch ? commentMatch[1] : null;
                  targetUrl = `/artista-del-mes?admin=true&fromAdmin=true&reopen=${selectedDenuncia.id}&denunciaId=${selectedDenuncia.id}${commentId ? `&highlight=${commentId}` : ''}`;
                }

                if (!targetUrl) return null;

                return (
                  <div style={{ marginBottom: "25px" }}>
                    <button
                      onClick={() => router.push(targetUrl)}
                      style={{ width: "100%", background: "var(--color-primary)", color: "var(--bg-card)", border: "none", padding: "14px", borderRadius: "15px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent)" }}
                    >
                      <ExternalLink size={18} />
                      IR DIRECTAMENTE A LA PUBLICACIÓN DENUNCIADA
                    </button>
                  </div>
                );
              })()}

          {/* DATOS LIMPIOS DE LA DENUNCIA */}
<div style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "16px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
  
  <p style={{ margin: "0 0 15px 0", fontSize: "12px", color: "var(--color-primary)", fontWeight: 900, textTransform: "uppercase", borderBottom: "1px dashed var(--color-border)", paddingBottom: "10px" }}>
    DATOS DEL EXPEDIENTE (REF: #{selectedDenuncia.id.toString().slice(0, 5)})
  </p>

  <p style={{ margin: "0 0 5px 0", fontSize: "11px", color: "var(--text-muted)", fontWeight: 900, textTransform: "uppercase" }}>
    Motivo de la denuncia:
  </p>
  <p style={{ margin: "0", fontSize: "14px", color: "var(--text-main)", fontWeight: 600, whiteSpace: "pre-wrap" }}>
    {(() => {
      // Cogemos el texto original de la base de datos
      const textoOriginal = selectedDenuncia.motivo || "";
      // Le pasamos la tijera para quitar la URL y la palabra "Enlace:"
      const textoLimpio = textoOriginal
        .replace(/(https?:\/\/[^\s"']+)/g, '') 
        .replace(/Enlace:/gi, '') 
        .trim();
      
      return textoLimpio || "Sin descripción adicional.";
    })()}
  </p>

</div>

              {/* ARCHIVOS ADJUNTOS (SÓLO IMÁGENES O ENLACES EXTERNOS) */}
              {(() => {
                const links = (selectedDenuncia.motivo || "").match(/https?:\/\/[^\s"'\\]+/g) || [];
                // Filtramos para NO meter aquí enlaces de nuestra propia web (que ya abrimos en el botón principal)
                const adj = Array.from(new Set(links)).filter(url => !String(url).includes('mykpopbinder.com')) as string[];
                
                if (adj.length === 0) return null;
                
                return (
                  <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "15px" }}>
                    <button onClick={() => openVisor(adj)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", background: "var(--color-primary)", color: "var(--bg-card)", border: "none", borderRadius: "12px", fontWeight: 900, fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 10px var(--shadow-card)" }}>
                      <FilePlus size={18} /> VER PRUEBAS ADJUNTAS ({adj.length})
                    </button>
                  </div>
                );
              })()}
{/* NUEVO BOTÓN PARA VER EL PERFIL CON MEMORIA DE DENUNCIA */}
<div style={{ marginBottom: "20px" }}>
  <button onClick={() => {
    // 1. Buscamos el ID del malo en todos los sitios posibles para no fallar
    const maloId = selectedDenuncia.denunciado?.user_id 
                || selectedDenuncia.denunciado?.id 
                || selectedDenuncia.reported_user_id 
                || selectedDenuncia.target_id;
                
    if (!maloId) return alert("No se encontró el ID del usuario.");
    
    // 2. 🔥 EL ARREGLO: Usamos u=maloId (no id=) y le pasamos el reopen
    router.push(`/me?u=${maloId}&fromAdmin=true&reopen=${selectedDenuncia.id}`);
    
  }} style={{ width: "100%", background: "var(--text-main)", color: "var(--bg-card)", border: "none", padding: "12px", borderRadius: "10px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
    <UserX size={16} /> VER PERFIL DEL DENUNCIADO
  </button>
</div>

           {/* ACCIONES DE MODERACIÓN PARA EL DENUNCIADO */}
{selectedDenuncia.denunciado && (
  <div style={{ background: "var(--bg-soft)", padding: "15px", borderRadius: "16px", border: "1px dashed var(--color-primary)", marginBottom: "20px" }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
      
    {/* --- INICIO DE LA NUEVA CAJA DE ACCIONES --- */}
<div style={{ 
  display: "grid", 
  gridTemplateColumns: "repeat(4, 1fr)", 
  gap: "10px", 
  marginTop: "15px",
  alignItems: "stretch" 
}}>
  
  {/* 1. +1 STRIKE */}
  <button onClick={(e) => openStrikeModal(selectedDenuncia.denunciado, e, selectedDenuncia.id)} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
    <ShieldAlert size={14} color="var(--color-border)" /> +1 STR ({selectedDenuncia.denunciado.strikes || 0}/3)
  </button>

  {/* 2. SANCIONAR */}
  <button onClick={() => setSuspenderModal({ user_id: selectedDenuncia.reported_user_id, display_name: selectedDenuncia.denunciado.display_name })} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "13px" }}>
    Sancionar
  </button>

  {/* 3. +AÑO (O Quitar Premium) */}
  {selectedDenuncia.denunciado.is_premium ? (
    <button onClick={async (e) => { await togglePremium(selectedDenuncia.denunciado, 'free', e); actualizarUsuarioEnTodasPartes(selectedDenuncia.denunciado.user_id, { is_premium: false, plan_type: 'free' }); }} style={{ background: "var(--bg-card)", color: "var(--state-warning-fg)", border: "1px solid var(--state-warning-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "12px" }}>
      QUITAR ({selectedDenuncia.denunciado.plan_type === 'anual' ? 'A' : 'M'})
    </button>
  ) : (
    <button onClick={async (e) => { await togglePremium(selectedDenuncia.denunciado, 'anual', e); actualizarUsuarioEnTodasPartes(selectedDenuncia.denunciado.user_id, { is_premium: true, plan_type: 'anual' }); }} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "13px" }}>
      +AÑO
    </button>
  )}

  {/* 4. +ARTISTA */}
  <button onClick={async (e) => { await toggleStatus(selectedDenuncia.denunciado.user_id, selectedDenuncia.denunciado.display_name, 'is_artist', selectedDenuncia.denunciado.is_artist, e); actualizarUsuarioEnTodasPartes(selectedDenuncia.denunciado.user_id, { is_artist: !selectedDenuncia.denunciado.is_artist }); }} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
    <Star size={14} color="var(--color-border)" /> +ART
  </button>

  {/* 5. -1 STRIKE y PAPELERA (Comparten celda) */}
  <div style={{ display: "flex", gap: "6px" }}>
    <button onClick={(e) => selectedDenuncia.denunciado.strikes > 0 ? quitarStrike(selectedDenuncia.denunciado, e) : null} style={{ flex: 2, background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: selectedDenuncia.denunciado.strikes > 0 ? "pointer" : "default", fontWeight: 800, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", opacity: selectedDenuncia.denunciado.strikes > 0 ? 1 : 0.4 }}>
      <Undo2 size={14} color="var(--color-border)" /> -1 STR
    </button>
    <button onClick={() => resolverDenuncia(selectedDenuncia.id)} style={{ flex: 1, background: "var(--bg-card)", color: "var(--color-border)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Trash2 size={16} />
    </button>
  </div>

  {/* 6. REACTIVAR (Solo visible si está restringido) */}
  {selectedDenuncia.denunciado?.is_restricted ? (
    <button onClick={() => levantarSancion(selectedDenuncia.reported_user_id, selectedDenuncia.id)} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "13px" }}>
      Reactivar
    </button>
  ) : (
    <div /> 
  )}

  {/* 7. +MES (Solo si no es premium) */}
  {!selectedDenuncia.denunciado.is_premium ? (
    <button onClick={async (e) => { await togglePremium(selectedDenuncia.denunciado, 'mensual', e); actualizarUsuarioEnTodasPartes(selectedDenuncia.denunciado.user_id, { is_premium: true, plan_type: 'mensual' }); }} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "13px" }}>
      +MES
    </button>
  ) : <div />}

  {/* 8. NOTIFICAR */}
  <button onClick={() => setNotificarModal(selectedDenuncia.denunciado)} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontWeight: 800, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
    <Mail size={14} color="var(--color-border)" /> NOTIF
  </button>

</div>
{/* --- FIN DE LA CAJA DE ACCIONES --- */}

{/* === ASEGÚRATE DE TENER ESTOS 3 CIERRES AQUÍ DEBAJO === */}
      </div> 
    </div> 
  )}


             
<div style={{ marginTop: "20px", borderTop: "1px dashed var(--color-border)", paddingTop: "15px" }}>
  <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--color-primary)", fontWeight: 900, textTransform: "uppercase" }}>
    HISTORIAL DE RESOLUCIÓN (Ref: #{selectedDenuncia.id.toString().slice(0, 5)}):
  </p>
  
  {/* Caja con los comentarios acumulados */}
  <div style={{ background: "var(--bg-soft)", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", fontSize: "13px", color: "var(--text-main)", whiteSpace: "pre-wrap", maxHeight: "150px", overflowY: "auto", marginBottom: "10px" }}>
    {selectedDenuncia.notas_admin || "No hay comentarios previos."}
  </div>

  {/* Campo para añadir uno nuevo */}
  <textarea
    id="input-nueva-nota"
    rows={2}
    placeholder="Escribe aquí para añadir un nuevo comentario al historial..."
    style={{ width: "100%", padding: "12px", boxSizing: "border-box", borderRadius: "12px", border: "1px solid var(--color-border)", outline: "none", fontSize: "13px" }}
  />
  <button 
    onClick={() => guardarNotaAdmin(selectedDenuncia.id, (document.getElementById("input-nueva-nota") as HTMLTextAreaElement).value)} 
    style={{ background: "var(--bg-card)", color: "var(--color-primary)", border: "1px solid var(--color-primary)", padding: "6px 16px", borderRadius: "8px", fontWeight: 900, cursor: "pointer", fontSize: "11px", marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}
  >
    <Save size={14} /> AÑADIR COMENTARIO
  </button>
</div>
              {/* RESPUESTAS AL DENUNCIANTE */}
              <div>
                <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "var(--color-primary)", fontWeight: 900 }}>NOTIFICAR AL DENUNCIANTE:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button onClick={() => enviarRespuestaAdmin(selectedDenuncia.reporter_id || selectedDenuncia.user_id, "eliminado", selectedDenuncia.id, selectedDenuncia.fanart_id || selectedDenuncia.item_id)} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "10px", borderRadius: "10px", fontWeight: 800, fontSize: "13px", cursor: "pointer", textAlign: "left" }}>✅ "Hemos suprimido el perfil/contenido"</button>
                  <button onClick={() => enviarRespuestaAdmin(selectedDenuncia.reporter_id || selectedDenuncia.user_id, "no_infringe", selectedDenuncia.id, selectedDenuncia.fanart_id || selectedDenuncia.item_id)} style={{ background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--color-border)", padding: "10px", borderRadius: "10px", fontWeight: 800, fontSize: "13px", cursor: "pointer", textAlign: "left" }}>❌ "No consideramos que sea infracción"</button>
                  <button onClick={() => enviarRespuestaAdmin(selectedDenuncia.reporter_id || selectedDenuncia.user_id, "mas_info", selectedDenuncia.id, selectedDenuncia.fanart_id || selectedDenuncia.item_id)} style={{ background: "var(--bg-card)", color: "var(--color-primary)", border: "1px solid var(--color-primary)", padding: "10px", borderRadius: "10px", fontWeight: 800, fontSize: "13px", cursor: "pointer", textAlign: "left" }}>ℹ️ "Necesitamos más información"</button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VISOR DE PRUEBAS ADJUNTAS */}
        {visorImages.length > 0 && (
          <div onClick={() => setVisorImages([])} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-heavy)", zIndex: 100000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
            <button onClick={(e) => { e.stopPropagation(); setVisorImages([]); }} style={{ position: "absolute", top: "20px", right: "20px", background: "color-mix(in srgb, var(--bg-card) 10%, transparent)", border: "none", color: "var(--bg-card)", borderRadius: "50%", padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb, var(--bg-card) 30%, transparent)"} onMouseLeave={e => e.currentTarget.style.background = "color-mix(in srgb, var(--bg-card) 10%, transparent)"}>
              <X size={28} />
            </button>
            <img src={visorImages[visorIndex]} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: "12px", boxShadow: "0 10px 40px var(--overlay-medium)" }} alt="Prueba adjunta" />
            
            {visorImages.length > 1 && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "25px", background: "color-mix(in srgb, var(--bg-card) 10%, transparent)", padding: "10px 20px", borderRadius: "99px" }}>
                <button onClick={() => setVisorIndex(i => i === 0 ? visorImages.length - 1 : i - 1)} style={{ background: "transparent", border: "none", color: "var(--bg-card)", cursor: "pointer", fontWeight: 900, fontSize: "14px" }}>ANTERIOR</button>
                <span style={{ color: "var(--color-border)", fontWeight: 800, fontSize: "14px" }}>{visorIndex + 1} de {visorImages.length}</span>
                <button onClick={() => setVisorIndex(i => (i + 1) % visorImages.length)} style={{ background: "transparent", border: "none", color: "var(--bg-card)", cursor: "pointer", fontWeight: 900, fontSize: "14px" }}>SIGUIENTE</button>
              </div>
            )}
          </div>
        )}
      {strikeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--overlay-strong)",
            zIndex: 31000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setStrikeModal(null)}
        >
          <div
            style={{
              background: "var(--bg-main)",
              padding: "28px",
              borderRadius: "24px",
              maxWidth: "460px",
              width: "100%",
              border: "2px solid var(--color-border)",
              boxShadow: "0 20px 40px var(--overlay-soft)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 8px 0", fontSize: "22px" }}>
              Strike {(strikeModal.p.strikes || 0) + 1}/3 · @{strikeModal.p.display_name}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600, margin: "0 0 14px 0", lineHeight: 1.45 }}>
              La restricción no es obligatoria en el 1.er o 2.º strike; en el 3.er suele aplicarse salvo que indiques lo contrario.
            </p>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "6px" }}>
              Motivo (visible para el usuario en la notificación)
            </label>
            <textarea
              value={strikeModal.motivo}
              onChange={(e) => setStrikeModal((s) => (s ? { ...s, motivo: e.target.value } : s))}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void ejecutarStrikeModal();
                }
              }}
              rows={4}
              placeholder="Describe la infracción con claridad…"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                outline: "none",
                fontSize: "14px",
                marginBottom: "14px",
                boxSizing: "border-box",
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontWeight: 600,
              }}
            />
            <label style={{ display: "block", fontSize: "12px", fontWeight: 900, color: "var(--color-primary)", marginBottom: "6px" }}>
              Restricción de cuenta
            </label>
            <select
              value={strikeModal.duration}
              onChange={(e) =>
                setStrikeModal((s) =>
                  s ? { ...s, duration: e.target.value as StrikeModalDuration } : s,
                )
              }
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                marginBottom: "10px",
                fontWeight: 700,
                background: "var(--bg-card)",
                color: "var(--text-main)",
              }}
            >
              <option value="no_restrict">Sin restricción (solo registro de strike)</option>
              <option value="indefinite">Restringir hasta levantar manualmente</option>
              <option value="7d">Restringir 7 días</option>
              <option value="30d">Restringir 30 días</option>
              <option value="90d">Restringir 90 días</option>
              <option value="180d">Restringir 6 meses</option>
              <option value="365d">Restringir 1 año</option>
            </select>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 16px 0", fontWeight: 600 }}>
              Clic fuera o Esc cierra · Ctrl+Enter guarda
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setStrikeModal(null)}
                style={{
                  flex: 1,
                  background: "transparent",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-border)",
                  padding: "12px",
                  borderRadius: "99px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void ejecutarStrikeModal()}
                style={{
                  flex: 2,
                  background: "var(--color-primary)",
                  color: "var(--bg-card)",
                  border: "none",
                  padding: "12px",
                  borderRadius: "99px",
                  fontWeight: 900,
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? "Guardando…" : "Registrar strike"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🌟 PRECIOSO MODAL DE CONFIRMACIÓN (REEMPLAZA AL DE NAVEGADOR) 🌟 */}
      {artistWorksModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 19000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setArtistWorksModal(null)}>
          <div style={{ background: "var(--bg-main)", padding: "28px", borderRadius: "24px", maxWidth: "560px", width: "100%", border: "2px solid var(--color-border)", boxShadow: "0 20px 40px var(--overlay-soft)", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 8px 0", fontSize: "24px" }}>Obras de {artistWorksModal.userName}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 600, margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Ya no es artista. Sus obras siguen en la web. Puedes dejarlas, borrarlas todas o marcar solo las que quieres quitar.
            </p>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {artistWorksModal.works.map((work) => (
                <label key={work.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "var(--bg-card)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!artistWorksModal.picked[work.id]}
                    onChange={() => setArtistWorksModal((prev) => prev ? { ...prev, picked: { ...prev.picked, [work.id]: !prev.picked[work.id] } } : prev)}
                  />
                  {work.thumb && <img src={work.thumb} alt="" style={{ width: 36, height: 48, objectFit: "cover", borderRadius: 6 }} />}
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>{work.title}</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>{work.category}</span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setArtistWorksModal(null)} style={{ flex: "1 1 140px", background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}>
                Dejarlas
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids = Object.entries(artistWorksModal.picked).filter(([, on]) => on).map(([id]) => id);
                  if (ids.length === 0) {
                    showAlert("Elige obras", "Marca al menos una obra, o usa Eliminar todas.");
                    return;
                  }
                  const modal = artistWorksModal;
                  setConfirmDialog({
                    title: "Quitar obras",
                    message: `¿Eliminar ${ids.length} obra${ids.length === 1 ? "" : "s"} de ${modal.userName}? No se puede deshacer.`,
                    onConfirm: async () => {
                      setLoading(true);
                      try {
                        await deleteArtistWorks(ids);
                        const left = modal.works.filter((work) => !ids.includes(work.id));
                        if (left.length === 0) setArtistWorksModal(null);
                        else setArtistWorksModal({ ...modal, works: left, picked: Object.fromEntries(left.map((work) => [work.id, false])) });
                        showAlert("Obras eliminadas", `Se han quitado ${ids.length} de la web.`);
                      } catch (err: unknown) {
                        showAlert("Error", err instanceof Error ? err.message : String(err));
                      } finally {
                        setLoading(false);
                      }
                    },
                  });
                }}
                style={{ flex: "1 1 160px", background: "transparent", color: "var(--text-main)", border: "1px solid var(--text-main)", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}
              >
                Eliminar seleccionadas
              </button>
              <button
                type="button"
                onClick={() => {
                  const modal = artistWorksModal;
                  const ids = modal.works.map((work) => work.id);
                  setConfirmDialog({
                    title: "Eliminar todo su arte",
                    message: `¿Eliminar las ${ids.length} obras de ${modal.userName}? No se puede deshacer.`,
                    onConfirm: async () => {
                      setLoading(true);
                      try {
                        await deleteArtistWorks(ids);
                        setArtistWorksModal(null);
                        showAlert("Arte eliminado", `Se ha quitado todo el arte de ${modal.userName}.`);
                      } catch (err: unknown) {
                        showAlert("Error", err instanceof Error ? err.message : String(err));
                      } finally {
                        setLoading(false);
                      }
                    },
                  });
                }}
                style={{ flex: "1 1 160px", background: "var(--state-danger-fg, #b42318)", color: "white", border: "none", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer" }}
              >
                Eliminar todas
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setConfirmDialog(null)}>
          <div style={{ background: "var(--bg-main)", padding: "30px", borderRadius: "24px", maxWidth: "420px", width: "100%", textAlign: "center", border: "2px solid var(--color-border)", boxShadow: "0 20px 40px var(--overlay-soft)" }} onClick={e => e.stopPropagation()}>
            <h3 className="tan-font" style={{ color: "var(--color-primary)", margin: "0 0 15px 0", fontSize: "24px" }}>{confirmDialog.title}</h3>
            <p style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 600, marginBottom: "25px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={() => setConfirmDialog(null)} 
                style={{ flex: 1, background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer", fontSize: "14px" }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  try {
                    await Promise.resolve(fn());
                  } catch (err: any) {
                    showAlert("Error", err?.message || String(err));
                  }
                }} 
                style={{ flex: 1, background: "var(--color-primary)", color: "var(--bg-card)", border: "none", padding: "12px", borderRadius: "99px", fontWeight: 900, cursor: "pointer", fontSize: "14px" }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {notificarModal && (
  <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 30000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setNotificarModal(null)}>
    <div style={{ background: "var(--bg-card)", padding: "25px", borderRadius: "24px", maxWidth: "450px", width: "100%", border: "2px solid var(--state-info-border)" }} onClick={(e) => e.stopPropagation()}>
      <h3 style={{ color: "var(--state-info-fg)", margin: "0 0 15px 0", fontWeight: 900 }}>Notificar a @{notificarModal.display_name}</h3>
      <textarea 
        placeholder="Escribe el motivo de la sanción o advertencia..."
        value={mensajeNotif}
        onChange={(e) => setMensajeNotif(e.target.value)}
        style={{ width: "100%", height: "120px", padding: "12px", borderRadius: "12px", border: "1px solid var(--state-disabled-border)", outline: "none", fontSize: "14px", marginBottom: "20px", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={() => setNotificarModal(null)} style={{ flex: 1, background: "var(--state-disabled-bg)", color: "var(--text-main)", border: "none", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer" }}>Cancelar</button>
        <button onClick={enviarNotificacionSancion} style={{ flex: 2, background: "var(--state-info-fg)", color: "var(--bg-card)", border: "none", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer" }}>Enviar Notificación</button>
      </div>
    </div>
  </div>
)}

{/* 🌟 MODAL DE SUSPENSIÓN 🌟 */}
      {suspenderModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 30000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setSuspenderModal(null)}>
          <div style={{ background: "var(--bg-card)", padding: "25px", borderRadius: "24px", maxWidth: "450px", width: "100%", border: "2px solid var(--state-danger-fg)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "var(--state-danger-fg)", margin: "0 0 10px 0", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px" }}>
              <Ban size={20} /> Suspender a @{suspenderModal.display_name}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-main)", marginBottom: "20px", lineHeight: "1.5" }}>
              Elige el tiempo de suspensión. El usuario será restringido, recibirá una notificación y se creará un ticket automático en vuestra bandeja de denuncias para revisar el caso cuando venza el plazo.
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <button onClick={() => aplicarSuspension('1_mes')} style={{ background: "var(--state-danger-bg)", color: "var(--state-danger-fg)", border: "1px solid var(--state-danger-border)", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer", textAlign: "left" }}>
                ⏳ Suspender por 1 Mes
              </button>
              <button onClick={() => aplicarSuspension('6_meses')} style={{ background: "var(--state-danger-bg)", color: "var(--state-danger-fg)", border: "1px solid var(--state-danger-border)", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer", textAlign: "left" }}>
                🕰️ Suspender por 6 Meses
              </button>
              <button onClick={() => aplicarSuspension('definitivo')} style={{ background: "var(--state-danger-fg)", color: "var(--bg-card)", border: "none", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer", textAlign: "left" }}>
                ☠️ Expulsión Definitiva
              </button>
            </div>

            <button onClick={() => setSuspenderModal(null)} style={{ width: "100%", background: "var(--state-disabled-bg)", color: "var(--text-main)", border: "none", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
        
      )}
      
        </main>
      </div>

      <style jsx>{`
        .admin-shell {
          max-width: 1180px;
          margin: 28px auto 0;
          padding: 0 20px;
          display: grid;
          grid-template-columns: 232px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }
        .admin-side {
          position: sticky;
          top: 112px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 24px;
          box-shadow: 0 10px 30px var(--shadow-card);
          padding: 18px 14px 14px;
        }
        .admin-brand h1 {
          color: var(--color-primary);
          font-size: 32px;
          line-height: 1;
          margin: 2px 0 6px;
        }
        .admin-kicker {
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .admin-brand p {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-subheading);
        }
        .admin-nav-group + .admin-nav-group {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }
        .admin-nav-label {
          display: block;
          margin: 0 8px 6px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .admin-nav-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          margin: 2px 0;
          border: none;
          border-radius: 12px;
          background: transparent;
          color: var(--text-main);
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
        }
        .admin-nav-btn.is-active {
          background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-card));
          color: var(--color-primary);
        }
        .admin-stage-body {
          background: var(--bg-card);
          padding: 28px;
          border-radius: 24px;
          border: 1px solid var(--border-card);
          box-shadow: 0 10px 30px var(--shadow-card);
        }
        .admin-stage-body.is-plain {
          background: transparent;
          padding: 0;
          border: none;
          box-shadow: none;
        }
        .admin-nav-btn:hover {
          background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        }
        .admin-nav-btn.is-active:hover {
          background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-card));
        }
        @media (max-width: 999px) {
          .admin-side { top: 132px; }
        }
        @media (max-width: 860px) {
          .admin-shell {
            grid-template-columns: 1fr;
            margin-top: 12px;
            gap: 14px;
            padding: 0 14px;
          }
          .admin-side {
            top: 128px;
            z-index: 20;
            padding: 12px;
          }
          .admin-brand {
            display: flex;
            align-items: baseline;
            gap: 10px;
          }
          .admin-brand h1 { font-size: 22px; margin: 0; }
          .admin-brand p { display: none; }
          .admin-nav {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            margin-top: 10px;
            padding-bottom: 2px;
            scrollbar-width: none;
          }
          .admin-nav::-webkit-scrollbar { display: none; }
          .admin-nav-group {
            display: contents;
          }
          .admin-nav-group + .admin-nav-group {
            margin: 0;
            padding: 0;
            border: none;
          }
          .admin-nav-label { display: none; }
          .admin-nav-btn {
            width: auto;
            flex: 0 0 auto;
            white-space: nowrap;
            background: var(--bg-main);
            border: 1px solid var(--color-border);
          }
          .admin-stage-body { padding: 16px; border-radius: 18px; }
        }
        .admin-panel-root input,
        .admin-panel-root textarea,
        .admin-panel-root select {
          color: var(--text-main);
          background: var(--bg-main);
        }
        .admin-panel-root input::placeholder,
        .admin-panel-root textarea::placeholder {
          color: var(--text-muted);
          opacity: 1;
        }
        .admin-panel-root select option {
          color: var(--text-main);
          background: var(--bg-card);
        }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-slide {
          animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
export default function AdminPanelClient() {
  return <AdminPanelContent />;
}

const labelStyle = { display: "block", fontSize: "13px", fontWeight: 800, color: "var(--color-primary)", marginBottom: "8px" };
const inputStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid var(--color-border)",
  outline: "none",
  boxSizing: "border-box" as any,
  background: "var(--bg-main)",
  color: "var(--text-main)",
};
const dropzoneStyle = (hasFile: boolean, color = "var(--bg-soft)") => ({
  padding: "20px", border: hasFile ? "2px solid var(--color-primary)" : "2px dashed var(--color-border)", borderRadius: "12px", textAlign: "center" as const, backgroundColor: hasFile ? color : "var(--bg-card)", transition: "all 0.3s"
});