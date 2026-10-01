/**
 * The shape passed from the server to client components for the signed-in user.
 *
 * Deliberately plain and serialisable. A Supabase `User` object carries raw
 * `app_metadata`, which includes provider tokens and must never be passed into
 * a client component — anything shipped to the browser is readable by the user.
 * Only the fields the UI needs cross the boundary.
 */
export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};