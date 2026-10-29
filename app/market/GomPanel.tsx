"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobal } from "../context/GlobalContext";
import { requireLoggedIn } from "@/lib/auth-gate";
import { GOM_SOCIALS, emptyGomSocials, socialHref, websiteHref, type GomSocials } from "@/lib/gom";

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
  ratingAvg: number;
  ratingCount: number;
  myRating: number;
  comments: Comment[];
};
type Mine = { status: string; displayName: string } | null;

function PhotocardMark({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden>
      <rect x="1.2" y="1.2" width="19.6" height="23.6" rx="3" fill={filled ? "#8C659C" : "transparent"} stroke="#8C659C" strokeWidth="1.6" />
      <path
        d="M11 18.2l-.7-.6C7.6 15.2 6 13.8 6 12c0-1.4 1.1-2.5 2.5-2.5.8 0 1.5.4 2 .9.5-.5 1.2-.9 2-.9C13.9 9.5 15 10.6 15 12c0 1.8-1.6 3.2-4.3 5.6l-.7.6z"
        fill={filled ? "#fff" : "#8C659C"}
      />
    </svg>
  );
}

function ScoreRow({ value, onPick }: { value: number; onPick?: (score: number) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          aria-label={String(score)}
          disabled={!onPick}
          onClick={() => onPick?.(score)}
          style={{ border: "none", background: "transparent", padding: 0, cursor: onPick ? "pointer" : "default", lineHeight: 0 }}
        >
          <PhotocardMark filled={score <= value} />
        </button>
      ))}
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
    socials: emptyGomSocials(),
    photo: null as File | null,
    preview: "",
  });
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");

  const load = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/gom", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const json = await res.json().catch(() => null);
    setRows(Array.isArray(json?.profiles) ? json.profiles : []);
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

  const needLogin = () => requireLoggedIn(profile?.id, showAlert, t);

  const query = search.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (!query) return true;
    return `${row.displayName} ${row.goTypes} ${row.requirements}`.toLowerCase().includes(query);
  });
  const open = rows.find((row) => row.id === openId) || null;
  const contact = rows.find((row) => row.id === contactId) || null;

  const submit = async () => {
    if (!needLogin() || busy) return;
    const hasSocial = GOM_SOCIALS.some((field) => form.socials[field.key].trim());
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
    body.set("goTypes", form.goTypes);
    body.set("requirements", form.requirements);
    body.set("howItWorks", form.howItWorks);
    for (const field of GOM_SOCIALS) body.set(field.key, form.socials[field.key]);
    if (form.photo) body.set("photo", form.photo);
    setBusy(true);
    const res = await fetch("/api/gom", { method: "POST", headers, body });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const code = json?.error;
      const key = code === "photo" ? "market.gom.err_photo" : code === "social" ? "market.gom.err_social" : code === "missing" ? "market.gom.err_form" : code === "auth" ? "auth.login_required_body" : "market.gom.err_save";
      showAlert(t("market.gom.signup"), t(key));
      return;
    }
    setFormOpen(false);
    showAlert(t("market.gom.signup"), t("market.gom.sent"));
    await load();
  };

  const rate = async (gomId: string, score: number) => {
    if (!needLogin()) return;
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/gom/rate", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ gomId, score }),
    });
    if (!res.ok) {
      showAlert(t("market.gom.rate"), t("market.gom.err_own"));
      return;
    }
    await load();
  };

  const sendComment = async () => {
    if (!open || !needLogin() || busy) return;
    const headers = await authHeaders();
    if (!headers) return;
    setBusy(true);
    const res = await fetch("/api/gom/comment", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ gomId: open.id, text: comment }),
    });
    setBusy(false);
    if (!res.ok) {
      showAlert(t("market.gom.comments"), t("market.gom.err_own"));
      return;
    }
    setComment("");
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
      showAlert(t("market.gom.contact"), t("market.gom.err_own"));
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

      {loading ? (
        <p style={{ fontWeight: 800, color: "var(--text-muted)" }}>{t("common.page_loading_title")}</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 16px", border: "1px dashed var(--color-border)", borderRadius: 20, fontWeight: 800, color: "var(--color-primary)" }}>
          {t("market.gom.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((row) => (
            <article key={row.id} style={{ display: "flex", gap: 16, alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: 14 }}>
              <button type="button" onClick={() => setOpenId(row.id)} style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0, border: "none", background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", padding: 0 }}>
                <img src={row.photoUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 16, background: "var(--bg-soft)", flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 18 }}>{row.displayName}</strong>
                  <span style={{ display: "block", marginTop: 4, color: "var(--text-muted)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.goTypes}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <ScoreRow value={Math.round(row.ratingAvg)} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>{row.ratingCount}</span>
                  </span>
                </span>
              </button>
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
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <ScoreRow value={open.myRating} onPick={open.userId === profile?.id ? undefined : (score) => void rate(open.id, score)} />
                  <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>{open.ratingAvg || "–"} · {open.ratingCount}</span>
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
            <section style={{ marginTop: 18 }}>
              <h4 style={{ margin: "0 0 8px", color: "#8C659C" }}>{t("market.gom.comments")}</h4>
              {open.comments.length === 0 ? <p style={{ fontWeight: 700, color: "var(--text-muted)" }}>{t("market.gom.no_comments")}</p> : open.comments.map((item) => (
                <div key={item.id} style={{ padding: "10px 0", borderTop: "1px solid var(--color-border)" }}>
                  <strong>{item.name}</strong>
                  <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{item.body}</p>
                </div>
              ))}
              {open.userId !== profile?.id ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("market.gom.comment_placeholder")} style={{ ...fieldStyle, minHeight: 72 }} />
                  <button type="button" data-kbd="confirm" disabled={busy} onClick={() => void sendComment()} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 12, padding: "0 14px", fontWeight: 900, cursor: "pointer" }}>{t("market.gom.comment_send")}</button>
                </div>
              ) : null}
            </section>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" data-kbd="cancel" onClick={() => setOpenId(null)} style={{ border: "1px solid var(--color-border)", background: "transparent", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("common.close")}</button>
              <button type="button" onClick={() => { setOpenId(null); setContactId(open.id); setMessage(""); }} style={{ border: "none", background: "#8C659C", color: "#fff", borderRadius: 999, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("market.gom.contact")}</button>
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
            <p style={{ fontWeight: 800 }}>{contact.displayName}</p>
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
