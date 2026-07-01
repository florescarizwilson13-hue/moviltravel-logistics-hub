import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv, getSupabaseServiceRoleKey } from "./env";

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies; middleware/actions refresh them.
        }
      }
    }
  });
}

export function createSupabaseServiceClient() {
  const { url } = getSupabaseBrowserEnv();

  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
