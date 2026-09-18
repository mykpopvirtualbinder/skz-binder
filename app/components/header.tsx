"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  User, Mail, BookHeart, ShieldAlert, LogOut, 
  Settings, MousePointer2, X, Crown, Globe, Palette, Search, Loader2, Star,
  Home, LayoutGrid, Store, Menu, Package, Paintbrush, MessageCircle, ShoppingBag,
  ChevronLeft, ChevronRight, Disc,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminTeamEmail, isSiteAdminSession } from "@/lib/admin-emails";
import {
  getCursorUnlockCost,
  getThemeUnlockCost,
  isVipThemeKey,
  normalizeThemeId,
  unlockKeyForCursor,
  unlockKeyForTheme,
} from "@/lib/theme-unlocks";
import { useGlobal } from "../context/GlobalContext";
import Link from "next/link";
import type { SiteSearchHit } from "@/lib/site-search";

/** Orden edad miembro → mascota; archivo en disco: `fileStem` si difiere del id (p. ej. FoxI.Ny → foxi.ny). */
const SKZOO_CURSOR_BASE: { id: string; name: string; fileStem?: string }[] = [
  { id: "wolfchan", name: "Wolf Chan" },
  { id: "leebit", name: "Leebit" },
  { id: "dwaekki", name: "Dwaekki" },
  { id: "jiniret", name: "Jiniret" },
  { id: "hanquokka", name: "Han Quokka" },
  { id: "bbokari", name: "BbokAri" },
  { id: "puppym", name: "PuppyM" },
  { id: "foxiny", name: "FoxI.Ny", fileStem: "foxi.ny" },
];

const SKZOO_CURSOR_VARIANTS = ["regular", "evil"] as const;

/** PostgREST cuando falta la columna `profiles.cursor_url` en la base de datos. */
function profileCursorErrorMessage(errMsg: string | undefined, t: (key: string) => string): string {
  const m = String(errMsg || "").toLowerCase();
  if (m.includes("cursor_url") && (m.includes("schema cache") || m.includes("column"))) {
    return t("header.cursors_modal.error_cursor_schema");
  }
  return String(errMsg || "");
}

function setNextLocaleCookie(code: string) {
  document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
}

const SKZOO_CURSOR_BASE_IDS = new Set(SKZOO_CURSOR_BASE.map((c) => c.id));

/** `wolfchan-regular` → `wolfchan`; ids legacy del binder sin sufijo se devuelven tal cual si son base SKZOO. */
function vipCursorMascotBaseId(compoundOrBase: string): string | null {
  const m = compoundOrBase.match(/^(.*)-(regular|evil)$/);
  if (m && SKZOO_CURSOR_BASE_IDS.has(m[1])) return m[1];
  if (SKZOO_CURSOR_BASE_IDS.has(compoundOrBase)) return compoundOrBase;
  return null;
}

type VipCursorOption = { id: string; name: string; img: string };

function vipCursorIsFavorite(favoriteIds: string[], compoundId: string): boolean {
  const mascotBase = vipCursorMascotBaseId(compoundId);
  if (!mascotBase) return favoriteIds.includes(compoundId);
  return favoriteIds.includes(compoundId) || favoriteIds.includes(mascotBase);
}

function VipCursorGridCell({
  c,
  favoriteIds,
  onSelect,
  onToggleFavorite,
  t,
}: {
  c: VipCursorOption;
  favoriteIds: string[];
  onSelect: (c: VipCursorOption) => void | Promise<void>;
  onToggleFavorite: (e: React.SyntheticEvent, id: string) => void;
  t: (key: string) => string;
}) {
  const fav = vipCursorIsFavorite(favoriteIds, c.id);
  return (
    <button
      type="button"
      onClick={() => void onSelect(c)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        background: "var(--bg-main)",
        cursor: "pointer",
        transition: "transform 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => onToggleFavorite(e, c.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleFavorite(e, c.id);
          }
        }}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          zIndex: 2,
          cursor: "pointer",
          lineHeight: 0,
          padding: 2,
          borderRadius: 6,
          opacity: fav ? 1 : 0.35,
        }}
        aria-label={fav ? t("me.in_favorites") : t("me.add_favorite")}
        title={fav ? t("me.in_favorites") : t("me.add_favorite")}
      >
        <Star size={14} strokeWidth={2} color="var(--state-warning-border)" fill={fav ? "var(--state-warning-border)" : "none"} />
      </span>
      <img src={c.img} style={{ width: 35, height: 35, objectFit: "contain", marginBottom: "5px" }} alt={c.name} />
      <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-main)", textAlign: "center", lineHeight: 1.2 }}>{c.name}</span>
    </button>
  );
}

const FAVORITE_VIP_CURSORS_LS = "binder:favorite-cursors";

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'th', label: 'ไทย' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
];

// Estos son los únicos colores fijos permitidos porque son las muestras visuales del menú
const THEME_OPTIONS = [
  { id: 'pastel', name: 'Soft Pastel', vip: false, color: 'var(--color-primary)' },
  { id: 'dark', name: 'Midnight Neon', vip: true, color: 'var(--theme-chip-dark)' }, // 👈 Cambiado a vip: true
  { id: 'vibrant', name: 'Anime Vibrant', vip: true, color: 'var(--theme-chip-vibrant)' },
  { id: 'minimal', name: 'Korean Café', vip: true, color: 'var(--theme-chip-minimal)' },
  { id: 'k_pride', name: 'K-Pride', vip: true, color: 'var(--theme-chip-kpride)' },
  { id: 'iris_bloom', name: 'Iris Bloom', vip: true, color: 'var(--theme-chip-irisbloom)' }
];

type NavLinkItem = { name: string; path: string };

function navItemScrollMetrics(scroller: HTMLElement, item: HTMLElement) {
  const scrollerRect = scroller.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const left = itemRect.left - scrollerRect.left + scroller.scrollLeft;
  return { left, right: left + itemRect.width };
}

function DesktopHeaderNavScroller({
  navLinks,
  currentPath,
  closeAllMenus,
  t,
}: {
  navLinks: NavLinkItem[];
  currentPath: string;
  closeAllMenus: () => void;
  t: (key: string) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    const wrap = wrapRef.current;
    if (!el) return;

    const measure = () => updateScrollState();
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (wrap) ro.observe(wrap);
    Array.from(el.querySelectorAll("a.header-nav-link, .desktop-header-nav__track")).forEach((child) => {
      ro.observe(child);
    });

    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }

    return () => {
      cancelled = true;
      ro.disconnect();
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [updateScrollState, navLinks]);

  const scrollNav = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const links = Array.from(el.querySelectorAll<HTMLElement>("a.header-nav-link"));
    if (links.length === 0) return;

    const arrowGutter = 32;
    const viewLeft = el.scrollLeft;
    const viewRight = el.scrollLeft + el.clientWidth;
    const epsilon = 4;

    if (direction === 1) {
      const next = links.find((link) => navItemScrollMetrics(el, link).right > viewRight - arrowGutter + epsilon);
      if (next) {
        el.scrollTo({ left: Math.max(0, navItemScrollMetrics(el, next).left - arrowGutter), behavior: "smooth" });
      } else {
        el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: "smooth" });
      }
      return;
    }

    const prev = [...links].reverse().find((link) => navItemScrollMetrics(el, link).left < viewLeft + arrowGutter - epsilon);
    if (prev) {
      const { right } = navItemScrollMetrics(el, prev);
      el.scrollTo({ left: Math.max(0, right - el.clientWidth + arrowGutter), behavior: "smooth" });
    } else {
      el.scrollTo({ left: 0, behavior: "smooth" });
    }
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <div
      ref={wrapRef}
      className={[
        "site-header__nav-scroller",
        hasOverflow ? "site-header__nav-scroller--overflow" : "",
        canScrollLeft ? "site-header__nav-scroller--can-left" : "",
        canScrollRight ? "site-header__nav-scroller--can-right" : "",
      ].filter(Boolean).join(" ")}
    >
      {canScrollLeft && (
        <button
          type="button"
          className="site-header__nav-scroll-btn site-header__nav-scroll-btn--left"
          aria-label={t("common.previous")}
          onClick={() => scrollNav(-1)}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      <nav
        ref={scrollerRef}
        className={`site-header__col-center hide-scrollbar desktop-header-nav${hasOverflow ? " desktop-header-nav--scrollable" : ""}`}
      >
        <div className="desktop-header-nav__track">
          {navLinks.map((link) => {
            const isActive = link.path === "/" ? currentPath === "/" : currentPath.startsWith(link.path);
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`tan-font header-nav-link${isActive ? " header-nav-link--active" : ""}`}
                onPointerDown={closeAllMenus}
              >
                {link.name}
                <span className="header-nav-underline" aria-hidden />
              </Link>
            );
          })}
        </div>
      </nav>
      {canScrollRight && (
        <button
          type="button"
          className="site-header__nav-scroll-btn site-header__nav-scroll-btn--right"
          aria-label={t("common.next")}
          onClick={() => scrollNav(1)}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

function siteSearchTypeLabel(type: SiteSearchHit["type"], t: (key: string) => string): string {
  const key = `header.search_type_${type}`;
  const label = t(key);
  return label && label !== key ? label : type;
}

function HeaderSiteSearchDropdown({
  query,
  setQuery,
  results,
  loading,
  inputRef,
  onPick,
  t,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: SiteSearchHit[];
  loading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (hit: SiteSearchHit) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className="header-dropdown-menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 340,
        maxWidth: "calc(100vw - 24px)",
        background: "var(--bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        boxShadow: "var(--shadow-card)",
        zIndex: 1300,
        padding: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-main)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "8px 10px" }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("header.search_placeholder")}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (results[0]) onPick(results[0]);
          }}
          style={{ width: "100%", border: "none", outline: "none", background: "transparent", color: "var(--text-main)", fontSize: 13 }}
        />
        {loading && <Loader2 size={14} className="spinner" color="var(--text-muted)" />}
      </div>
      {query.trim().length >= 2 && (
        <div style={{ marginTop: 6, maxHeight: 360, overflowY: "auto" }}>
          {results.length === 0 && !loading ? (
            <div style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 12 }}>{t("no_results")}</div>
          ) : (
            results.map((hit) => (
              <button
                key={`${hit.type}-${hit.id}`}
                type="button"
                onClick={() => onPick(hit)}
                className="dropdown-item-hover"
                style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10 }}
              >
                {hit.image ? (
                  <img src={hit.image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", border: "1px solid var(--color-border)", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-soft)", flexShrink: 0 }}>
                    <Search size={12} color="var(--text-muted)" />
                  </div>
                )}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", color: "var(--text-main)", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.title}</span>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {siteSearchTypeLabel(hit.type, t)}
                    {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  
  const { profile, showAlert, showConfirm, t, refreshGlobal } = useGlobal();
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return normalizeThemeId(localStorage.getItem("theme") || document.documentElement.getAttribute("data-theme") || "pastel");
    }
    return "pastel";
  });
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeCursor, setActiveCursor] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(pathname);
  const [mounted, setMounted] = useState(false);
  
  const [currentLocale, setCurrentLocale] = useState('es');

  // Estados de Menús Desplegables
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [cursorMenuOpen, setCursorMenuOpen] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0); 
  const [user, setUser] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [unlockedThemes, setUnlockedThemes] = useState<Set<string>>(new Set());
  const [unlockedCursors, setUnlockedCursors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SiteSearchHit[]>([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const closeAllMenus = useCallback(() => {
    setProfileMenuOpen(false);
    setLangMenuOpen(false);
    setThemeMenuOpen(false);
    setUserSearchOpen(false);
    setCursorMenuOpen(false);
    setMoreMenuOpen(false);
  }, []);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const userSearchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRailRef = useRef<HTMLDivElement | null>(null);
  const headerLeftRef = useRef<HTMLDivElement | null>(null);
  const headerRightRef = useRef<HTMLDivElement | null>(null);

  // ✨ SEGUIDOR DE RATÓN GLOBAL ✨ (solo sincroniza si el perfil trae la clave cursor_url; evita borrar al refrescar con JSON viejo sin esa clave)
  useEffect(() => {
    if (profile == null) {
      setActiveCursor(null);
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(profile, "cursor_url")) {
      return;
    }
    const url = (profile as { cursor_url?: string | null }).cursor_url;
    setActiveCursor(url && typeof url === "string" && url.length > 0 ? url : null);
  }, [profile]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    setMounted(true);
    setCurrentPath(window.location.pathname);

    const sessionOverride =
      typeof window !== "undefined" ? sessionStorage.getItem("ui:language_override") : null;
    if (sessionOverride) {
      setCurrentLocale(sessionOverride);
    } else if (profile?.language) {
      setCurrentLocale(profile.language);
    } else {
      const cookieLocale = document.cookie.split('; ').find(row => row.startsWith('NEXT_LOCALE='))?.split('=')[1];
      if (cookieLocale) setCurrentLocale(cookieLocale);
    }

    const checkMobile = () => setIsMobile(window.innerWidth <= 1023);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllMenus();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [pathname, profile?.language, closeAllMenus]);

  useEffect(() => {
    if (!mounted || isMobile) return;
    const rail = headerRailRef.current;
    const left = headerLeftRef.current;
    const right = headerRightRef.current;
    if (!rail || !left || !right) return;

    const apply = () => {
      const side = Math.ceil(Math.max(left.scrollWidth, right.scrollWidth));
      if (side > 0) rail.style.setProperty("--header-side", `${side}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(left);
    ro.observe(right);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [mounted, isMobile, user, unreadCount]);

  useEffect(() => {
    if (!mounted) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    return () => subscription.unsubscribe();
  }, [mounted]);

  useEffect(() => {
    const loadThemeUnlocks = async () => {
      if (!user?.id) {
        setUnlockedThemes(new Set());
        return;
      }
      const { data } = await supabase
        .from("user_vip_unlocks")
        .select("unlock_key")
        .eq("user_id", user.id);
      const keys = (data || [])
        .map((r: any) => String(r.unlock_key || ""))
        .filter((k: string) => k.startsWith("theme:"))
        .map((k: string) => k.replace(/^theme:/, ""));
      setUnlockedThemes(new Set(keys.map((id) => normalizeThemeId(id))));
    };
    void loadThemeUnlocks();
  }, [user?.id]);

  useEffect(() => {
    const loadCursorUnlocks = async () => {
      if (!user?.id) {
        setUnlockedCursors(new Set());
        return;
      }
      const { data } = await supabase
        .from("user_vip_unlocks")
        .select("unlock_key")
        .eq("user_id", user.id);
      const keys = (data || [])
        .map((r: any) => String(r.unlock_key || ""))
        .filter((k: string) => k.startsWith("cursor:"))
        .map((k: string) => k.replace(/^cursor:/, ""));
      setUnlockedCursors(new Set(keys));
    };
    void loadCursorUnlocks();
  }, [user?.id]);

  const skzooVipCursorOptions = useMemo(
    () =>
      SKZOO_CURSOR_BASE.flatMap((c) =>
        SKZOO_CURSOR_VARIANTS.map((variant) => ({
          id: `${c.id}-${variant}`,
          name: `${c.name} (${t(variant === "regular" ? "header.cursors_modal.variant_regular" : "header.cursors_modal.variant_evil")})`,
          img: `/zootopia/stray-kids/${variant}/${c.fileStem ?? c.id}.png`,
        })),
      ),
    [t],
  );

  const [favoriteVipCursorIds, setFavoriteVipCursorIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(FAVORITE_VIP_CURSORS_LS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!cursorMenuOpen) return;
    try {
      const raw = localStorage.getItem(FAVORITE_VIP_CURSORS_LS);
      setFavoriteVipCursorIds(raw ? JSON.parse(raw) : []);
    } catch {
      setFavoriteVipCursorIds([]);
    }
  }, [cursorMenuOpen]);

  const favoriteVipCursorOptions = useMemo(
    () => skzooVipCursorOptions.filter((o) => vipCursorIsFavorite(favoriteVipCursorIds, o.id)),
    [skzooVipCursorOptions, favoriteVipCursorIds],
  );

  const toggleVipCursorFavorite = useCallback((e: React.SyntheticEvent, compoundId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const mascotBase = vipCursorMascotBaseId(compoundId);
    if (!mascotBase) return;

    setFavoriteVipCursorIds((prev) => {
      const hasCompound = prev.includes(compoundId);
      const hasBase = prev.includes(mascotBase);
      const wasFav = hasCompound || hasBase;

      let next: string[];
      if (!wasFav) {
        next = [...prev.filter((x) => x !== mascotBase), compoundId];
      } else if (hasCompound) {
        next = prev.filter((x) => x !== compoundId);
      } else {
        const otherCompound =
          compoundId.endsWith("-regular") ? `${mascotBase}-evil` : `${mascotBase}-regular`;
        next = [...prev.filter((x) => x !== mascotBase && x !== compoundId), otherCompound];
      }

      try {
        localStorage.setItem(FAVORITE_VIP_CURSORS_LS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const refreshUnreadNotifications = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setUnreadCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("read", false);
    if (error) return;
    setUnreadCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void refreshUnreadNotifications();
    const onUpdate = () => void refreshUnreadNotifications();
    window.addEventListener("update_notifications", onUpdate);
    return () => window.removeEventListener("update_notifications", onUpdate);
  }, [mounted, refreshUnreadNotifications]);

  useEffect(() => {
    if (!user?.id) setUnreadCount(0);
    else void refreshUnreadNotifications();
  }, [user?.id, refreshUnreadNotifications]);

  // 🌍 LINKS DE NAVEGACIÓN TRADUCIDOS 🌍
  const navLinks = useMemo(() => [
    { name: t('menu.home'), path: "/" },
    { name: t('menu.library'), path: "/library" },
    { name: t('menu.albums'), path: "/albums" },
    { name: t('menu.merch'), path: "/merch" },
    { name: t('menu.market'), path: "/market" },
    { name: t('menu.fanart'), path: "/fanart" },
    { name: t('menu.fanzone'), path: "/fanzone" },
    { name: t('menu.shop'), path: "/shop" },
  ], [t]); 

  const sessionEmail = (user?.email ?? "").trim();
  const isAdmin = isAdminTeamEmail(sessionEmail || null);
  const showAdminPanelInHeader = isSiteAdminSession(sessionEmail || null);
  const hasAccountSession = Boolean(user || profile?.id);

  const applyVipCursorSelection = useCallback(
    async (c: VipCursorOption) => {
      if (!user?.id) return;
      const needsUnlock = !profile?.is_premium && !isAdmin && !unlockedCursors.has(c.id);
      if (needsUnlock) {
        const cost = getCursorUnlockCost(c.id);
        const balance = Number(profile?.puntos || 0);
        if (balance < cost) {
          showAlert(t("common.error"), `Necesitas ${cost} K-oins para desbloquear este cursor.`);
          return;
        }
        const ok = await showConfirm(
          t("shop.confirm_modal.btn_confirm"),
          `Desbloquear cursor "${c.name}" por ${cost} K-oins?`,
        );
        if (!ok) return;
        const unlockRes = await supabase
          .from("user_vip_unlocks")
          .upsert({ user_id: user.id, unlock_key: unlockKeyForCursor(c.id) }, { onConflict: "user_id,unlock_key" });
        if (unlockRes.error) {
          showAlert(t("common.error"), unlockRes.error.message);
          return;
        }
        const nextKoins = Math.max(0, balance - cost);
        const pointsRes = await supabase.from("profiles").update({ puntos: nextKoins }).eq("user_id", user.id);
        if (pointsRes.error) {
          showAlert(t("common.error"), pointsRes.error.message);
          return;
        }
        setUnlockedCursors((prev) => {
          const next = new Set(prev);
          next.add(c.id);
          return next;
        });
        const localProfileStr = localStorage.getItem("me:profile");
        if (localProfileStr) {
          const parsed = JSON.parse(localProfileStr);
          parsed.puntos = nextKoins;
          localStorage.setItem("me:profile", JSON.stringify(parsed));
        }
        refreshGlobal();
        showAlert("Desbloqueado", `Cursor desbloqueado por ${cost} K-oins.`);
      }
      const { error: cursorSaveErr } = await supabase
        .from("profiles")
        .update({ cursor_url: c.img })
        .eq("user_id", user.id);
      if (cursorSaveErr) {
        showAlert(t("common.error"), profileCursorErrorMessage(cursorSaveErr.message, t));
        setCursorMenuOpen(false);
        return;
      }
      try {
        const localProfileStr = localStorage.getItem("me:profile");
        if (localProfileStr) {
          const parsed = JSON.parse(localProfileStr);
          parsed.cursor_url = c.img;
          localStorage.setItem("me:profile", JSON.stringify(parsed));
        }
      } catch {
        /* ignore */
      }
      setActiveCursor(c.img);
      refreshGlobal();
      setCursorMenuOpen(false);
    },
    [
      user?.id,
      profile?.is_premium,
      profile?.puntos,
      isAdmin,
      unlockedCursors,
      showAlert,
      showConfirm,
      refreshGlobal,
      t,
    ],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("ui:language_override");
    }
    closeAllMenus();
    setUser(null);
    router.push("/");
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/site-search?q=${encodeURIComponent(query)}`);
        const json = (await res.json().catch(() => ({}))) as { results?: SiteSearchHit[] };
        setSearchResults(Array.isArray(json.results) ? json.results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target as Node)) {
        setUserSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!userSearchOpen) return;
    const id = window.setTimeout(() => {
      userSearchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [userSearchOpen]);

  // ✨ LA MAGIA DEL IDIOMA ✨
  const changeLanguage = async (code: string) => {
    setCurrentLocale(code);
    setNextLocaleCookie(code);
    if (typeof window !== "undefined") {
      // Cambio temporal de sesión: no pisa el idioma persistente de ajustes.
      sessionStorage.setItem("ui:language_override", code);
    }
    window.location.reload(); 
  };

  const changeTheme = async (themeId: string, isVip: boolean) => {
    themeId = normalizeThemeId(themeId);
    const needsUnlock = isVipThemeKey(themeId) && !profile?.is_premium && !isAdmin && !unlockedThemes.has(themeId);
    if (needsUnlock) {
      const cost = getThemeUnlockCost(themeId);
      const balance = Number(profile?.puntos || 0);
      if (balance < cost) {
        showAlert(t("common.error"), t("vip.unlock_theme_need", { cost }));
        return;
      }
      const ok = await showConfirm(
        t("shop.confirm_modal.btn_confirm"),
        t("vip.unlock_theme_confirm", { name: t(`theme_selector.themes.${themeId}`), cost }),
      );
      if (!ok) return;
      if (!user?.id || !profile?.id) return;
      const insertRes = await supabase
        .from("user_vip_unlocks")
        .upsert({ user_id: user.id, unlock_key: unlockKeyForTheme(themeId) }, { onConflict: "user_id,unlock_key" });
      if (insertRes.error) {
        showAlert(t("common.error"), insertRes.error.message);
        return;
      }
      const nextKoins = Math.max(0, balance - cost);
      const { error: pointsErr } = await supabase
        .from("profiles")
        .update({ puntos: nextKoins })
        .eq("user_id", profile.id);
      if (pointsErr) {
        showAlert(t("common.error"), pointsErr.message);
        return;
      }
      setUnlockedThemes((prev) => {
        const next = new Set(prev);
        next.add(themeId);
        return next;
      });
      const localProfileStr = localStorage.getItem("me:profile");
      if (localProfileStr) {
        const parsed = JSON.parse(localProfileStr);
        parsed.puntos = nextKoins;
        localStorage.setItem("me:profile", JSON.stringify(parsed));
      }
      showAlert(t("vip.unlocked_title"), t("vip.unlock_theme_done", { cost }));
    }
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('theme', themeId);
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: themeId })
        .eq('user_id', user.id);
      const msg = String(error?.message || "").toLowerCase();
      const missingThemeColumn = msg.includes("theme_preference") && msg.includes("profiles");
      if (error && !missingThemeColumn) {
        showAlert(t("common.error"), error.message);
      }
    }
    const localProfileStr = localStorage.getItem("me:profile");
    if (localProfileStr) {
      const parsed = JSON.parse(localProfileStr);
      parsed.theme_preference = themeId;
      localStorage.setItem("me:profile", JSON.stringify(parsed));
    }
    setActiveTheme(themeId);
    window.dispatchEvent(new Event('themeChange')); 
    setThemeMenuOpen(false);
  };

  if (!mounted) {
    return <div style={{ height: 125, backgroundColor: "var(--bg-soft)", width: "100%" }} />;
  }

  return (
    <>
      <header
        style={{
          width: "100%",
          backgroundColor: "var(--bg-soft)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          padding: isMobile ? "10px 15px 8px 15px" : "15px 40px",
          display: isMobile ? "flex" : "block",
          flexDirection: isMobile ? "column" : undefined,
          justifyContent: isMobile ? "space-between" : undefined,
          alignItems: isMobile ? "stretch" : undefined,
          borderBottom: "1px solid var(--color-border)",
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 1100,
          boxSizing: "border-box",
          transition: "background-color 0.3s ease, border-color 0.3s ease" 
        }}
      >
        {isMobile ? (
        <>
        {/* --- ZONA IZQUIERDA (Logo y Móvil) --- */}
        <div style={{ display: "flex", width: isMobile ? "100%" : "auto", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <Link href="/" onPointerDown={closeAllMenus}>
            <img
              src="/branding/logo.png"
              alt={t('header.logo_alt')}
              style={{
                height: isMobile ? 40 : 55,
                width: "auto",
                maxWidth: isMobile ? 140 : 240,
                objectFit: "contain",
                display: "block",
                flexShrink: 0,
              }}
            />
          </Link>
          
          {/* ICONOS EN MÓVIL */}
          {isMobile && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {/* Buscar en el catálogo público */}
              <div ref={searchBoxRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    closeAllMenus();
                    setUserSearchOpen((prev) => !prev);
                  }}
                  className="action-btn-mini"
                  title={t("common.search")}
                  style={{ color: "var(--header-btn-profile)" }}
                >
                  <Search size={16} />
                </button>
                {userSearchOpen && (
                  <HeaderSiteSearchDropdown
                    query={searchQuery}
                    setQuery={setSearchQuery}
                    results={searchResults}
                    loading={searchLoading}
                    inputRef={userSearchInputRef}
                    t={t}
                    onPick={(hit) => {
                      setUserSearchOpen(false);
                      setSearchQuery("");
                      router.push(hit.href);
                    }}
                  />
                )}
              </div>
              
              {/* Idioma Móvil */}
              <div style={{ position: "relative" }}>
                <button onClick={() => { closeAllMenus(); setLangMenuOpen(!langMenuOpen); }} className="action-btn-mini" style={{ flexDirection: "column", gap: "1px", color: "var(--header-btn-lang)" }} title={t('header.dropdown.language')}>
                  <Globe size={14} />
                  <span style={{ fontSize: "9px", fontWeight: 900, lineHeight: 1 }}>{currentLocale.toUpperCase()}</span>
                </button>
                {langMenuOpen && (
                  <div className="hide-scrollbar header-dropdown-menu" style={{ position: "absolute", top: "100%", right: 0, marginTop: "8px", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "var(--shadow-card)", zIndex: 1200, minWidth: "150px", maxHeight: "250px", overflowY: "auto" }}>
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => changeLanguage(lang.code)} style={{ ...dropdownItemStyle, border: currentLocale === lang.code ? "1px solid var(--color-primary)" : "1px solid transparent", background: currentLocale === lang.code ? "var(--bg-soft)" : "transparent" }} className="dropdown-item-hover">
                        <span style={{ fontWeight: currentLocale === lang.code ? "900" : "600" }}>{lang.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tema Móvil */}
              <button onClick={() => { closeAllMenus(); setThemeMenuOpen(!themeMenuOpen); }} className="action-btn-mini" style={{ color: "var(--header-btn-theme)" }} title={t('header.dropdown.theme')}>
                <Palette size={16} />
              </button>

              {user && (
                <Link
                  href="/me?tab=notices"
                  onPointerDown={closeAllMenus}
                  className={`action-btn-mini header-mail-btn ${unreadCount > 0 ? "header-mail-btn--unread" : ""}`}
                  title={t("header.dropdown.notifications")}
                  style={{ position: "relative" }}
                >
                  <Mail size={16} strokeWidth={unreadCount > 0 ? 2.4 : 2} />
                  {unreadCount > 0 && (
                    <span className="notification-badge-mini">{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                </Link>
              )}

             {hasAccountSession && (
                <>
                  <div style={{ position: "relative", marginLeft: "4px" }}>
                  <button
                    onClick={() => {
                      closeAllMenus();
                      setProfileMenuOpen(!profileMenuOpen);
                    }}
                    style={{ position: "relative", display: "block", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    title={t("header.dropdown.my_profile")}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", border: profile?.is_premium ? "2px solid var(--color-primary)" : "2px solid var(--color-border)", padding: "1px", background: "var(--bg-card)", overflow: "visible", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} alt="Avatar" />
                      ) : (
                        <User size={16} color="var(--text-muted)" />
                      )}
                    </div>
                    {profile?.is_premium && (
                      <div style={{ position: "absolute", top: "-6px", right: "-5px", transform: "rotate(15deg)", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--state-warning-bg) 70%, var(--bg-card) 30%)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--state-warning-border) 65%, transparent), 0 6px 12px color-mix(in srgb, var(--state-warning-fg) 45%, transparent)" }}>
                        <Crown size={13} color="var(--state-warning-fg)" fill="var(--state-warning-border)" strokeWidth={1.7} />
                      </div>
                    )}
                  </button>
                  {profileMenuOpen && (
                    <div className="header-dropdown-menu" style={{ position: "absolute", top: "100%", right: 0, marginTop: "8px", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "var(--shadow-card)", zIndex: 1200, minWidth: "200px" }}>
                      {showAdminPanelInHeader && (
                        <Link href="/admin-panel" onClick={closeAllMenus} style={{ ...dropdownItemStyle, backgroundColor: "var(--text-main)", color: "var(--bg-main)", marginBottom: "4px" }} className="dropdown-item-hover">
                          <ShieldAlert size={16} color="var(--bg-main)" /> {t("header.dropdown.admin_panel")}
                        </Link>
                      )}
                      <Link href="/binders" onClick={closeAllMenus} style={dropdownItemStyle} className="dropdown-item-hover">
                        <BookHeart size={16} /> {t("header.dropdown.my_binders")}
                      </Link>
                      <Link href="/me?tab=notices" onClick={closeAllMenus} style={dropdownItemStyle} className="dropdown-item-hover">
                        <Mail size={16} /> {t("header.dropdown.notifications")}
                      </Link>
                      <Link href="/me" onClick={closeAllMenus} style={dropdownItemStyle} className="dropdown-item-hover">
                        <User size={16} /> {t("header.dropdown.my_profile")}
                      </Link>
                      <button onClick={handleLogout} style={{ ...dropdownItemStyle, background: "none", border: "none", width: "100%", cursor: "pointer", textAlign: "left" }} className="dropdown-item-hover">
                        <LogOut size={16} /> {t("header.dropdown.logout")}
                      </button>
                    </div>
                  )}
                  </div>
                </>
              )}
              {!hasAccountSession && (
                <Link
                  href="/login"
                  onPointerDown={closeAllMenus}
                  className="tan-font"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--color-primary)",
                    border: "2px solid var(--color-border)",
                    padding: "6px 12px",
                    borderRadius: "99px",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  {t("header.login_btn")}
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="site-header__mobile-nav-row">
          <DesktopHeaderNavScroller
            navLinks={navLinks}
            currentPath={currentPath}
            closeAllMenus={closeAllMenus}
            t={t}
          />
        </div>
        </>
        ) : (
        <div className="site-header__rail-grid" ref={headerRailRef}>
          <div className="site-header__col-left" ref={headerLeftRef}>
            <Link href="/" onPointerDown={closeAllMenus}>
              <img
                src="/branding/logo.png"
                alt={t('header.logo_alt')}
                style={{
                  height: 55,
                  width: "auto",
                  maxWidth: 160,
                  objectFit: "contain",
                  display: "block",
                  flexShrink: 0,
                }}
              />
            </Link>
          </div>

        <div className="site-header__nav-slot">

        <DesktopHeaderNavScroller
          navLinks={navLinks}
          currentPath={currentPath}
          closeAllMenus={closeAllMenus}
          t={t}
        />

        </div>

        {/* --- ZONA DERECHA (Escritorio) --- */}
          <div className="site-header__col-right" ref={headerRightRef}>
            <div className="site-header__toolbar">
            <div className="site-header__action-cluster">
            <div ref={searchBoxRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  closeAllMenus();
                  setUserSearchOpen((prev) => !prev);
                }}
                className="action-btn-mini"
                title={t("common.search")}
                style={{ color: "var(--header-btn-profile)" }}
              >
                <Search size={16} />
              </button>
              {userSearchOpen && (
                <HeaderSiteSearchDropdown
                  query={searchQuery}
                  setQuery={setSearchQuery}
                  results={searchResults}
                  loading={searchLoading}
                  inputRef={userSearchInputRef}
                  t={t}
                  onPick={(hit) => {
                    setUserSearchOpen(false);
                    setSearchQuery("");
                    router.push(hit.href);
                  }}
                />
              )}
            </div>
            
            {/* Menú Idioma Desktop */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => { closeAllMenus(); setLangMenuOpen(!langMenuOpen); }} 
                className="action-btn-mini" 
                title={t('header.dropdown.language')}
                style={{ 
                  color: "var(--header-btn-lang)",
                  flexDirection: "column", 
                  gap: "1px" 
                }}
              >
                <Globe size={14} />
                <span style={{ fontSize: "9px", fontWeight: 900, lineHeight: 1 }}>
                  {currentLocale.toUpperCase()}
                </span>
              </button>
              {langMenuOpen && (
                <div className="hide-scrollbar header-dropdown-menu" style={{ position: "absolute", top: "100%", right: 0, marginTop: "8px", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "var(--shadow-card)", zIndex: 1200, minWidth: "150px", maxHeight: "300px", overflowY: "auto" }}>
                  {LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => changeLanguage(lang.code)} style={{ ...dropdownItemStyle, border: currentLocale === lang.code ? "1px solid var(--color-primary)" : "1px solid transparent", background: currentLocale === lang.code ? "var(--bg-soft)" : "transparent" }} className="dropdown-item-hover">
                      <span style={{ fontWeight: currentLocale === lang.code ? "900" : "600" }}>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menú Tema Desktop */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => { closeAllMenus(); setThemeMenuOpen(!themeMenuOpen); }} 
                className="action-btn-mini" 
                title={t('header.dropdown.theme')}
                style={{ color: "var(--header-btn-theme)" }}
              >
                <Palette size={16} />
              </button>
              {themeMenuOpen && (
                <div className="header-dropdown-menu" style={{ position: "absolute", top: "100%", right: 0, marginTop: "8px", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "var(--shadow-card)", zIndex: 1200, minWidth: "200px" }}>
                  {THEME_OPTIONS.map(themeOpt => (
                    <button key={themeOpt.id} onClick={() => changeTheme(themeOpt.id, themeOpt.vip)} style={{ ...dropdownItemStyle, justifyContent: "space-between", border: activeTheme === themeOpt.id ? "1px solid var(--color-primary)" : "1px solid transparent", background: activeTheme === themeOpt.id ? "var(--bg-soft)" : "transparent" }} className="dropdown-item-hover">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: themeOpt.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: activeTheme === themeOpt.id ? "900" : "600", color: "var(--color-primary)" }}>
                          {t(`theme_selector.themes.${themeOpt.id}`)}
                        </span>
                      </div>
                      {themeOpt.vip && (<span style={{ width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--state-warning-bg) 70%, var(--bg-card) 30%)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--state-warning-border) 60%, transparent), 0 4px 10px color-mix(in srgb, var(--state-warning-fg) 40%, transparent)" }}><Crown size={13} color="var(--state-warning-fg)" fill="var(--state-warning-border)" /></span>)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>

            {user ? (
              <>
                <div className="site-header__toolbar-divider" />

                <div className="site-header__action-cluster">
                <Link href="/binders" className="action-btn-mini" style={{ color: "var(--header-btn-profile)" }} title={t('header.dropdown.my_binders')}>
                  <BookHeart size={16} />
                </Link>

                <Link
                  href="/me?tab=notices"
                  className={`action-btn-mini header-mail-btn ${unreadCount > 0 ? "header-mail-btn--unread" : ""}`}
                  style={unreadCount > 0 ? { position: "relative" } : { color: "var(--header-btn-profile)", position: "relative" }}
                  title={t("header.dropdown.notifications")}
                >
                  <Mail size={16} strokeWidth={unreadCount > 0 ? 2.4 : 2} />
                  {unreadCount > 0 && (
                    <span className="notification-badge-mini">{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                </Link>

                <button onClick={handleLogout} className="action-btn-mini" style={{ color: "var(--header-btn-profile)" }} title={t('header.dropdown.logout')}>
                  <LogOut size={16} />
                </button>
                </div>

                <div className="site-header__toolbar-divider" />

                {/* Avatar Desktop */}
                <div onMouseEnter={() => setProfileMenuOpen(true)} onMouseLeave={() => setProfileMenuOpen(false)} style={{ position: "relative", paddingBottom: "15px", marginTop: "15px", marginLeft: "4px" }}>
                  <Link href="/me" onClick={closeAllMenus} style={{ position: "relative", display: "block" }} className="avatar-hover">
                    <div style={{ width: 38, height: 38, borderRadius: "50%", border: profile?.is_premium ? "2px solid var(--color-primary)" : "2px solid var(--color-border)", padding: "2px", background: "var(--bg-card)", boxShadow: "0 4px 12px var(--shadow-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} alt="Avatar" />
                      ) : (
                        <User size={18} color="var(--text-muted)" />
                      )}
                    </div>
                    {profile?.is_premium && (
                      <div style={{ position: "absolute", top: "-10px", right: "-7px", transform: "rotate(15deg)", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--state-warning-bg) 70%, var(--bg-card) 30%)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--state-warning-border) 70%, transparent), 0 8px 14px color-mix(in srgb, var(--state-warning-fg) 45%, transparent)" }}>
                        <Crown size={16} color="var(--state-warning-fg)" fill="var(--state-warning-border)" strokeWidth={1.7} />
                      </div>
                    )}
                  </Link>

                  {profileMenuOpen && (
                    <div className="header-dropdown-menu" style={{ position: "absolute", top: "100%", right: 0, background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "var(--shadow-card)", zIndex: 1200, minWidth: "200px" }}>
                      {showAdminPanelInHeader && (
                        <Link href="/admin-panel" onClick={closeAllMenus} style={{ ...dropdownItemStyle, backgroundColor: "var(--text-main)", color: "var(--bg-main)", marginBottom: "4px" }}>
                          <ShieldAlert size={16} color="var(--bg-main)" /> {t('header.dropdown.admin_panel')}
                        </Link>
                      )}
                      <Link href="/me" onClick={closeAllMenus} style={dropdownItemStyle} className="dropdown-item-hover">
                        <User size={16} /> {t('header.dropdown.my_profile')}
                      </Link>
                      <Link href="/me?action=settings" onClick={closeAllMenus} style={dropdownItemStyle} className="dropdown-item-hover">
                        <Settings size={16} /> {t('header.dropdown.settings')}
                      </Link>
                      <button onClick={() => { closeAllMenus(); setCursorMenuOpen(true); }} style={{ ...dropdownItemStyle, background: "none", border: "none", width: "100%", cursor: "pointer", textAlign: "left" }} className="dropdown-item-hover">
                        <MousePointer2 size={16} /> {t('header.dropdown.vip_cursors')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login" className="tan-font" style={{ background: "var(--bg-card)", color: "var(--color-primary)", border: "2px solid var(--color-border)", padding: "6px 16px", borderRadius: "99px", textDecoration: "none", fontSize: "14px", transition: "all 0.2s ease" }}>
                {t('header.login_btn')}
              </Link>
            )}
            </div>
          </div>
        </div>
        )}
      </header>

      {/* --- CERRAR MENÚS AL HACER CLIC FUERA --- */}
      {(langMenuOpen || themeMenuOpen || profileMenuOpen) && (
        <div onClick={closeAllMenus} style={{ position: "fixed", inset: 0, zIndex: 1050 }}></div> 
      )}

      {/* --- MODAL DE CURSORES VIP --- */}
      {cursorMenuOpen && (
        <div onClick={() => setCursorMenuOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "var(--overlay-strong)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div className="header-cursor-modal" onClick={e => e.stopPropagation()} style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "24px", width: "min(100vw - 24px, 420px)", maxHeight: "min(90vh, 720px)", display: "flex", flexDirection: "column", border: "2px solid var(--color-border)", boxShadow: "0 10px 40px var(--shadow-card)" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexShrink: 0 }}>
               <h3 style={{ color: "var(--color-primary)", margin: 0, fontWeight: 900 }}>{t('header.cursors_modal.title')}</h3>
               <button onClick={() => setCursorMenuOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color="var(--color-primary)" /></button>
             </div>
             <div style={{ overflowY: "auto", maxHeight: "min(52vh, 480px)", paddingRight: "4px", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: 14 }}>
               {favoriteVipCursorOptions.length > 0 && (
                 <div style={{ flexShrink: 0 }}>
                   <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-primary)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.02em" }}>
                     {t("common.my_favorites")}
                   </div>
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                     {favoriteVipCursorOptions.map((c) => (
                       <VipCursorGridCell
                         key={`fav-${c.id}`}
                         c={c}
                         favoriteIds={favoriteVipCursorIds}
                         onSelect={applyVipCursorSelection}
                         onToggleFavorite={toggleVipCursorFavorite}
                         t={t}
                       />
                     ))}
                   </div>
                   <div style={{ height: 1, background: "var(--color-border)", marginTop: 14, opacity: 0.65 }} />
                 </div>
               )}
               <div style={{ flexShrink: 0 }}>
                 {favoriteVipCursorOptions.length > 0 && (
                   <div style={{ fontSize: 11, fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.02em" }}>
                     {t("header.cursors_modal.all_cursors")}
                   </div>
                 )}
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                   {skzooVipCursorOptions.map((c) => (
                     <VipCursorGridCell
                       key={c.id}
                       c={c}
                       favoriteIds={favoriteVipCursorIds}
                       onSelect={applyVipCursorSelection}
                       onToggleFavorite={toggleVipCursorFavorite}
                       t={t}
                     />
                   ))}
                 </div>
               </div>
             </div>
             <button
               type="button"
               onClick={async () => {
                 const uid = profile?.id ?? user?.id;
                 if (!uid) {
                   showAlert(t("common.error"), t("me.login_favorites"));
                   return;
                 }
                 const { error } = await supabase.from("profiles").update({ cursor_url: null }).eq("user_id", uid);
                 if (error) {
                   showAlert(t("common.error"), profileCursorErrorMessage(error.message, t));
                   setCursorMenuOpen(false);
                   return;
                 }
                 try {
                   const localProfileStr = localStorage.getItem("me:profile");
                   if (localProfileStr) {
                     const parsed = JSON.parse(localProfileStr);
                     parsed.cursor_url = null;
                     localStorage.setItem("me:profile", JSON.stringify(parsed));
                   }
                 } catch {
                   /* ignore */
                 }
                 setActiveCursor(null);
                 refreshGlobal();
                 setCursorMenuOpen(false);
               }}
               style={{ width: "100%", padding: "12px", marginTop: "15px", borderRadius: "12px", background: "var(--bg-soft)", color: "var(--text-muted)", fontWeight: 900, border: "none", cursor: "pointer", transition: "background 0.2s" }}
             onMouseEnter={e => e.currentTarget.style.background = "var(--color-border)"}
             onMouseLeave={e => e.currentTarget.style.background = "var(--bg-soft)"}
             >
               {t('header.cursors_modal.remove_cursor')}
             </button>
          </div>
        </div>
      )}

      {/* --- ESTILOS GLOBALES --- */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .dropdown-item-hover:hover { background-color: var(--bg-soft) !important; }

        .action-btn-mini {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          min-width: 34px;
          min-height: 34px;
          max-width: 34px;
          max-height: 34px;
          box-sizing: border-box;
          border-radius: 10px;
          background-color: var(--bg-card);
          border: 1px solid var(--color-border);
          color: var(--header-btn-default);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          padding: 0;
          position: relative;
        }
        .action-btn-mini:hover {
          background-color: var(--bg-soft);
          transform: translateY(-2px);
          box-shadow: var(--shadow-card);
        }
        .action-btn-mini:active {
          transform: scale(0.95);
        }
        
       .notification-badge-mini {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          box-sizing: border-box;
          background: var(--accent-vibe-pink);
          color: var(--modal-cta-fg);
          font-size: 10px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 2px solid var(--bg-card);
          box-shadow: 0 2px 10px color-mix(in srgb, var(--accent-vibe-pink) 45%, transparent);
        }

        .header-mail-btn--unread {
          border-color: color-mix(in srgb, var(--accent-vibe-cyan) 55%, var(--color-border)) !important;
          color: var(--accent-vibe-cyan) !important;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--accent-vibe-cyan) 28%, transparent),
            0 4px 14px color-mix(in srgb, var(--accent-vibe-pink) 22%, transparent);
          animation: header-mail-glow 2.4s ease-in-out infinite;
        }

        @keyframes header-mail-glow {
          50% {
            box-shadow:
              0 0 0 2px color-mix(in srgb, var(--accent-vibe-cyan) 38%, transparent),
              0 6px 18px color-mix(in srgb, var(--accent-vibe-pink) 30%, transparent);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .header-mail-btn--unread {
            animation: none;
          }
        }

        .avatar-hover {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .avatar-hover:hover {
          transform: scale(1.1);
        }
      `}} />
      <div className="site-header-spacer" style={{ height: isMobile ? 102 : 90, width: "100%", flexShrink: 0 }} />
      {moreMenuOpen && (
        <>
          <button type="button" className="mobile-more-backdrop" aria-label={t("common.close") || "Cerrar"} onClick={closeAllMenus} />
          <div className="mobile-more-sheet" role="dialog" aria-label={t("menu.more") || "Más"}>
            {[
              { name: t("menu.albums"), path: "/albums", icon: Disc },
              { name: t("menu.merch"), path: "/merch", icon: Package },
              { name: t("menu.fanart"), path: "/fanart", icon: Paintbrush },
              { name: t("menu.fanzone"), path: "/fanzone", icon: MessageCircle },
              { name: t("menu.shop"), path: "/shop", icon: ShoppingBag },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} href={link.path} className="more-link" onClick={closeAllMenus}>
                  <Icon size={18} color="var(--color-primary)" />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </>
      )}
      <nav className="mobile-tabbar" aria-label={t("menu.home")}>
        {[
          { name: t("menu.home"), path: "/", icon: Home },
          { name: t("menu.library"), path: "/library", icon: LayoutGrid },
          { name: t("menu.binders"), path: "/binders", icon: BookHeart },
          { name: t("menu.market"), path: "/market", icon: Store },
        ].map((link) => {
          const Icon = link.icon;
          const isActive = link.path === "/" ? currentPath === "/" : currentPath.startsWith(link.path);
          return (
            <Link
              key={link.path}
              href={link.path}
              className={isActive ? "is-active" : ""}
              onClick={closeAllMenus}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              <span className="tab-label">{link.name}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={moreMenuOpen || ["/albums", "/merch", "/fanart", "/fanzone", "/shop"].some((p) => currentPath.startsWith(p)) ? "is-active" : ""}
          onClick={() => {
            const next = !moreMenuOpen;
            closeAllMenus();
            setMoreMenuOpen(next);
          }}
        >
          <Menu size={20} strokeWidth={moreMenuOpen ? 2.4 : 2} />
          <span className="tab-label">{t("menu.more") || "Más"}</span>
        </button>
      </nav>
      {activeCursor && !isMobile && (
        <div style={{ position: "fixed", left: 0, top: 0, width: 35, height: 35, pointerEvents: "none", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", transform: "translate3d(" + (mousePos.x + 22) + "px, " + (mousePos.y + 22) + "px, 0)", transition: "transform 0.05s linear" }}>
          <img src={activeCursor || undefined} alt="cursor" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      )}
    </>
  );
}

const dropdownItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", 
  textDecoration: "none", color: "var(--color-primary)", fontWeight: 700, fontSize: "13px", 
  borderRadius: "10px", transition: "all 0.2s", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left"
};