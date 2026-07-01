import { createLocalRepositories } from "./local";
import { createSupabaseRepositories } from "./supabase";
import type { LogisticsRepositories, PersistenceProvider } from "./types";

export function getPersistenceProvider(): PersistenceProvider {
  return process.env.NEXT_PUBLIC_PERSISTENCE_PROVIDER === "supabase" ? "supabase" : "local";
}

export function createLogisticsRepositories(): LogisticsRepositories {
  return getPersistenceProvider() === "supabase"
    ? createSupabaseRepositories()
    : createLocalRepositories();
}
