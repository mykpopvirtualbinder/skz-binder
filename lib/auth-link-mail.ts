import { randomUUID } from "crypto";
import { Resend } from "resend";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";
import { SIGNATURE_URL, signatureHtml, signatureImage, withSignatureText } from "@/lib/mail-signature";

export type AuthMailKind = "signup" | "recovery" | "remind_24" | "remind_48" | "remind_72";

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
    remind_24: {
      subject: "Confirma tu cuenta en My K-pop Binder",
      text: "Hola,\n\nTu cuenta sigue sin confirmar. Pulsa este enlace para activarla:\n\n{{link}}\n\nSi no confirmas, te lo recordaremos a las 48 y a las 72 horas. Pasado ese plazo, anulamos el alta y tu usuario queda libre. Si no has creado la cuenta, ignora este mensaje.",
    },
    remind_48: {
      subject: "Sigue pendiente confirmar tu cuenta",
      text: "Hola,\n\nAún no has confirmado el correo. Este enlace sustituye al anterior:\n\n{{link}}\n\nTe queda un último aviso a las 72 horas. Si no confirmas, anulamos el alta y tu usuario queda libre. Si no has creado la cuenta, ignora este mensaje.",
    },
    remind_72: {
      subject: "Último aviso: confirma tu cuenta",
      text: "Hola,\n\nEste es el último aviso. Pulsa este enlace para confirmar tu correo. El enlace anterior deja de valer:\n\n{{link}}\n\nSi no confirmas en las próximas 24 horas, anulamos el alta y liberamos tu usuario. Tendrás que registrarte de nuevo. Si no has creado la cuenta, ignora este mensaje.",
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
    remind_24: {
      subject: "Your My K-pop Binder account is still unconfirmed",
      text: "Hello,\n\nYour account is still unconfirmed. Open this link to activate it:\n\n{{link}}\n\nIf you do not confirm, we will remind you again at 48 and 72 hours. After that, we cancel the signup and your username is free again. If you did not create this account, you can ignore this message.",
    },
    remind_48: {
      subject: "Your account is still waiting for confirmation",
      text: "Hello,\n\nYou still have not confirmed your email. This link replaces the previous one:\n\n{{link}}\n\nOne last reminder goes out at 72 hours. If you do not confirm, we cancel the signup and your username is free again. If you did not create this account, you can ignore this message.",
    },
    remind_72: {
      subject: "Last reminder: confirm your account",
      text: "Hello,\n\nThis is the last reminder. Open this link to confirm your email. The previous link no longer works:\n\n{{link}}\n\nIf you do not confirm within 24 hours, we cancel the signup and release your username. You will need to register again. If you did not create this account, you can ignore this message.",
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
    remind_24: {
      subject: "Ton compte My K-pop Binder n'est pas encore confirmé",
      text: "Bonjour,\n\nTon compte n'est pas encore confirmé. Ouvre ce lien pour l'activer :\n\n{{link}}\n\nSi tu ne confirmes pas, nous te le rappellerons à 48 h et à 72 h. Passé ce délai, l'inscription est annulée et ton nom d'utilisateur redevient libre. Si tu n'as pas créé ce compte, ignore ce message.",
    },
    remind_48: {
      subject: "Ton compte attend toujours une confirmation",
      text: "Bonjour,\n\nTu n'as toujours pas confirmé ton e-mail. Ce lien remplace le précédent :\n\n{{link}}\n\nUn dernier rappel part à 72 h. Si tu ne confirmes pas, l'inscription est annulée et ton nom d'utilisateur redevient libre. Si tu n'as pas créé ce compte, ignore ce message.",
    },
    remind_72: {
      subject: "Dernier rappel : confirme ton compte",
      text: "Bonjour,\n\nCeci est le dernier rappel. Ouvre ce lien pour confirmer ton e-mail. Le lien précédent ne fonctionne plus :\n\n{{link}}\n\nSi tu ne confirmes pas dans les 24 heures, nous annulons l'inscription et libérons ton nom d'utilisateur. Tu devras t'inscrire à nouveau. Si tu n'as pas créé ce compte, ignore ce message.",
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
    remind_24: {
      subject: "Dein My K-pop Binder-Konto ist noch nicht bestätigt",
      text: "Hallo,\n\nDein Konto ist noch nicht bestätigt. Öffne diesen Link, um es zu aktivieren:\n\n{{link}}\n\nWenn du nicht bestätigst, erinnern wir dich nach 48 und nach 72 Stunden. Danach wird die Anmeldung gelöscht und dein Nutzername wieder frei. Wenn du das Konto nicht erstellt hast, ignoriere diese Nachricht.",
    },
    remind_48: {
      subject: "Dein Konto wartet noch auf die Bestätigung",
      text: "Hallo,\n\nDu hast deine E-Mail noch nicht bestätigt. Dieser Link ersetzt den vorherigen:\n\n{{link}}\n\nEine letzte Erinnerung geht nach 72 Stunden raus. Wenn du nicht bestätigst, wird die Anmeldung gelöscht und dein Nutzername wieder frei. Wenn du das Konto nicht erstellt hast, ignoriere diese Nachricht.",
    },
    remind_72: {
      subject: "Letzte Erinnerung: bestätige dein Konto",
      text: "Hallo,\n\nDas ist die letzte Erinnerung. Öffne diesen Link, um deine E-Mail zu bestätigen. Der vorherige Link gilt nicht mehr:\n\n{{link}}\n\nWenn du nicht innerhalb von 24 Stunden bestätigst, löschen wir die Anmeldung und geben deinen Nutzernamen frei. Du musst dich neu registrieren. Wenn du das Konto nicht erstellt hast, ignoriere diese Nachricht.",
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
    remind_24: {
      subject: "Il tuo account My K-pop Binder non è ancora confermato",
      text: "Ciao,\n\nIl tuo account non è ancora confermato. Apri questo link per attivarlo:\n\n{{link}}\n\nSe non confermi, te lo ricordiamo di nuovo a 48 e a 72 ore. Dopo quel termine annulliamo l'iscrizione e il tuo nome utente torna libero. Se non hai creato tu l'account, ignora questo messaggio.",
    },
    remind_48: {
      subject: "Il tuo account è ancora in attesa di conferma",
      text: "Ciao,\n\nNon hai ancora confermato l'email. Questo link sostituisce il precedente:\n\n{{link}}\n\nL'ultimo avviso arriva a 72 ore. Se non confermi, annulliamo l'iscrizione e il tuo nome utente torna libero. Se non hai creato tu l'account, ignora questo messaggio.",
    },
    remind_72: {
      subject: "Ultimo avviso: conferma il tuo account",
      text: "Ciao,\n\nQuesto è l'ultimo avviso. Apri questo link per confermare l'email. Il link precedente non funziona più:\n\n{{link}}\n\nSe non confermi entro 24 ore, annulliamo l'iscrizione e liberiamo il tuo nome utente. Dovrai registrarti di nuovo. Se non hai creato tu l'account, ignora questo messaggio.",
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
    remind_24: {
      subject: "A tua conta My K-pop Binder ainda não está confirmada",
      text: "Olá,\n\nA tua conta ainda não está confirmada. Abre este link para a ativar:\n\n{{link}}\n\nSe não confirmares, voltamos a avisar às 48 e às 72 horas. Depois desse prazo, anulamos o registo e o teu nome de utilizador fica livre. Se não criaste esta conta, ignora esta mensagem.",
    },
    remind_48: {
      subject: "A tua conta continua à espera de confirmação",
      text: "Olá,\n\nAinda não confirmaste o email. Este link substitui o anterior:\n\n{{link}}\n\nO último aviso sai às 72 horas. Se não confirmares, anulamos o registo e o teu nome de utilizador fica livre. Se não criaste esta conta, ignora esta mensagem.",
    },
    remind_72: {
      subject: "Último aviso: confirma a tua conta",
      text: "Olá,\n\nEste é o último aviso. Abre este link para confirmar o email. O link anterior deixa de funcionar:\n\n{{link}}\n\nSe não confirmares nas próximas 24 horas, anulamos o registo e libertamos o teu nome de utilizador. Terás de te registar outra vez. Se não criaste esta conta, ignora esta mensagem.",
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
    remind_24: {
      subject: "Akun My K-pop Binder kamu belum dikonfirmasi",
      text: "Halo,\n\nAkun kamu belum dikonfirmasi. Buka tautan ini untuk mengaktifkannya:\n\n{{link}}\n\nJika kamu tidak mengonfirmasi, kami mengingatkan lagi pada 48 dan 72 jam. Setelah itu pendaftaran dibatalkan dan nama pengguna kamu bebas lagi. Jika kamu tidak membuat akun ini, abaikan pesan ini.",
    },
    remind_48: {
      subject: "Akun kamu masih menunggu konfirmasi",
      text: "Halo,\n\nKamu belum mengonfirmasi email. Tautan ini menggantikan yang sebelumnya:\n\n{{link}}\n\nPengingat terakhir dikirim pada 72 jam. Jika kamu tidak mengonfirmasi, pendaftaran dibatalkan dan nama pengguna kamu bebas lagi. Jika kamu tidak membuat akun ini, abaikan pesan ini.",
    },
    remind_72: {
      subject: "Pengingat terakhir: konfirmasi akun kamu",
      text: "Halo,\n\nIni pengingat terakhir. Buka tautan ini untuk mengonfirmasi email. Tautan sebelumnya tidak berlaku lagi:\n\n{{link}}\n\nJika kamu tidak mengonfirmasi dalam 24 jam, kami membatalkan pendaftaran dan membebaskan nama pengguna kamu. Kamu harus mendaftar lagi. Jika kamu tidak membuat akun ini, abaikan pesan ini.",
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
    remind_24: {
      subject: "บัญชียังไม่ได้ยืนยัน",
      text: "สวัสดี\n\nบัญชียังไม่ได้ยืนยัน เปิดลิงก์นี้เพื่อเปิดใช้งาน:\n\n{{link}}\n\nหากยังไม่ยืนยัน เราจะเตือนอีกครั้งที่ 48 และ 72 ชั่วโมง หลังจากนั้นการสมัครจะถูกยกเลิกและชื่อผู้ใช้จะว่างอีกครั้ง หากคุณไม่ได้สร้างบัญชีนี้ ให้ข้ามอีเมลนี้ได้",
    },
    remind_48: {
      subject: "บัญชียังรอการยืนยัน",
      text: "สวัสดี\n\nคุณยังไม่ได้ยืนยันอีเมล ลิงก์นี้ใช้แทนลิงก์ก่อนหน้า:\n\n{{link}}\n\nการเตือนครั้งสุดท้ายจะส่งที่ 72 ชั่วโมง หากยังไม่ยืนยัน การสมัครจะถูกยกเลิกและชื่อผู้ใช้จะว่างอีกครั้ง หากคุณไม่ได้สร้างบัญชีนี้ ให้ข้ามอีเมลนี้ได้",
    },
    remind_72: {
      subject: "แจ้งเตือนครั้งสุดท้าย: ยืนยันบัญชี",
      text: "สวัสดี\n\nนี่คือการเตือนครั้งสุดท้าย เปิดลิงก์นี้เพื่อยืนยันอีเมล ลิงก์ก่อนหน้าใช้ไม่ได้อีกต่อไป:\n\n{{link}}\n\nหากไม่ยืนยันภายใน 24 ชั่วโมง เราจะยกเลิกการสมัครและปล่อยชื่อผู้ใช้ คุณจะต้องสมัครใหม่ หากคุณไม่ได้สร้างบัญชีนี้ ให้ข้ามอีเมลนี้ได้",
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
    remind_24: {
      subject: "My K-pop Binder のアカウントがまだ確認されていません",
      text: "こんにちは。\n\nアカウントがまだ確認されていません。このリンクを開いて有効にしてください。\n\n{{link}}\n\n確認されない場合、48時間後と72時間後に再度お知らせします。その期限を過ぎると登録は取り消され、ユーザー名は再度使えるようになります。身に覚えがない場合は、このメールを無視してください。",
    },
    remind_48: {
      subject: "アカウントはまだ確認待ちです",
      text: "こんにちは。\n\nメールアドレスがまだ確認されていません。このリンクは以前のリンクに代わります。\n\n{{link}}\n\n最後のお知らせは72時間後です。確認されない場合、登録は取り消され、ユーザー名は再度使えるようになります。身に覚えがない場合は、このメールを無視してください。",
    },
    remind_72: {
      subject: "最後のお知らせ：アカウントを確認してください",
      text: "こんにちは。\n\nこれが最後のお知らせです。このリンクを開いてメールアドレスを確認してください。以前のリンクは無効です。\n\n{{link}}\n\n24時間以内に確認されない場合、登録を取り消し、ユーザー名を解放します。もう一度登録が必要です。身に覚えがない場合は、このメールを無視してください。",
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
    remind_24: {
      subject: "My K-pop Binder 계정이 아직 확인되지 않았습니다",
      text: "안녕하세요.\n\n계정이 아직 확인되지 않았습니다. 이 링크를 열어 활성화해 주세요.\n\n{{link}}\n\n확인하지 않으면 48시간과 72시간에 다시 안내합니다. 그 기한이 지나면 가입이 취소되고 사용자 이름이 다시 사용할 수 있게 됩니다. 직접 가입하지 않았다면 이 메일은 무시해도 됩니다.",
    },
    remind_48: {
      subject: "계정이 아직 확인을 기다리고 있습니다",
      text: "안녕하세요.\n\n이메일을 아직 확인하지 않았습니다. 이 링크는 이전 링크를 대신합니다.\n\n{{link}}\n\n마지막 안내는 72시간에 갑니다. 확인하지 않으면 가입이 취소되고 사용자 이름이 다시 사용할 수 있게 됩니다. 직접 가입하지 않았다면 이 메일은 무시해도 됩니다.",
    },
    remind_72: {
      subject: "마지막 안내: 계정을 확인해 주세요",
      text: "안녕하세요.\n\n마지막 안내입니다. 이 링크를 열어 이메일을 확인해 주세요. 이전 링크는 더 이상 쓸 수 없습니다.\n\n{{link}}\n\n24시간 안에 확인하지 않으면 가입을 취소하고 사용자 이름을 풀어 드립니다. 다시 가입해야 합니다. 직접 가입하지 않았다면 이 메일은 무시해도 됩니다.",
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
    remind_24: {
      subject: "你的 My K-pop Binder 账户尚未确认",
      text: "你好，\n\n账户尚未确认。打开此链接以激活：\n\n{{link}}\n\n如果没有确认，我们会在 48 小时和 72 小时再次提醒。期限过后，注册会被取消，用户名会重新空出来。如果这不是你的操作，请忽略这封邮件。",
    },
    remind_48: {
      subject: "账户仍在等待确认",
      text: "你好，\n\n你还没有确认邮箱。此链接会替换上一封里的链接：\n\n{{link}}\n\n最后一次提醒在 72 小时发出。如果没有确认，注册会被取消，用户名会重新空出来。如果这不是你的操作，请忽略这封邮件。",
    },
    remind_72: {
      subject: "最后提醒：请确认账户",
      text: "你好，\n\n这是最后一次提醒。打开此链接以确认邮箱。之前的链接已失效：\n\n{{link}}\n\n如果 24 小时内没有确认，我们会取消注册并释放用户名。你需要重新注册。如果这不是你的操作，请忽略这封邮件。",
    },
  },
};

export function normalizeAuthLanguage(value: string | null | undefined): string {
  const base = (value || "es").toLowerCase().split("-")[0];
  return (LOCALES as readonly string[]).includes(base) ? base : "en";
}

const APEX_TO_WWW: Record<string, string> = {
  "mykpopbinder.com": "www.mykpopbinder.com",
  "mykpopbinder.es": "www.mykpopbinder.es",
  "mykpopbinder.eu": "www.mykpopbinder.eu",
};

const OTP_TYPES = new Set(["signup", "recovery", "magiclink"]);

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

/** Enlace de la web. Confirma el token aquí y no depende del redirect de Supabase. */
export function buildAuthConfirmLink(redirectTo: string, tokenHash: string, type: string): string | null {
  const hash = tokenHash.trim();
  if (hash.length < 16 || hash.length > 2000 || !OTP_TYPES.has(type)) return null;
  const allowed = allowedAuthRedirect(redirectTo);
  if (!allowed) return null;
  const target = new URL(allowed);
  const host = APEX_TO_WWW[target.hostname.toLowerCase()] || target.hostname;
  const origin = `${target.protocol}//${host}${target.port ? `:${target.port}` : ""}`;
  const next = `${target.pathname}${target.search}`;
  const link = new URL("/auth/confirm", origin);
  link.searchParams.set("token_hash", hash);
  link.searchParams.set("type", type);
  if (next && next !== "/") link.searchParams.set("next", next);
  return link.toString();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BUTTONS: Record<string, Record<AuthMailKind, { cta: string; fallback: string }>> = {
  es: {
    signup: { cta: "Confirmar mi cuenta", fallback: "Si el botón no se abre, copia este enlace:" },
    recovery: { cta: "Elegir contraseña nueva", fallback: "Si el botón no se abre, copia este enlace:" },
    remind_24: { cta: "Confirmar mi cuenta", fallback: "Si el botón no se abre, copia este enlace:" },
    remind_48: { cta: "Confirmar mi cuenta", fallback: "Si el botón no se abre, copia este enlace:" },
    remind_72: { cta: "Confirmar ahora", fallback: "Si el botón no se abre, copia este enlace:" },
  },
  en: {
    signup: { cta: "Confirm my account", fallback: "If the button does not open, copy this link:" },
    recovery: { cta: "Choose a new password", fallback: "If the button does not open, copy this link:" },
    remind_24: { cta: "Confirm my account", fallback: "If the button does not open, copy this link:" },
    remind_48: { cta: "Confirm my account", fallback: "If the button does not open, copy this link:" },
    remind_72: { cta: "Confirm now", fallback: "If the button does not open, copy this link:" },
  },
  fr: {
    signup: { cta: "Confirmer mon compte", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" },
    recovery: { cta: "Choisir un nouveau mot de passe", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" },
    remind_24: { cta: "Confirmer mon compte", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" },
    remind_48: { cta: "Confirmer mon compte", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" },
    remind_72: { cta: "Confirmer maintenant", fallback: "Si le bouton ne s'ouvre pas, copie ce lien :" },
  },
  de: {
    signup: { cta: "Konto bestätigen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" },
    recovery: { cta: "Neues Passwort wählen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" },
    remind_24: { cta: "Konto bestätigen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" },
    remind_48: { cta: "Konto bestätigen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" },
    remind_72: { cta: "Jetzt bestätigen", fallback: "Wenn der Button sich nicht öffnet, kopiere diesen Link:" },
  },
  it: {
    signup: { cta: "Conferma il mio account", fallback: "Se il pulsante non si apre, copia questo link:" },
    recovery: { cta: "Scegli una nuova password", fallback: "Se il pulsante non si apre, copia questo link:" },
    remind_24: { cta: "Conferma il mio account", fallback: "Se il pulsante non si apre, copia questo link:" },
    remind_48: { cta: "Conferma il mio account", fallback: "Se il pulsante non si apre, copia questo link:" },
    remind_72: { cta: "Conferma ora", fallback: "Se il pulsante non si apre, copia questo link:" },
  },
  pt: {
    signup: { cta: "Confirmar a minha conta", fallback: "Se o botão não abrir, copia este link:" },
    recovery: { cta: "Escolher uma palavra-passe nova", fallback: "Se o botão não abrir, copia este link:" },
    remind_24: { cta: "Confirmar a minha conta", fallback: "Se o botão não abrir, copia este link:" },
    remind_48: { cta: "Confirmar a minha conta", fallback: "Se o botão não abrir, copia este link:" },
    remind_72: { cta: "Confirmar agora", fallback: "Se o botão não abrir, copia este link:" },
  },
  id: {
    signup: { cta: "Konfirmasi akun saya", fallback: "Jika tombol tidak terbuka, salin tautan ini:" },
    recovery: { cta: "Pilih kata sandi baru", fallback: "Jika tombol tidak terbuka, salin tautan ini:" },
    remind_24: { cta: "Konfirmasi akun saya", fallback: "Jika tombol tidak terbuka, salin tautan ini:" },
    remind_48: { cta: "Konfirmasi akun saya", fallback: "Jika tombol tidak terbuka, salin tautan ini:" },
    remind_72: { cta: "Konfirmasi sekarang", fallback: "Jika tombol tidak terbuka, salin tautan ini:" },
  },
  th: {
    signup: { cta: "ยืนยันบัญชีของฉัน", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" },
    recovery: { cta: "ตั้งรหัสผ่านใหม่", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" },
    remind_24: { cta: "ยืนยันบัญชีของฉัน", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" },
    remind_48: { cta: "ยืนยันบัญชีของฉัน", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" },
    remind_72: { cta: "ยืนยันตอนนี้", fallback: "ถ้าปุ่มไม่เปิด ให้คัดลอกลิงก์นี้:" },
  },
  ja: {
    signup: { cta: "アカウントを確認", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" },
    recovery: { cta: "新しいパスワードを設定", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" },
    remind_24: { cta: "アカウントを確認", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" },
    remind_48: { cta: "アカウントを確認", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" },
    remind_72: { cta: "今すぐ確認", fallback: "ボタンが開かない場合は、このリンクをコピーしてください。" },
  },
  ko: {
    signup: { cta: "계정 확인", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." },
    recovery: { cta: "새 비밀번호 설정", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." },
    remind_24: { cta: "계정 확인", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." },
    remind_48: { cta: "계정 확인", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." },
    remind_72: { cta: "지금 확인", fallback: "버튼이 열리지 않으면 이 링크를 복사하세요." },
  },
  zh: {
    signup: { cta: "确认我的账户", fallback: "如果按钮打不开，请复制这个链接：" },
    recovery: { cta: "设置新密码", fallback: "如果按钮打不开，请复制这个链接：" },
    remind_24: { cta: "确认我的账户", fallback: "如果按钮打不开，请复制这个链接：" },
    remind_48: { cta: "确认我的账户", fallback: "如果按钮打不开，请复制这个链接：" },
    remind_72: { cta: "立即确认", fallback: "如果按钮打不开，请复制这个链接：" },
  },
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
