/**
 * Genera public/merch-albums-catalog.json y scripts/merch-albums-seed-for-supabase.sql
 * a partir de public/albums (misma lógica que GET /api/merch-albums-catalog).
 *
 * Uso: npm run build:merch-albums-catalog
 */
import fs from "fs";
import path from "path";
import { isStrayKidsPlaceholderMerchAlbumRow } from "../lib/collection-filters";
import { scanMerchAlbumsFromPublicAlbums } from "../lib/merch-albums-catalog-scan";
import { scanFolderTreeCatalog } from "../lib/folder-tree-catalog";

const OUT_JSON = path.join(process.cwd(), "public", "merch-albums-catalog.json");
/** Ruta visible (no gitignored): súbelo a Supabase SQL Editor cuando exista. */
const OUT_SQL = path.join(process.cwd(), "scripts", "merch-albums-seed-for-supabase.sql");

function sqlString(s: string) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}

function sqlText(t: string | null) {
  if (t == null || t === "") return "NULL";
  return sqlString(t);
}

function main() {
  const unique = scanMerchAlbumsFromPublicAlbums().filter(
    (r) => !isStrayKidsPlaceholderMerchAlbumRow(r.group_name, r.album_title),
  );
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(unique, null, 2), "utf8");
  console.log(`merch-albums-catalog: ${OUT_JSON} (${unique.length} filas)`);

  const treeOut = path.join(process.cwd(), "public", "folder-tree-catalog.json");
  const tree = scanFolderTreeCatalog();
  fs.writeFileSync(treeOut, JSON.stringify(tree, null, 2), "utf8");
  console.log(`folder-tree-catalog: ${treeOut} (${tree.albums.length} álbumes)`);
  if (unique.length === 0) {
    console.log(
      "\n0 filas: el escáner busca imágenes .png/.jpg/.webp en:\n" +
        "  • public/mock-pcs/groups/<grupo>/albums/korean|japanese|taiwanese/<álbum>/portadas-album/…\n" +
        "  • public/mock-pcs/groups/<grupo>/portadas de albums/korean|japanese|taiwanese/<álbum>/…\n" +
        "  • public/albums/<grupo>/korean|japanese|taiwan/<álbum>/…\n" +
        "  • o, si ambas están vacías: public/stray-kids/korean|…/<álbum>/…\n",
    );
  }

  if (unique.length > 0) {
    const lines = [
      "-- Generado por scripts/build-merch-albums-catalog.ts",
      "-- Ejecuta en Supabase (SQL) para inventario (FK merch_items).",
      "INSERT INTO merch_items (id, name, category, group_name, image_url, rarity, album_title, album_type, album_version)",
    ];
    const values = unique.map(
      (r) =>
        `  (${sqlString(r.id)}::uuid, ${sqlString(r.name)}, ${sqlString(r.category)}, ${sqlString(r.group_name)}, ${sqlString(r.image_url)}, ${sqlString(r.rarity)}, ${sqlString(r.album_title)}, ${sqlText(r.album_type)}, ${sqlString(r.album_version)})`,
    );
    lines.push("VALUES\n" + values.join(",\n"));
    lines.push("ON CONFLICT (id) DO UPDATE SET");
    lines.push(
      "  name = EXCLUDED.name, category = EXCLUDED.category, group_name = EXCLUDED.group_name, image_url = EXCLUDED.image_url, rarity = EXCLUDED.rarity, album_title = EXCLUDED.album_title, album_type = EXCLUDED.album_type, album_version = EXCLUDED.album_version;",
    );
    fs.writeFileSync(OUT_SQL, lines.join("\n"), "utf8");
    console.log(`\n>>> SQL para Supabase (copia TODO el archivo al SQL Editor):\n    ${OUT_SQL}\n`);
  } else if (fs.existsSync(OUT_SQL)) {
    fs.unlinkSync(OUT_SQL);
  }
}

main();
