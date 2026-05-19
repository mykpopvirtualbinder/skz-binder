import type { NextConfig } from "next";

const SG_KO = "/mock-pcs/groups/:group/photocards/seasons-greetings/korean";

function seasonsGreetingsMockPcRewrites() {
  const rules: { source: string; destination: string }[] = [];

  rules.push(
    {
      source: `${SG_KO}/2024/:path*`,
      destination: `${SG_KO}/2024-perfect-day/:path*`,
    },
    {
      source: `${SG_KO}/2025/:path*`,
      destination: `${SG_KO}/2025-the-street-kids/:path*`,
    },
    {
      source: `${SG_KO}/2026/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/:path*`,
    },
    {
      source: `${SG_KO}/2024-perfect-day/pob-apple-music/:path*`,
      destination: `${SG_KO}/2024-perfect-day/pob-applemusic/:path*`,
    },
    {
      source: `${SG_KO}/2026-starlight-super-club/pob-apple-music/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/pob-applemusic/:path*`,
    },
    {
      source: `${SG_KO}/2025-the-street-kids/pob-applemusic/:path*`,
      destination: `${SG_KO}/2025-the-street-kids/pob-apple-music/:path*`,
    },
    {
      source: `${SG_KO}/2026-starlight-super-club/pob-music-korea/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/pob-musickorea/:path*`,
    },
    {
      source: `${SG_KO}/2025-the-street-kids/pob-musickorea/:path*`,
      destination: `${SG_KO}/2025-the-street-kids/pob-music-korea/:path*`,
    },
    {
      source: `${SG_KO}/2026-starlight-super-club/pob-kpop-together/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/pob-kpop-toguether/:path*`,
    },
    {
      source: `${SG_KO}/2024-perfect-day/polaroid/:path*`,
      destination: `${SG_KO}/2024-perfect-day/polaroid%20/:path*`,
    },
    {
      source: `${SG_KO}/2022-room-mates/pob-polaroid-unit/:path*`,
      destination: `${SG_KO}/2022-room-mates/pob-polaroids-unit/:path*`,
    },
  );

  return rules;
}

/**
 * Los CSV / Supabase a veces usan carpetas en plural (`korean-albums`) mientras que
 * `public/mock-pcs/...` está en singular (`korean-album`). Sin esto, `<img>` pide una
 * ruta que no existe en el despliegue aunque el archivo sí esté en el repo.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      ...seasonsGreetingsMockPcRewrites(),
      {
        source:
          "/mock-pcs/groups/:group/photocards/seasons-greetings/japanese/2026-force/photocard-set/:path*",
        destination:
          "/mock-pcs/groups/:group/photocards/seasons-greetings/japanese/2026-force/photo-card-set/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/korean-albums/:path*",
        destination: "/mock-pcs/groups/:group/photocards/korean-album/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/inclusions/korean-albums/:path*",
        destination: "/mock-pcs/groups/:group/inclusions/korean-album/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/japanese-album/:path*",
        destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/inclusions/japanese-album/:path*",
        destination: "/mock-pcs/groups/:group/inclusions/japanese-albums/:path*",
      },
    ];
  },
};

export default nextConfig;
