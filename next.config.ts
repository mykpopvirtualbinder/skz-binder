import type { NextConfig } from "next";

const SG_KO_OLD = "/mock-pcs/groups/:group/photocards/seasons-greetings/korean";
const SG_KO = "/mock-pcs/groups/:group/others/seasons-greetings/korean";

function seasonsGreetingsMockPcRewrites() {
  const rules: { source: string; destination: string }[] = [];

  const yearAliases: [string, string][] = [
    ["2022", "2022-room-mates"],
    ["2024", "2024-perfect-day"],
    ["2025", "2025-the-street-kids"],
    ["2026", "2026-starlight-super-club"],
  ];
  for (const [from, to] of yearAliases) {
    rules.push({ source: `${SG_KO_OLD}/${from}/:path*`, destination: `${SG_KO}/${to}/:path*` });
    rules.push({ source: `${SG_KO}/${from}/:path*`, destination: `${SG_KO}/${to}/:path*` });
  }

  rules.push(
    {
      source: `${SG_KO_OLD}/2024-perfect-day/pob-apple-music/:path*`,
      destination: `${SG_KO}/2024-perfect-day/pobs/pob-applemusic/:path*`,
    },
    {
      source: `${SG_KO}/2024-perfect-day/pob-apple-music/:path*`,
      destination: `${SG_KO}/2024-perfect-day/pobs/pob-applemusic/:path*`,
    },
    {
      source: `${SG_KO}/2026-starlight-super-club/pob-apple-music/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/pobs/pob-applemusic/:path*`,
    },
    {
      source: `${SG_KO}/2025-the-street-kids/pob-applemusic/:path*`,
      destination: `${SG_KO}/2025-the-street-kids/pobs/pob-apple-music/:path*`,
    },
    {
      source: `${SG_KO}/2026-starlight-super-club/pob-music-korea/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/pobs/pob-musickorea/:path*`,
    },
    {
      source: `${SG_KO}/2025-the-street-kids/pob-musickorea/:path*`,
      destination: `${SG_KO}/2025-the-street-kids/pobs/pob-music-korea/:path*`,
    },
    {
      source: `${SG_KO}/2026-starlight-super-club/pob-kpop-together/:path*`,
      destination: `${SG_KO}/2026-starlight-super-club/pobs/pob-kpop-toguether/:path*`,
    },
    {
      source: `${SG_KO}/2024-perfect-day/photocards/polaroid/:path*`,
      destination: `${SG_KO}/2024-perfect-day/photocards/polaroid%20/:path*`,
    },
    {
      source: `${SG_KO}/2024-perfect-day/polaroid/:path*`,
      destination: `${SG_KO}/2024-perfect-day/photocards/polaroid%20/:path*`,
    },
    {
      source: `${SG_KO_OLD}/2024-perfect-day/polaroid/:path*`,
      destination: `${SG_KO}/2024-perfect-day/photocards/polaroid%20/:path*`,
    },
    {
      source: `${SG_KO}/2022-room-mates/pob-polaroid-unit/:path*`,
      destination: `${SG_KO}/2022-room-mates/pobs/pob-polaroids-unit/:path*`,
    },
    {
      source: `${SG_KO}/2022-room-mates/pobs/pob-polaroid-unit/:path*`,
      destination: `${SG_KO}/2022-room-mates/pobs/pob-polaroids-unit/:path*`,
    },
  );

  return rules;
}

/**
 * Los CSV / Supabase a veces usan el árbol viejo
 * (`/album/<región>/…`, `photocards/korean-albums/<álbum>/…`) mientras que
 * en disco las cartas están en `albums/<región>/<álbum>/photocards/…`.
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
          "/mock-pcs/groups/:group/others/seasons-greetings/japanese/2026-force/photocards/photo-card-set/:path*",
      },
      {
        source:
          "/mock-pcs/groups/:group/others/seasons-greetings/japanese/2026-force/photocards/photocard-set/:path*",
        destination:
          "/mock-pcs/groups/:group/others/seasons-greetings/japanese/2026-force/photocards/photo-card-set/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/album/:path*",
        destination: "/mock-pcs/groups/:group/albums/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/otros/:path*",
        destination: "/mock-pcs/groups/:group/others/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/eventos/:path*",
        destination: "/mock-pcs/groups/:group/events/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/korean-albums/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/korean/:album/photocards/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/korean-album/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/korean/:album/photocards/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/japanese/:album/photocards/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/japanese-album/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/japanese/:album/photocards/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/photocards/taiwanese-albums/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/taiwanese/:album/photocards/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/inclusions/korean-albums/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/korean/:album/inclusions/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/inclusions/korean-album/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/korean/:album/inclusions/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/inclusions/japanese-albums/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/japanese/:album/inclusions/:path*",
      },
      {
        source: "/mock-pcs/groups/:group/inclusions/japanese-album/:album/:path*",
        destination: "/mock-pcs/groups/:group/albums/japanese/:album/inclusions/:path*",
      },
    ];
  },
};

export default nextConfig;
