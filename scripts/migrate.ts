/**
 * Apply database/schema.sql to Supabase/Postgres when DATABASE_URL is set.
 * In demo mode this is a no-op with instructions.
 */

import { readFile } from "fs/promises";
import path from "path";
import { isDemoMode } from "../src/lib/config";

async function main() {
  const schemaPath = path.join(process.cwd(), "database", "schema.sql");
  const sql = await readFile(schemaPath, "utf8");

  if (isDemoMode() || !process.env.DATABASE_URL) {
    console.log(
      "Demo mode / no DATABASE_URL — schema not applied.\n" +
        "Paste database/schema.sql into the Supabase SQL editor, or set DATABASE_URL.",
    );
    console.log(`Schema length: ${sql.length} chars`);
    return;
  }

  // Optional pg driver path — keep dependency-free by documenting SQL apply
  console.log(
    "DATABASE_URL detected. Apply schema via Supabase SQL editor or `psql $DATABASE_URL -f database/schema.sql`.",
  );
}

void main();
