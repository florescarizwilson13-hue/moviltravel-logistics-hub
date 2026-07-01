import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROLES, type AppRole, type AuthenticatedAppUser } from "./roles";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  active: boolean;
};

function isAppRole(role: string | null | undefined): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

export async function getAuthenticatedAppUser(): Promise<AuthenticatedAppUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile || !profile.active || !isAppRole(profile.role)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: profile.role
  };
}
