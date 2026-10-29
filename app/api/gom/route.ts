import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { SITE_ADMIN_EMAIL } from "@/lib/admin-emails";
import { SITE_ADMIN_USER_ID } from "@/lib/site-admin-stock";
import { sendMail } from "@/lib/site-mail";
import { GOM_SOCIALS, type GomSocialKey } from "@/lib/gom";
import { clip, socialsFromRow, userFromBearer } from "@/lib/gom-server";

type ProfileRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  display_name: string;
  photo_url: string | null;
  go_types: string;
  requirements: string;
  how_it_works: string;
  status: string;
  created_at: string;
};

function publicProfile(
  row: ProfileRow,
  ratings: { user_id: string; score: number }[],
  comments: { id: string; userId: string; body: string; createdAt: string; name: string; avatar: string | null }[],
  viewerId: string | null,
) {
  const mine = ratings.filter((rating) => rating.user_id === viewerId);
  const avg = ratings.length ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length : 0;
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    photoUrl: row.photo_url || "",
    socials: socialsFromRow(row),
    goTypes: row.go_types,
    requirements: row.requirements,
    howItWorks: row.how_it_works,
    createdAt: row.created_at,
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: ratings.length,
    myRating: mine[0]?.score || 0,
    comments,
  };
}

export async function GET(req: Request) {
  const viewer = await userFromBearer(req);
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("gom_profiles")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []) as ProfileRow[];
  const ids = rows.map((row) => row.id);
  const [{ data: ratingRows }, { data: commentRows }, mineRes] = await Promise.all([
    ids.length
      ? admin.from("gom_ratings").select("gom_id, user_id, score").in("gom_id", ids)
      : Promise.resolve({ data: [] as { gom_id: string; user_id: string; score: number }[] }),
    ids.length
      ? admin.from("gom_comments").select("id, gom_id, user_id, body, created_at").in("gom_id", ids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; gom_id: string; user_id: string; body: string; created_at: string }[] }),
    viewer
      ? admin.from("gom_profiles").select("status, display_name").eq("user_id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const authorIds = [...new Set((commentRows || []).map((row) => row.user_id))];
  const { data: authors } = authorIds.length
    ? await admin.from("profiles").select("user_id, display_name, avatar_url").in("user_id", authorIds)
    : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };
  const names = new Map((authors || []).map((author) => [author.user_id, author]));
  const profiles = rows.map((row) => {
    const ratings = (ratingRows || []).filter((rating) => rating.gom_id === row.id);
    const comments = (commentRows || [])
      .filter((comment) => comment.gom_id === row.id)
      .map((comment) => {
        const author = names.get(comment.user_id);
        return {
          id: comment.id,
          userId: comment.user_id,
          body: comment.body,
          createdAt: comment.created_at,
          name: author?.display_name || "Fan",
          avatar: author?.avatar_url || null,
        };
      });
    return publicProfile(row, ratings, comments, viewer?.id || null);
  });
  const mine = mineRes.data
    ? { status: String(mineRes.data.status), displayName: String(mineRes.data.display_name || "") }
    : null;
  return NextResponse.json({ profiles, mine });
}

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const form = await req.formData();
  const displayName = clip(form.get("displayName"), 40);
  const firstName = clip(form.get("firstName"), 80);
  const lastName = clip(form.get("lastName"), 80);
  const phone = clip(form.get("phone"), 40);
  const goTypes = clip(form.get("goTypes"), 2000);
  const requirements = clip(form.get("requirements"), 2000);
  const howItWorks = clip(form.get("howItWorks"), 2000);
  if (!displayName || !firstName || !lastName || !phone || !goTypes || !requirements || !howItWorks) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }
  const socials = {} as Record<GomSocialKey, string>;
  for (const field of GOM_SOCIALS) socials[field.key] = clip(form.get(field.key), 160);

  const admin = createServiceRoleClient();
  const file = form.get("photo");
  let photoUrl = clip(form.get("photoUrl"), 500);
  if (file instanceof File && file.size > 0) {
    if (file.size > 4_000_000) return NextResponse.json({ error: "photo" }, { status: 400 });
    const type = file.type || "";
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return NextResponse.json({ error: "photo" }, { status: 400 });
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = `gom/${user.id}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await admin.storage.from("avatars").upload(path, bytes, { contentType: type, upsert: false });
    if (uploaded.error) return NextResponse.json({ error: "photo" }, { status: 400 });
    photoUrl = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }
  if (!photoUrl) return NextResponse.json({ error: "photo" }, { status: 400 });

  const payload = {
    user_id: user.id,
    display_name: displayName,
    photo_url: photoUrl,
    first_name: firstName,
    last_name: lastName,
    phone,
    ...socials,
    go_types: goTypes,
    requirements,
    how_it_works: howItWorks,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("gom_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
