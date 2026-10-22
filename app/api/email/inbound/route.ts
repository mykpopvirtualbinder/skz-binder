import { NextResponse } from "next/server";
import { inboundAuthorized, publicMailError, storeInboundChunk, storeIncoming } from "@/lib/site-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 4_200_000;

/** Cloudflare Email Routing entrega aquí cada mensaje de info@. */
export async function POST(req: Request) {
  const secret = (process.env.EMAIL_INBOUND_SECRET || "").trim();
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!inboundAuthorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (req.headers.get("x-truncated") === "1") {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }

  const raw = Buffer.from(await req.arrayBuffer());
  if (!raw.length) return NextResponse.json({ error: "Empty" }, { status: 400 });

  const uploadId = req.headers.get("x-upload-id") || "";
  if (uploadId) {
    try {
      await storeInboundChunk({
        uploadId,
        seq: Number(req.headers.get("x-upload-seq") || "0"),
        parts: Number(req.headers.get("x-upload-parts") || "0"),
        totalBytes: Number(req.headers.get("x-upload-bytes") || "0"),
        envelopeTo: req.headers.get("x-envelope-to") || "",
        bytes: raw,
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      const pub = publicMailError(err);
      return NextResponse.json({ error: pub.error }, { status: pub.status });
    }
  }

  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });

  try {
    await storeIncoming(raw, req.headers.get("x-envelope-to") || "");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Store failed" }, { status: 502 });
  }
}
