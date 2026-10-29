"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";
import { requireLoggedIn } from "@/lib/auth-gate";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { GOM_SOCIALS, emptyGomSocials, socialHref, websiteHref, type GomSocials } from "@/lib/gom";
import { GOM_CONTINENTS, GOM_COUNTRIES, cleanGomGroup, gomAreaMatches } from "@/lib/gom-areas";

type Comment = { id: string; userId: string; body: string; createdAt: string; name: string; avatar: string | null };
type GomCard = {
  id: string;
  userId: string;
  displayName: string;
  photoUrl: string;
  socials: GomSocials;
  url: string;
  goTypes: string;
  requirements: string;
  howItWorks: string;
  areas: string[];
  groups: string[];
  siteName: string;
  ratingAvg: number;
  ratingCount: number;
  myRating: number;
  comments: Comment[];
};
type Mine = { status: string; displayName: string } | null;

function PhotocardMark({ fill }: { fill: number }) {
  const amount = Math.max(0, Math.min(1, fill));
  const svg = (filled: boolean) => (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden>
      <rect x="1.2" y="1.2" width="19.6" height="23.6" rx="3" fill={filled ? "#8C659C" : "transparent"} stroke="#8C659C" strokeWidth="1.6" />
      <path
        d="M11 18.2l-.7-.6C7.6 15.2 6 13.8 6 12c0-1.4 1.1-2.5 2.5-2.5.8 0 1.5.4 2 .9.5-.5 1.2-.9 2-.9C13.9 9.5 15 10.6 15 12c0 1.8-1.6 3.2-4.3 5.6l-.7.6z"
        fill={filled ? "#fff" : "#8C659C"}
      />
    </svg>
  );
  return (
    <span style={{ position: "relative", display: "inline-block", width: 22, height: 26, lineHeight: 0 }}>
      {svg(false)}
      <span style={{ position: "absolute", left: 0, top: 0, width: `${amount * 100}%`, height: "100%", overflow: "hidden" }}>
        {svg(true)}
      </span>
    </span>
  );
}

function ScoreRow({ value, onPick }: { value: number; onPick?: (score: number) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((score) => {
        const fill = onPick ? (score <= value ? 1 : 0) : Math.max(0, Math.min(1, value - (score - 1)));
        const mark = <PhotocardMark fill={fill} />;
        if (!onPick) return <span key={score} style={{ lineHeight: 0 }}>{mark}</span>;
        return (
          <button
            key={score}
            type="button"
            aria-label={String(score)}
            onClick={() => onPick(score)}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", lineHeight: 0 }}
          >
            {mark}
          </button>
        );
      })}
    </span>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--bg-main)",
  color: "var(--text-main)",
  font: "inherit",
  fontWeight: 700,
};

export default function GomPanel({ search }: { search: string }) {
  const { t, showAlert, profile } = useGlobal();
  const [rows, setRows] = useState<GomCard[]>([]);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [mine, setMine] = useState<Mine>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    firstName: "",
    lastName: "",
    phone: "",
    url: "",
    goTypes: "",
    requirements: "",
    howItWorks: "",
    areas: [] as string[],
    groups: [] as string[],
    socials: emptyGomSocials(),
    photo: null as File | null,
    preview: "",
  });
  const [message, setMessage] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const [draftScore, setDraftScore] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [siteUser, setSiteUser] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userHits, setUserHits] = useState<{ id: string; name: string; avatar: string | null }[]>([]);
  const [groupDraft, setGroupDraft] = useState("");

  const load = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/gom", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const json = await res.json().catch(() => null);
    setRows(Array.isArray(json?.profiles) ? json.profiles : []);
    setGroupOptions(Array.isArray(json?.groups) ? json.groups : []);
    setMine(json?.mine || null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [profile?.id]);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    if (!formOpen) {
      setSiteUser(null);
      setUserQuery("");
      setUserHits([]);
      return;
    }
    if (profile?.id) {
      setSiteUser({ id: profile.id, name: profile.display_name || "MKBees", avatar: profile.avatar_url || null });
    }
  }, [formOpen, profile?.id, profile?.display_name, profile?.avatar_url]);

  useEffect(() => {
    const q = userQuery.trim();
    if (!formOpen || q.length < 2) {
      setUserHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(`/api/gom?userq=${encodeURIComponent(q)}`, { headers });
      const json = await res.json().catch(() => null);
      setUserHits(Array.isArray(json?.users) ? json.users : []);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [userQuery, formOpen]);

  const needLogin = () => requireLoggedIn(profile?.id, showAlert, t);

  const query = `${search} ${textFilter}`.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (areaFilter && !gomAreaMatches(row.areas || [], areaFilter)) return false;
    if (groupFilter && !(row.groups || []).some((name) => name.toLowerCase() === groupFilter.toLowerCase())) return false;
    if (!query) return true;
    const haystack = `${row.displayName} ${row.siteName} ${row.goTypes} ${row.requirements} ${(row.groups || []).join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });
  const areaLabel = (id: string) => {
    if (id === "worldwide") return t("market.gom.area_worldwide");
    if ((GOM_CONTINENTS as readonly string[]).includes(id)) return t(`market.gom.area_${id.replace("-", "_")}`);
    const country = GOM_COUNTRIES.find((item) => item.code === id);
    return country ? `${country.name} ${country.flag}` : id;
  };
  const addGroup = () => {
    const name = cleanGomGroup(groupDraft);
    if (!name || form.groups.some((have) => have.toLowerCase() === name.toLowerCase())) return;
    setForm({ ...form, groups: [...form.groups, name] });
    setGroupDraft("");
  };
  const addArea = (id: string) => {
    if (!id || form.areas.includes(id)) return;
    setForm({ ...form, areas: [...form.areas, id] });
  };
  const open = rows.find((row) => row.id === openId) || null;
  const contact = rows.find((row) => row.id === contactId) || null;
  const review = rows.find((row) => row.id === reviewId) || null;
  const commentList = rows.find((row) => row.id === commentsId) || null;

  const submit = async () => {
    if (!needLogin() || busy) return;
    const hasSocial = GOM_SOCIALS.some((field) => form.socials[field.key].trim());
    if (!siteUser) {
      showAlert(t("market.gom.signup"), t("market.gom.err_user"));
      return;
    }
    if (!form.areas.length) {
      showAlert(t("market.gom.signup"), t("market.gom.err_areas"));
      return;
    }
    if (!form.groups.length) {
      showAlert(t("market.gom.signup"), t("market.gom.err_groups"));
      return;
    }
    if (!form.displayName.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.goTypes.trim() || !form.requirements.trim() || !form.howItWorks.trim() || !form.photo) {
      showAlert(t("market.gom.signup"), t("market.gom.err_form"));
      return;
    }
    if (!hasSocial) {
      showAlert(t("market.gom.signup"), t("market.gom.err_social"));
      return;
    }
    const headers = await authHeaders();
    if (!headers) return;
    const body = new FormData();
    body.set("displayName", form.displayName);
    body.set("firstName", form.firstName);
    body.set("lastName", form.lastName);
    body.set("phone", form.phone);
    body.set("url", form.url);
    body.set("siteUserId", siteUser.id);
    body.set("goTypes", form.goTypes);
    body.set("requirements", form.requirements);
    body.set("howItWorks", form.howItWorks);
    body.set("areas", JSON.stringify(form.areas));
    body.set("groups", JSON.stringify(form.groups));
    for (const field of GOM_SOCIALS) body.set(field.key, form.socials[field.key]);
    if (form.photo) body.set("photo", form.photo);
    setBusy(true);
    const res = await fetch("/api/gom", { method: "POST", headers, body });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const code = json?.error;
      const key = code === "photo" ? "market.gom.err_photo" : code === "social" ? "market.gom.err_social" : code === "user" ? "market.gom.err_user" : code === "areas" ? "market.gom.err_areas" : code === "groups" ? "market.gom.err_groups" : code === "missing" ? "market.gom.err_form" : code === "auth" ? "auth.login_required_body" : "market.gom.err_save";
      showAlert(t("market.gom.signup"), t(key));
      return;
    }
    setFormOpen(false);
    showAlert(t("market.gom.signup"), t("market.gom.sent"));
    await load();
  };

  const openReview = (row: GomCard) => {
    if (!needLogin()) return;
    if (row.userId === profile?.id) {
      showAlert(t("market.gom.rate"), t("market.gom.err_own"));
      return;
    }
    setDraftScore(row.myRating || 0);
    setDraftComment("");
    setReviewId(row.id);
  };

  const publishReview = async () => {
    if (!review || busy) return;
    if (draftScore < 1) {
      showAlert(t("market.gom.rate"), t("market.gom.err_form"));
      return;
    }
    const headers = await authHeaders();
    if (!headers) return;
    setBusy(true);
    const rated = await fetch("/api/gom/rate", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ gomId: review.id, score: draftScore }),
    });
    if (!rated.ok) {
      setBusy(false);
      const json = await rated.json().catch(() => null);
      showAlert(t("market.gom.rate"), t(json?.error === "own" ? "market.gom.err_own" : "market.gom.err_save"));
      return;
    }
    const text = draftComment.trim();
    if (text) {
      const noted = await fetch("/api/gom/comment", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ gomId: review.id, text }),
      });
      if (!noted.ok) {
        setBusy(false);
        const json = await noted.json().catch(() => null);
        showAlert(t("market.gom.comments"), t(json?.error === "own" ? "market.gom.err_own" : "market.gom.err_save"));
        await load();
        return;
      }
    }
    setBusy(false);
    setReviewId(null);
    setDraftComment("");
    await load();
  };

  const sendContact = async () => {
    if (!contact || !needLogin() || busy) return;
    const headers = await authHeaders();
    if (!headers) return;
    setBusy(true);
    const res = await fetch("/api/gom/contact", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ gomId: contact.id, text: message }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      showAlert(t("market.gom.contact"), t(json?.error === "own" ? "market.gom.err_own" : "market.gom.err_save"));
      return;
    }
    setMessage("");
    setContactId(null);
    showAlert(t("market.gom.contact"), t("market.gom.message_sent"));
  };

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 800000,
    background: "rgba(42, 36, 64, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
  const sheet: React.CSSProperties = {
    width: "min(720px, 100%)",
    maxHeight: "min(90vh, 900px)",
    overflow: "auto",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    borderRadius: 24,
    border: "1px solid var(--color-border)",
    padding: 22,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 640 }}>
          <h2 className="tan-font" style={{ margin: 0, color: "var(--color-primary)", fontSize: 28 }}>{t("market.gom.title")}</h2>
          <p style={{ margin: "8px 0 0", fontWeight: 700, lineHeight: 1.5, color: "var(--text-muted)" }}>{t("market.gom.lead")}</p>
          {mine?.status === "pending" ? <p style={{ margin: "8px 0 0", fontWeight: 800, color: "var(--color-primary)" }}>{t("market.gom.pending")}</p> : null}
          {mine?.status === "rejected" ? <p style={{ margin: "8px 0 0", fontWeight: 800 }}>{t("market.gom.rejected")}</p> : null}
        </div>
        <button
          type="button"
          className="tan-font"
          onClick={() => {
            if (!needLogin()) return;
            setFormOpen(true);
          }}
          style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "12px 18px", fontWeight: 800, cursor: "pointer" }}
        >
          {t("market.gom.signup")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select value={areaFilter} aria-label={t("market.gom.filter_country")} onChange={(e) => setAreaFilter(e.target.value)} style={{ ...fieldStyle, width: "auto", minWidth: 180 }}>
          <option value="">{t("market.gom.area_all")}</option>
          <option value="worldwide">{t("market.gom.area_worldwide")}</option>
          {GOM_CONTINENTS.map((id) => <option key={id} value={id}>{t(`market.gom.area_${id.replace("-", "_")}`)}</option>)}
          {GOM_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name} {country.flag}</option>)}
        </select>
        <select value={groupFilter} aria-label={t("market.gom.filter_group")} onChange={(e) => setGroupFilter(e.target.value)} style={{ ...fieldStyle, width: "auto", minWidth: 180 }}>
          <option value="">{t("market.gom.filter_all_groups")}</option>
          {groupOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <input value={textFilter} placeholder={t("market.gom.search")} aria-label={t("market.gom.search")} onChange={(e) => setTextFilter(e.target.value)} style={{ ...fieldStyle, width: "min(280px, 100%)" }} />
      </div>

      {loading ? (
        <p style={{ fontWeight: 800, color: "var(--text-muted)" }}>{t("common.page_loading_title")}</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 16px", border: "1px dashed var(--color-border)", borderRadius: 20, fontWeight: 800, color: "var(--color-primary)" }}>
          {rows.length === 0 ? t("market.gom.empty") : t("market.gom.filter_empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((row) => (
            <article key={row.id} style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: 14 }}>
              <button type="button" onClick={() => setOpenId(row.id)} style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0, border: "none", background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", padding: 0 }}>
                <img src={row.photoUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 16, background: "var(--bg-soft)", flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 18 }}>{row.displayName}</strong>
                  {row.siteName ? <span style={{ display: "block", marginTop: 2, color: "#8C659C", fontWeight: 800, fontSize: 13 }}>{row.siteName}</span> : null}
                  <span style={{ display: "block", marginTop: 4, color: "var(--text-muted)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(row.groups || []).join(" · ") || row.goTypes}</span>
                </span>
              </button>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button type="button" aria-label={`${t("market.gom.avg", { n: Number(row.ratingAvg || 0).toFixed(1) })}`} onClick={() => openReview(row)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "#8C659C", fontWeight: 900 }}>
                  <ScoreRow value={Number(row.ratingAvg) || 0} />
                  <span>{Number(row.ratingAvg || 0).toFixed(1)}</span>
                </button>
                <button type="button" aria-label={t("market.gom.comments")} onClick={() => setCommentsId(row.id)} style={{ border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "#8C659C", borderRadius: 999, minWidth: 36, height: 36, padding: "0 10px", fontWeight: 900, cursor: "pointer" }}>
                  {row.comments.length}
                </button>
              </span>
              <button type="button" onClick={() => { if (!needLogin()) return; setContactId(row.id); setMessage(""); }} style={{ border: "1px solid #8C659C", background: "transparent", color: "#8C659C", borderRadius: 999, padding: "10px 14px", fontWeight: 900, cursor: "pointer", flexShrink: 0 }}>
                {t("market.gom.contact")}
              </button>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div data-kbd-root role="dialog" aria-modal="true" style={overlay}>
          <div style={sheet}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <img src={open.photoUrl} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 18 }} />
              <div style={{ flex: 1 }}>
                <h3 className="tan-font" style={{ margin: 0, fontSize: 28, color: "var(--color-primary)" }}>{open.displayName}</h3>
                {open.siteName ? <a href={`/user/${open.userId}`} style={{ color: "#8C659C", fontWeight: 800, fontSize: 14 }}>{open.siteName}</a> : null}
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" aria-label={`${t("market.gom.avg", { n: Number(open.ratingAvg || 0).toFixed(1) })}`} onClick={() => openReview(open)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "#8C659C", fontWeight: 900 }}>
                    <ScoreRow value={Number(open.ratingAvg) || 0} />
                    <span>{Number(open.ratingAvg || 0).toFixed(1)}</span>
                  </button>
                  <button type="button" aria-label={t("market.gom.comments")} onClick={() => setCommentsId(open.id)} style={{ border: "1px solid var(--color-border)", background: "var(--bg-main)", color: "#8C659C", borderRadius: 999, minWidth: 36, height: 32, padding: "0 10px", fontWeight: 900, cursor: "pointer" }}>
                    {open.comments.length}
                  </button>
                </div>
              </div>
            </div>
            {open.url ? (
              <p style={{ margin: "14px 0 0", fontWeight: 800 }}>
                <a href={websiteHref(open.url) || undefined} target="_blank" rel="noreferrer" style={{ color: "#8C659C" }}>{open.url}</a>
              </p>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {GOM_SOCIALS.filter((field) => open.socials[field.key]).map((field) => {
                const href = socialHref(field.key, open.socials[field.key]);
                const label = `${field.label}: ${open.socials[field.key]}`;
                return href ? (
                  <a key={field.key} href={href} target="_blank" rel="noreferrer" style={{ color: "#8C659C", fontWeight: 800, fontSize: 13 }}>{label}</a>
                ) : (
                  <span key={field.key} style={{ fontWeight: 800, fontSize: 13 }}>{label}</span>
                );
              })}
            </div>
            {(open.groups || []).length ? (
              <p style={{ margin: "14px 0 0", fontWeight: 800 }}>{t("market.gom.groups")}: {open.groups.join(" · ")}</p>
            ) : null}
            {(open.areas || []).length ? (
              <p style={{ margin: "8px 0 0", fontWeight: 800 }}>{t("market.gom.areas")}: {open.areas.map(areaLabel).join(" · ")}</p>
            ) : null}
            {[
              [t("market.gom.go_types"), open.goTypes],
              [t("market.gom.requirements"), open.requirements],
              [t("market.gom.how"), open.howItWorks],
            ].map(([label, text]) => (
              <section key={label} style={{ marginTop: 16 }}>
                <h4 style={{ margin: "0 0 6px", color: "#8C659C" }}>{label}</h4>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5, fontWeight: 700 }}>{text}</p>
              </section>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" data-kbd="cancel" onClick={() => setOpenId(null)} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button>
              <button type="button" onClick={() => { setOpenId(null); setContactId(open.id); setMessage(""); }} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("market.gom.contact")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {review ? (
        <div data-kbd-root role="dialog" aria-modal="true" style={{ ...overlay, zIndex: 820000 }}>
          <form
            style={{ ...sheet, width: "min(480px, 100%)" }}
            onSubmit={(e) => {
              e.preventDefault();
              void publishReview();
            }}
          >
            <h3 className="tan-font" style={{ marginTop: 0, color: "var(--color-primary)" }}>{t("market.gom.rate")}</h3>
            <p style={{ margin: "0 0 12px", fontWeight: 800 }}>{review.displayName}</p>
            <ScoreRow value={draftScore} onPick={setDraftScore} />
            <textarea value={draftComment} onChange={(e) => setDraftComment(e.target.value)} placeholder={t("market.gom.comment_placeholder")} style={{ ...fieldStyle, minHeight: 120, marginTop: 16 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" data-kbd="cancel" onClick={() => setReviewId(null)} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button>
              <button type="submit" data-kbd="confirm" disabled={busy} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("market.gom.comment_send")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {commentList ? (
        <div data-kbd-root role="dialog" aria-modal="true" style={{ ...overlay, zIndex: 820000 }}>
          <div style={{ ...sheet, width: "min(520px, 100%)" }}>
            <h3 className="tan-font" style={{ marginTop: 0, color: "var(--color-primary)" }}>{t("market.gom.comments")}</h3>
            <p style={{ margin: "0 0 12px", fontWeight: 800 }}>{commentList.displayName}</p>
            {commentList.comments.length === 0 ? (
              <p style={{ fontWeight: 700, color: "var(--text-muted)" }}>{t("market.gom.no_comments")}</p>
            ) : commentList.comments.map((item) => (
              <div key={item.id} style={{ padding: "10px 0", borderTop: "1px solid var(--color-border)" }}>
                <strong>{item.name}</strong>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{item.body}</p>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" data-kbd="cancel" onClick={() => setCommentsId(null)} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div data-kbd-root role="dialog" aria-modal="true" style={overlay}>
          <form
            style={sheet}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h3 className="tan-font" style={{ margin: "0 0 6px", color: "var(--color-primary)", fontSize: 26 }}>{t("market.gom.signup")}</h3>
            <p style={{ margin: "0 0 14px", fontWeight: 700, color: "var(--text-muted)" }}>{t("market.gom.private_note")}</p>
            {mine?.status === "approved" ? <p style={{ fontWeight: 800 }}>{t("market.gom.edit_hides")}</p> : null}
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontWeight: 800, fontSize: 13 }}>{t("market.gom.site_user")}</label>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--text-muted)" }}>{t("market.gom.site_user_hint")}</p>
              {siteUser ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid #8C659C", borderRadius: 12, padding: "8px 12px" }}>
                  <strong>{siteUser.name}</strong>
                  {isAdminTeamEmail(profile?.email) ? <button type="button" onClick={() => setSiteUser(null)} style={{ border: "none", background: "transparent", color: "#8C659C", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button> : null}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  <input value={userQuery} placeholder={t("market.gom.site_user")} style={fieldStyle} onChange={(e) => setUserQuery(e.target.value)} />
                  {userHits.map((hit) => (
                    <button key={hit.id} type="button" onClick={() => { setSiteUser(hit); setUserQuery(""); setUserHits([]); }} style={{ textAlign: "left", border: "1px solid var(--color-border)", background: "var(--bg-card)", borderRadius: 12, padding: "8px 12px", fontWeight: 800, cursor: "pointer", color: "inherit" }}>
                      {hit.name}
                    </button>
                  ))}
                </div>
              )}
              <input required value={form.displayName} placeholder={t("market.gom.known_as")} style={fieldStyle} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input required value={form.firstName} placeholder={t("market.gom.first_name")} style={fieldStyle} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <input required value={form.lastName} placeholder={t("market.gom.last_name")} style={fieldStyle} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <input required value={form.phone} placeholder={t("market.gom.phone")} style={fieldStyle} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input value={form.url} placeholder={t("market.gom.url_optional")} inputMode="url" style={fieldStyle} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <label style={{ fontWeight: 800, fontSize: 13 }}>{t("market.gom.photo")}</label>
              <input required={!form.preview} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setForm({ ...form, photo: file, preview: file ? URL.createObjectURL(file) : "" });
              }} />
              {form.preview ? <img src={form.preview} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 16 }} /> : null}
              <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: 13, color: "var(--text-muted)" }}>{t("market.gom.social_hint")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {GOM_SOCIALS.map((field) => (
                  <input key={field.key} value={form.socials[field.key]} placeholder={field.label} style={fieldStyle} onChange={(e) => setForm({ ...form, socials: { ...form.socials, [field.key]: e.target.value } })} />
                ))}
              </div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>{t("market.gom.areas")}</label>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--text-muted)" }}>{t("market.gom.areas_hint")}</p>
              <select value="" aria-label={t("market.gom.areas")} onChange={(e) => addArea(e.target.value)} style={fieldStyle}>
                <option value="">{t("market.gom.area_pick")}</option>
                <option value="worldwide">{t("market.gom.area_worldwide")}</option>
                {GOM_CONTINENTS.map((id) => <option key={id} value={id}>{t(`market.gom.area_${id.replace("-", "_")}`)}</option>)}
                {GOM_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name} {country.flag}</option>)}
              </select>
              {form.areas.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {form.areas.map((id) => (
                    <button key={id} type="button" onClick={() => setForm({ ...form, areas: form.areas.filter((item) => item !== id) })} style={{ border: "1px solid #8C659C", background: "transparent", color: "#8C659C", borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>
                      {areaLabel(id)} ×
                    </button>
                  ))}
                </div>
              ) : null}
              <label style={{ fontWeight: 800, fontSize: 13 }}>{t("market.gom.groups")}</label>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--text-muted)" }}>{t("market.gom.groups_hint")}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  data-kbd-add=""
                  value={groupDraft}
                  list="gom-group-options"
                  placeholder={t("market.gom.group_placeholder")}
                  style={fieldStyle}
                  onChange={(e) => setGroupDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    e.stopPropagation();
                    addGroup();
                  }}
                />
                <button type="button" onClick={addGroup} style={{ border: "1px solid #8C659C", background: "transparent", color: "#8C659C", borderRadius: 12, padding: "0 14px", fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{t("market.gom.group_add")}</button>
              </div>
              <datalist id="gom-group-options">
                {groupOptions.map((name) => <option key={name} value={name} />)}
              </datalist>
              {form.groups.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {form.groups.map((name) => (
                    <button key={name} type="button" onClick={() => setForm({ ...form, groups: form.groups.filter((item) => item !== name) })} style={{ border: "1px solid #8C659C", background: "transparent", color: "#8C659C", borderRadius: 999, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>
                      {name} ×
                    </button>
                  ))}
                </div>
              ) : null}
              <textarea required value={form.goTypes} placeholder={t("market.gom.go_types")} style={{ ...fieldStyle, minHeight: 80 }} onChange={(e) => setForm({ ...form, goTypes: e.target.value })} />
              <textarea required value={form.requirements} placeholder={t("market.gom.requirements")} style={{ ...fieldStyle, minHeight: 80 }} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
              <textarea required value={form.howItWorks} placeholder={t("market.gom.how_hint")} style={{ ...fieldStyle, minHeight: 100 }} onChange={(e) => setForm({ ...form, howItWorks: e.target.value })} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" data-kbd="cancel" onClick={() => setFormOpen(false)} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button>
              <button type="submit" data-kbd="confirm" disabled={busy} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("market.gom.submit")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {contact ? (
        <div data-kbd-root role="dialog" aria-modal="true" style={overlay}>
          <form style={{ ...sheet, width: "min(480px, 100%)" }} onSubmit={(e) => { e.preventDefault(); void sendContact(); }}>
            <h3 className="tan-font" style={{ marginTop: 0, color: "var(--color-primary)" }}>{t("market.gom.contact_title")}</h3>
            <p style={{ fontWeight: 800 }}>{contact.siteName || contact.displayName}</p>
            <textarea required value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("market.gom.contact_placeholder")} style={{ ...fieldStyle, minHeight: 120 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" data-kbd="cancel" onClick={() => setContactId(null)} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button>
              <button type="submit" data-kbd="confirm" disabled={busy} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("market.gom.contact_send")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
