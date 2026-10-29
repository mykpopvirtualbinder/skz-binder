import { randomUUID } from "crypto";
import { Resend } from "resend";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";
import { SIGNATURE_URL, signatureHtml, signatureImage, withSignatureText } from "@/lib/mail-signature";

export type AuthMailKind = "signup" | "recovery";

const LOCALES = ["es", "en", "fr", "de", "it", "pt", "id", "th", "ja", "ko", "zh"] as const;

const ALLOWED_HOSTS = new Set([
  "localhost",
  "mykpopbinder.com",
  "www.mykpopbinder.com",
  "mykpopbinder.es",
  "www.mykpopbinder.es",
  "mykpopbinder.eu",
  "www.mykpopbinder.eu",
]);

const COPY: Record<string, Record<AuthMailKind, { subject: string; text: string }>> = {
  es: {
    signup: {
      subject: "Confirma tu cuenta en My K-pop Binder",
      text: "Hola,\n\nPulsa este enlace para confirmar tu correo y activar tu cuenta:\n\n{{link}}\n\nSi no has creado la cuenta, puedes ignorar este mensaje.",
    },
    recovery: {
      subject: "Restablece tu contraseña de My K-pop Binder",
      text: "Hola,\n\nPulsa este enlace para elegir una contraseña nueva:\n\n{{link}}\n\nSi no lo has pedido, puedes ignorar este mensaje.",
    },
  },
  en: {
    signup: {
      subject: "Confirm your My K-pop Binder account",
      text: "Hello,\n\nOpen this link to confirm your email and activate your account:\n\n{{link}}\n\nIf you did not create this account, you can ignore this message.",
    },
    recovery: {
      subject: "Reset your My K-pop Binder password",
      text: "Hello,\n\nOpen this link to choose a new password:\n\n{{link}}\n\nIf you did not ask for this, you can ignore this message.",
    },
  },
  fr: {
    signup: {
      subject: "Confirme ton compte My K-pop Binder",
      text: "Bonjour,\n\nOuvre ce lien pour confirmer ton e-mail et activer ton compte :\n\n{{link}}\n\nSi tu n'as pas créé ce compte, ignore ce message.",
    },
    recovery: {
      subject: "Réinitialise ton mot de passe My K-pop Binder",
      text: "Bonjour,\n\nOuvre ce lien pour choisir un nouveau mot de passe :\n\n{{link}}\n\nSi tu n'as pas fait cette demande, ignore ce message.",
    },
  },
  de: {
    signup: {
      subject: "Bestätige dein My K-pop Binder-Konto",
      text: "Hallo,\n\nÖffne diesen Link, um deine E-Mail zu bestätigen und dein Konto zu aktivieren:\n\n{{link}}\n\nWenn du das Konto nicht erstellt hast, ignoriere diese Nachricht.",
    },
    recovery: {
      subject: "Setze dein My K-pop Binder-Passwort zurück",
      text: "Hallo,\n\nÖffne diesen Link, um ein neues Passwort zu wählen:\n\n{{link}}\n\nWenn du das nicht angefordert hast, ignoriere diese Nachricht.",
    },
  },
  it: {
    signup: {
      subject: "Conferma il tuo account My K-pop Binder",
      text: "Ciao,\n\nApri questo link per confermare la tua email e attivare l'account:\n\n{{link}}\n\nSe non hai creato tu l'account, ignora questo messaggio.",
    },
    recovery: {
      subject: "Reimposta la password di My K-pop Binder",
      text: "Ciao,\n\nApri questo link per scegliere una nuova password:\n\n{{link}}\n\nSe non lo hai richiesto, ignora questo messaggio.",
    },
  },
  pt: {
    signup: {
      subject: "Confirma a tua conta My K-pop Binder",
      text: "Olá,\n\nAbre este link para confirmar o teu email e ativar a conta:\n\n{{link}}\n\nSe não criaste esta conta, ignora esta mensagem.",
    },
    recovery: {
      subject: "Repõe a tua palavra-passe do My K-pop Binder",
      text: "Olá,\n\nAbre este link para escolher uma palavra-passe nova:\n\n{{link}}\n\nSe não pediste isto, ignora esta mensagem.",
    },
  },
  id: {
    signup: {
      subject: "Konfirmasi akun My K-pop Binder kamu",
      text: "Halo,\n\nBuka tautan ini untuk mengonfirmasi email dan mengaktifkan akun:\n\n{{link}}\n\nJika kamu tidak membuat akun ini, abaikan pesan ini.",
    },
    recovery: {
      subject: "Atur ulang kata sandi My K-pop Binder",
      text: "Halo,\n\nBuka tautan ini untuk memilih kata sandi baru:\n\n{{link}}\n\nJika kamu tidak meminta ini, abaikan pesan ini.",
    },
  },
  th: {
    signup: {
      subject: "ยืนยันบัญชี My K-pop Binder ของคุณ",
      text: "สวัสดี\n\nเปิดลิงก์นี้เพื่อยืนยันอีเมลและเปิดใช้งานบัญชี:\n\n{{link}}\n\nหากคุณไม่ได้สร้างบัญชีนี้ ให้ข้ามอีเมลนี้ได้",
    },
    recovery: {
      subject: "ตั้งรหัสผ่าน My K-pop Binder ใหม่",
      text: "สวัสดี\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:\n\n{{link}}\n\nหากคุณไม่ได้ขอรหัสใหม่ ให้ข้ามอีเมลนี้ได้",
    },
  },
  ja: {
    signup: {
      subject: "My K-pop Binder のアカウントを確認してください",
      text: "こんにちは。\n\nこのリンクを開いてメールアドレスを確認し、アカウントを有効にしてください。\n\n{{link}}\n\n身に覚えがない場合は、このメールを無視してください。",
    },
    recovery: {
      subject: "My K-pop Binder のパスワードを再設定",
      text: "こんにちは。\n\nこのリンクを開いて、新しいパスワードを設定してください。\n\n{{link}}\n\n身に覚えがない場合は、このメールを無視してください。",
    },
  },
  ko: {
    signup: {
      subject: "My K-pop Binder 계정을 확인해 주세요",
      text: "안녕하세요.\n\n이 링크를 열어 이메일을 확인하고 계정을 활성화해 주세요.\n\n{{link}}\n\n직접 가입하지 않았다면 이 메일은 무시해도 됩니다.",
    },
    recovery: {
      subject: "My K-pop Binder 비밀번호 재설정",
      text: "안녕하세요.\n\n이 링크를 열어 새 비밀번호를 설정해 주세요.\n\n{{link}}\n\n직접 요청하지 않았다면 이 메일은 무시해도 됩니다.",
    },
  },
  zh: {
    signup: {
      subject: "请确认你的 My K-pop Binder 账户",
      text: "你好，\n\n打开此链接以确认邮箱并激活账户：\n\n{{link}}\n\n如果这不是你的操作，请忽略这封邮件。",
    },
    recovery: {
      subject: "重置 My K-pop Binder 密码",
      text: "你好，\n\n打开此链接以设置新密码：\n\n{{link}}\n\n如果这不是你的操作，请忽略这封邮件。",
    },
  },
};

export function normalizeAuthLanguage(value: string | null | undefined): string {
  const base = (value || "es").toLowerCase().split("-")[0];
  return (LOCALES as readonly string[]).includes(base) ? base : "en";
}

export function allowedAuthRedirect(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) return null;
    if (host !== "localhost" && url.protocol !== "https:") return null;
    if (host === "localhost" && url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BUTTONS: Record<string, Record<AuthMailKind, { cta: string; fallback: string }>> = {
  es: { signup: { cta: "Confirmar mi cuenta", fallback: "Si el botón no se abre, copia este enlace:" }, recovery: { cta: "Elegir contraseña nueva", fallback: "Si el botón no se abre, copia este enlace:" } },
  en: { signup: { cta: "Confirm my account", fallback: "If the button does not open, copy this link:" }, recovery: { cta: "Choose a new password", fallback: "If the button does not open, copy this link:" } },
  fr: { signup: { cta: "Confirmer mon compte", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" }, recovery: { cta: "Choisir un nouveau mot de passe", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" } },
  de: { signup: { cta: "Konto bestätigen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" }, recovery: { cta: "Neues Passwort wählen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" } },
  it: { signup: { cta: "Conferma il mio account", fallback: "Se il pulsante non si apre, copia questo link:" }, recovery: { cta: "Scegli una nuova password", fallback: "Se il pulsante non si apre, copia questo link:" } },
  pt: { signup: { cta: "Confirmar a minha conta", fallback: "Se o botão não abrir, copia este link:" }, recovery: { cta: "Escolher uma palavra-passe nova", fallback: "Se o botão não abrir, copia este link:" } },
  id: { signup: { cta: "Konfirmasi akun saya", fallback: "Jika tombol tidak terbuka, salin tautan ini:" }, recovery: { cta: "Pilih kata sandi baru", fallback: "Jika tombol tidak terbuka, salin tautan ini:" } },
  th: { signup: { cta: "ยืนยันบัญชีของฉัน", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" }, recovery: { cta: "ตั้งรหัสผ่านใหม่", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" } },
  ja: { signup: { cta: "アカウントを確認", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" }, recovery: { cta: "新しいパスワードを設定", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" } },
  ko: { signup: { cta: "계정 확인", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." }, recovery: { cta: "새 비밀번호 설정", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." } },
  zh: { signup: { cta: "确认我的账户", fallback: "如果按钮打不开，请复制这个链接：" }, recovery: { cta: "设置新密码", fallback: "如果按钮打不开，请复制这个链接：" } },
};

function mailHtml(opts: { intro: string; ignore: string; link: string; cta: string; fallback: string; imageSrc: string }) {
  const link = escapeHtml(opts.link);
  const intro = escapeHtml(opts.intro).replace(/\n/g, "<br>");
  const ignore = escapeHtml(opts.ignore).replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f1f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1f8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #eadff0;border-radius:24px;">
<tr><td align="center" style="padding:32px 28px 0;"><img src="https://www.mykpopbinder.com/branding/logo.png" width="120" alt="My K-pop Binder" style="display:block;border:0;width:120px;height:auto;"></td></tr>
<tr><td align="center" style="padding:14px 28px 0;font-family:Georgia,serif;font-size:12px;letter-spacing:0.18em;color:#8C659C;font-weight:700;">MY K-POP BINDER</td></tr>
<tr><td align="center" style="padding:6px 28px 0;font-family:Georgia,serif;font-size:15px;font-style:italic;color:#8C659C;">Collect · Trade · Connect</td></tr>
<tr><td align="center" style="padding:22px 32px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#2a2440;">${intro}</td></tr>
<tr><td align="center" style="padding:26px 28px 8px;"><a href="${link}" style="display:inline-block;background:#8C659C;color:#ffffff;text-decoration:none;font-family:Georgia,serif;font-size:15px;font-weight:700;padding:14px 28px;border-radius:999px;">${escapeHtml(opts.cta)}</a></td></tr>
<tr><td align="center" style="padding:8px 32px 0;font-family:Georgia,serif;font-size:12px;line-height:1.5;color:#7a7088;">${escapeHtml(opts.fallback)}<br><a href="${link}" style="color:#8C659C;word-break:break-all;">${link}</a></td></tr>
<tr><td align="center" style="padding:16px 32px 8px;font-family:Georgia,serif;font-size:13px;line-height:1.5;color:#7a7088;">${ignore}</td></tr>
<tr><td align="center" style="padding:8px 28px 28px;">${signatureHtml(opts.imageSrc)}</td></tr>
</table>
</td></tr></table></body></html>`;
}

export async function sendAuthLinkEmail(opts: {
  to: string;
  link: string;
  kind: AuthMailKind;
  language?: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_MISSING");
  const lang = normalizeAuthLanguage(opts.language);
  const copy = COPY[lang][opts.kind];
  const buttons = BUTTONS[lang][opts.kind];
  const [intro, ignore = ""] = copy.text.split("{{link}}");
  const body = copy.text.replace("{{link}}", opts.link);
  const image = signatureImage();
  const resend = new Resend(key);
  const payload = {
    from: `STAFF My K-Pop Binder <${SITE_ADMIN_EMAIL}>`,
    to: opts.to,
    subject: copy.subject,
    text: withSignatureText(body),
    html: mailHtml({
      intro: intro.trim(),
      ignore: ignore.trim(),
      link: opts.link,
      cta: buttons.cta,
      fallback: buttons.fallback,
      imageSrc: image ? "cid:staff-signature" : SIGNATURE_URL,
    }),
    attachments: image
      ? [{ filename: "signature.jpg", content: image, contentType: "image/jpeg", contentId: "staff-signature" }]
      : undefined,
  };
  const messageId = `<${randomUUID()}@mykpopbinder.com>`;
  const first = await resend.emails.send({
    ...payload,
    headers: { "Message-ID": messageId },
  });
  if (!first.error) return;
  if (!/message-id/i.test(first.error.message || "")) {
    throw new Error(first.error.message || "rejected");
  }
  const second = await resend.emails.send(payload);
  if (second.error) throw new Error(second.error.message || "rejected");
}
