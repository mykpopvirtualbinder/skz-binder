import type { NextConfig } from "next";

const SG_KO_OLD = "/mock-pcs/groups/:group/photocards/seasons-greetings/korean";
const SG_KO = "/mock-pcs/groups/:group/photocards/seasons-greetings/korean";

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

/** All In merch/playing-cards (and other album sidecars) live next to `album/`, not under `photocards/`. */
function albumSidecarMockPcRewrites() {
  const regions: Array<[string, string]> = [
    ["korean", "korean-album"],
    ["korean", "korean-albums"],
    ["japanese", "japanese-albums"],
    ["japanese", "japanese-album"],
    ["taiwanese", "taiwanese-albums"],
    ["taiwanese", "taiwanese-album"],
  ];
  const rules: { source: string; destination: string }[] = [];
  for (const [region, folder] of regions) {
    const pairs: Array<[string, string]> = [
      ["merch", "merch"],
      ["pobs", "pob"],
      ["pob", "pob"],
      ["pobs", "pobs"],
      ["pop-ups", "pop-ups"],
    ];
    for (const [from, to] of pairs) {
      rules.push({
        source: `/mock-pcs/groups/:group/albums/${region}/:album/${from}/:path*`,
        destination: `/mock-pcs/groups/:group/photocards/${folder}/:album/${to}/:path*`,
      });
      rules.push({
        source: `/mock-pcs/groups/:group/album/${region}/:album/${from}/:path*`,
        destination: `/mock-pcs/groups/:group/photocards/${folder}/:album/${to}/:path*`,
      });
    }
  }
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
    return {
      afterFiles: [
        ...seasonsGreetingsMockPcRewrites(),
        {
          source:
            "/mock-pcs/groups/:group/photocards/seasons-greetings/japanese/2026-force/photocard-set/:path*",
          destination:
            "/mock-pcs/groups/:group/photocards/seasons-greetings/japanese/2026-force/photo-card-set/:path*",
        },
        {
          source:
            "/mock-pcs/groups/:group/others/seasons-greetings/japanese/2026-force/photocards/photocard-set/:path*",
          destination:
            "/mock-pcs/groups/:group/photocards/seasons-greetings/japanese/2026-force/photo-card-set/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/album/korean/:album/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/korean-album/:album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/album/japanese/:album/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/album/japanese/:album/album/:path*",
          destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/albums/japanese/:album/album/:path*",
          destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/album/japanese/:album/merch/:path*",
          destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/merch/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/album/japanese/:album/pobs/:path*",
          destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/pob/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/otros/seasons-greetings/:region/:year/inclusions/:path*",
          destination: "/mock-pcs/groups/:group/inclusions/seasons-greetings/:region/:year/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/others/seasons-greetings/:region/:year/inclusions/:path*",
          destination: "/mock-pcs/groups/:group/inclusions/seasons-greetings/:region/:year/:path*",
        },
        {
          source:
            "/mock-pcs/groups/:group/otros/seasons-greetings/korean/2023-szks-mini-world%20/inclusions/:path*",
          destination:
            "/mock-pcs/groups/:group/inclusions/seasons-greetings/korean/2023-szks-mini-world/:path*",
        },
        {
          source:
            "/mock-pcs/groups/:group/otros/seasons-greetings/korean/2025-the-street-kids/pobs/pob-polaroid-ktown4u/:path*",
          destination:
            "/mock-pcs/groups/:group/inclusions/seasons-greetings/korean/2025-the-street-kids/pob-polaroid-ktown4u/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/otros/seasons-greetings/:region/:year/pobs/:path*",
          destination: "/mock-pcs/groups/:group/photocards/seasons-greetings/:region/:year/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/others/seasons-greetings/:region/:year/pobs/:path*",
          destination: "/mock-pcs/groups/:group/photocards/seasons-greetings/:region/:year/:path*",
        },
        {
          source:
            "/mock-pcs/groups/:group/eventos/tour/run-it/stray-kids-world-tour-run-it-in-seoul/:path*",
          destination:
            "/mock-pcs/groups/:group/photocards/events/tours/stray-kids-world-tour-run-it-in/seoul/:path*",
        },
        {
          source:
            "/mock-pcs/groups/:group/eventos/tour/run-it/stray-kids-world-tour-run-it-in-japan/:path*",
          destination:
            "/mock-pcs/groups/:group/photocards/events/tours/stray-kids-world-tour-run-it-in/japan/:path*",
        },
        {
          source:
            "/mock-pcs/groups/:group/otros/seasons-greetings/korean/2025-the-street-kids/photocards/:path*",
          destination:
            "/mock-pcs/groups/:group/photocards/seasons-greetings/korean/2025-the-street-kids/set/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/otros/seasons-greetings/:region/:year/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/seasons-greetings/:region/:year/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/others/seasons-greetings/:region/:year/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/seasons-greetings/:region/:year/:path*",
        },
        // New local tree → production tree (file missing on Vercel)
        ...albumSidecarMockPcRewrites(),
        {
          source: "/mock-pcs/groups/:group/albums/korean/:album/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/korean-album/:album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/albums/japanese/:album/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/japanese-albums/:album/album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/albums/taiwanese/:album/photocards/:path*",
          destination: "/mock-pcs/groups/:group/photocards/taiwanese-albums/:album/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/events/:path*",
          destination: "/mock-pcs/groups/:group/photocards/events/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/eventos/:path*",
          destination: "/mock-pcs/groups/:group/photocards/events/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/others/seasons-greetings/:path*",
          destination: "/mock-pcs/groups/:group/photocards/seasons-greetings/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/otros/seasons-greetings/:path*",
          destination: "/mock-pcs/groups/:group/photocards/seasons-greetings/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/album/:path*",
          destination: "/mock-pcs/groups/:group/albums/:path*",
        },
        {
          source: "/mock-pcs/groups/:group/otros/:path*",
          destination: "/mock-pcs/groups/:group/others/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
