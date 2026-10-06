import { getEnv } from "@allinvites/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | undefined;
let cachedPublicClient: SupabaseClient | undefined;

/**
 * Server-only Supabase client authenticated with the service role key.
 * Required for `auth.admin.*` operations such as creating a user during
 * self-service registration (STORY-002-001). Never expose this client, or
 * the service role key, to the browser.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!cachedAdminClient) {
    const env = getEnv();
    cachedAdminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedAdminClient;
}

/**
 * Server-side Supabase client authenticated with the anon key — the same
 * privilege level a browser client would have. Used to exchange credentials
 * for a session (e.g. `signInWithPassword` immediately after an
 * admin-created registration, to fulfil auto-authentication).
 */
export function getSupabasePublicClient(): SupabaseClient {
  if (!cachedPublicClient) {
    const env = getEnv();
    cachedPublicClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedPublicClient;
}
