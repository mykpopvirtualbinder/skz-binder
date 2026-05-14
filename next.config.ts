import type { NextConfig } from 'next';

/**
 * Los CSV / Supabase a veces usan carpetas en plural (`korean-albums`) mientras que
 * `public/mock-pcs/...` está en singular (`korean-album`). Sin esto, `<img>` pide una
 * ruta que no existe en el despliegue aunque el archivo sí esté en el repo.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/mock-pcs/groups/:group/photocards/korean-albums/:path*',
        destination: '/mock-pcs/groups/:group/photocards/korean-album/:path*',
      },
      {
        source: '/mock-pcs/groups/:group/inclusions/korean-albums/:path*',
        destination: '/mock-pcs/groups/:group/inclusions/korean-album/:path*',
      },
      {
        source: '/mock-pcs/groups/:group/photocards/japanese-album/:path*',
        destination: '/mock-pcs/groups/:group/photocards/japanese-albums/:path*',
      },
      {
        source: '/mock-pcs/groups/:group/inclusions/japanese-album/:path*',
        destination: '/mock-pcs/groups/:group/inclusions/japanese-albums/:path*',
      },
    ];
  },
};

export default nextConfig;