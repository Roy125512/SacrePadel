// Demo mode flag. When NEXT_PUBLIC_DEMO_MODE=true the app runs against an
// in-memory fake backend instead of Supabase (useful for local demos when the
// real Supabase project is unavailable). Set in .env.local.
export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
