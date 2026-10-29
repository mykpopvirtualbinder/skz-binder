import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isAdminTeamEmail, SITE_ADMIN_EMAIL } from "@/lib/admin-emails";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { sendMail } from "@/lib/site-mail";
import { GOM_SOCIALS, type GomSocialKey } from "@/lib/gom";
import { clip, userFromBearer } from "@/lib/gom-server";
import { listGomFeedback, listGomProfiles, saveGomProfile, type GomRecord } from "@/lib/gom-store";

function publicProfile(
  row: GomRecord,
  ratings: { user_id: string; score: number }[],
  comments: { id: string; userId: string; body: string; createdAt: string; name: string; avatar: string | null }[],
  viewerId: string | null,
) {
  const mine = ratings.filter((rating) => rating.user_id === viewerId);
  const avg = ratings.length ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length : 0;
  return {
    id: row.id,
    userId: row.siteUserId || row.userId,
    displayName: row.displayName,
    photoUrl: row.photoUrl || "",
    socials: row.socials,
    url: row.url,
    goTypes: row.goTypes,
    requirements: row.requirements,
    howItWorks: row.howItWorks,
    createdAt: row.createdAt,
    siteName: row.siteName,
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: ratings.length,
    myRating: mine[0]?.score || 0,
    comments,
  };
}

export async function GET(req: Request) {
  const viewer = await userFromBearer(req);
  const admin = createServiceRoleClient();
  const userq = new URL(req.url).searchParams.get("userq");
  if (userq !== null) {
    if (!viewer) return NextResponse.json({ error: "auth" }, { status: 401 });
    const q = clip(userq, 40).replace(/[%_]/g, "");
    if (q.length < 2) return NextResponse.json({ users: [] });
    const { data } = await admin.from("profiles").select("user_id, display_name, avatar_url").ilike("display_name", `%${q}%`).limit(8);
    return NextResponse.json({
      users: (data || []).flatMap((row) => {
        const name = clip(row.display_name, 80);
        if (!row.user_id || !name) return [];
        return [{ id: row.user_id, name, avatar: row.avatar_url || null }];
      }),
    });
  }
  try {
    const all = await listGomProfiles(admin);
    const rows = all.filter((row) => row.status === "approved");
    const { ratings, comments } = await listGomFeedback(admin);
    const authorIds = [...new Set(comments.map((comment) => comment.userId))];
    const contactIds = [...new Set(rows.map((row) => row.siteUserId || row.userId))];
    const profileIds = [...new Set([...authorIds, ...contactIds])];
    const { data: authors } = profileIds.length
      ? await admin.from("profiles").select("user_id, display_name, avatar_url").in("user_id", profileIds)
      : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };
    const names = new Map((authors || []).map((author) => [author.user_id, author]));
    for (const row of rows) {
      const account = names.get(row.siteUserId || row.userId);
      if (account?.display_name) row.siteName = account.display_name;
    }
    const profiles = rows.map((row) => {
      const rowRatings = ratings.filter((rating) => rating.gomId === row.id).map((rating) => ({ user_id: rating.userId, score: rating.score }));
      const rowComments = comments
        .filter((comment) => comment.gomId === row.id)
        .map((comment) => {
          const author = names.get(comment.userId);
          return {
            id: comment.id,
            userId: comment.userId,
            body: comment.body,
            createdAt: comment.createdAt,
            name: author?.display_name || "MKBees",
            avatar: author?.avatar_url || null,
          };
        });
      return publicProfile(row, rowRatings, rowComments, viewer?.id || null);
    });
    const own = viewer ? all.find((row) => row.userId === viewer.id) : null;
    const mine = own ? { status: own.status, displayName: own.displayName } : null;
    return NextResponse.json({ profiles, mine });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const form = await req.formData();
  const displayName = clip(form.get("displayName"), 40);
  const firstName = clip(form.get("firstName"), 80);
  const lastName = clip(form.get("lastName"), 80);
  const phone = clip(form.get("phone"), 40);
  const url = clip(form.get("url"), 300);
  const goTypes = clip(form.get("goTypes"), 2000);
  const requirements = clip(form.get("requirements"), 2000);
  const howItWorks = clip(form.get("howItWorks"), 2000);
  if (!displayName || !firstName || !lastName || !phone || !goTypes || !requirements || !howItWorks) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }
  const socials = {} as Record<GomSocialKey, string>;
  for (const field of GOM_SOCIALS) socials[field.key] = clip(form.get(field.key), 160);
  if (!GOM_SOCIALS.some((field) => socials[field.key])) {
    return NextResponse.json({ error: "social" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const file = form.get("photo");
  let photoUrl = clip(form.get("photoUrl"), 500);
  if (file instanceof File && file.size > 0) {
    if (file.size > 4_000_000) return NextResponse.json({ error: "photo" }, { status: 400 });
    const type = (file.type || "").toLowerCase();
    const name = file.name.toLowerCase();
    const ext = type === "image/png" || name.endsWith(".png")
      ? "png"
      : type === "image/webp" || name.endsWith(".webp")
        ? "webp"
        : type === "image/jpeg" || type === "image/jpg" || type === "image/pjpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")
          ? "jpg"
          : "";
    if (!ext) return NextResponse.json({ error: "photo" }, { status: 400 });
    const path = `gom/${user.id}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const uploaded = await admin.storage.from("avatars").upload(path, bytes, { contentType, upsert: false });
    if (uploaded.error) return NextResponse.json({ error: "photo" }, { status: 400 });
    photoUrl = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }
  if (!photoUrl) return NextResponse.json({ error: "photo" }, { status: 400 });
  const siteUserId = clip(form.get("siteUserId"), 80);
  if (!siteUserId) return NextResponse.json({ error: "user" }, { status: 400 });
  const { data: siteAccount } = await admin.from("profiles").select("user_id, display_name").eq("user_id", siteUserId).maybeSingle();
  const siteName = clip(siteAccount?.display_name, 80);
  if (!siteAccount?.user_id || !siteName) return NextResponse.json({ error: "user" }, { status: 400 });
  if (siteAccount.user_id !== user.id && !isAdminTeamEmail(user.email)) {
    return NextResponse.json({ error: "user" }, { status: 400 });
  }

  try {
    await saveGomProfile(admin, user.id, {
      displayName,
      photoUrl,
      firstName,
      lastName,
      phone,
      url,
      socials,
      goTypes,
      requirements,
      howItWorks,
      siteUserId: siteAccount.user_id,
      siteName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const notice = `Nueva solicitud de GOM: ${displayName}. Revísala en el panel, pestaña GOM.`;
  await admin.from("notifications").insert({
    user_id: SITE_ADMIN_USER_ID,
    sender_id: user.id,
    type: "admin_message",
    content: notice,
    read: false,
    is_read: false,
  });
  try {
    await sendMail({ to: SITE_ADMIN_EMAIL, subject: `Solicitud de GOM: ${displayName}`, text: notice });
  } catch (err) {
    console.error("gom mail", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
