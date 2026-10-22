// Worker de Email Routing. En Cloudflare: Email → Email Routing → Email Workers.
// Variable INBOUND_SECRET: el mismo valor que EMAIL_INBOUND_SECRET en Vercel.
// Regla: info@mykpopbinder.com → Send to Worker.

export default {
  async email(message, env) {
    const secret = env.INBOUND_SECRET;
    if (!secret) {
      message.setReject("Mailbox is not configured");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const max = 3_500_000;
    const truncated = raw.byteLength > max;
    try {
      const res = await fetch("https://www.mykpopbinder.com/api/email/inbound", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "message/rfc822",
          "X-Truncated": truncated ? "1" : "0",
          "X-Envelope-To": message.to || "",
          "X-Envelope-From": message.from || "",
        },
        body: truncated ? raw.slice(0, max) : raw,
      });
      if (!res.ok) message.setReject("Mailbox temporarily unavailable");
    } catch {
      message.setReject("Mailbox temporarily unavailable");
    }
  },
};
