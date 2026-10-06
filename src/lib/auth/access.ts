import type { User } from "@supabase/supabase-js";

type WithAppMetadata = Pick<User, "app_metadata">;

// Both flags live in app_metadata, which only the service-role key can
// write — unlike user_metadata, a signed-in user can't edit it through the
// public auth API, so a user can't approve themselves.

// Whether this person has been let in to the product at all. Set by the
// platform admin (/plataforma), by an org admin inviting someone, or by the
// one-off backfill of people who already had a membership.
export function isAccessApproved(user: WithAppMetadata | null | undefined) {
  return user?.app_metadata?.access_approved === true;
}

// The developer/owner of the platform itself, outside any customer
// organization: the only one who can open /plataforma.
export function isPlatformAdmin(user: WithAppMetadata | null | undefined) {
  return user?.app_metadata?.platform_admin === true;
}
