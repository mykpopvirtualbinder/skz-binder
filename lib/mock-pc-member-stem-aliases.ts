/**
 * @deprecated Usar `stemVariants` / `resolveMockPcImageUrl` en `resolve-mock-pc-image-url.ts`.
 * Se mantiene por compatibilidad; ya no hace producto cartesiano (causaba cuelgues con units).
 */
import { buildMockPcImageCandidates, resolveMockPcImageUrl } from "@/lib/mock-pc-url";

export function mockPcMemberStemAliases(stem: string): string[] {
  const resolved = resolveMockPcImageUrl(
    stem.includes(".") ? stem : `${stem}.jpg`,
  );
  const withoutExt = stem;
  const out = [withoutExt];
  const se = resolved.match(/^(.*)\.[^.]+$/);
  if (se && se[1] && se[1] !== withoutExt) out.push(se[1]);
  return out;
}

export { buildMockPcImageCandidates, resolveMockPcImageUrl };
