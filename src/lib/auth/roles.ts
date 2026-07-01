export const APP_ROLES = ["admin", "coordinator", "viewer"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AuthenticatedAppUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
};
