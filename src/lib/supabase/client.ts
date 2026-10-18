import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;https://cewyrpjnaoywvflaylbl.supabase.co
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;sb_publishable__OOLLXYUTH6BzlhySqmj0Q_isIsl2QP

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing. Check .env.local.");
  }

  return createBrowserClient(url, key);
}
