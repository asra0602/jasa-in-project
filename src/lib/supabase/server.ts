import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;https://cewyrpjnaoywvflaylbl.supabase.co
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;sb_publishable__OOLLXYUTH6BzlhySqmj0Q_isIsl2QP

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing. Check .env.local.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Add the current
          // Next.js proxy/session-refresh pattern when auth routes are built.
        }
      },
    },
  });
}
