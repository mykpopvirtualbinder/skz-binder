import { connection } from "next/server";
import LibraryPageClient from "./LibraryPageClient";

export default async function LibraryPage() {
  await connection();
  return <LibraryPageClient />;
}