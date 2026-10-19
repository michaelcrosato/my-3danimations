// The submit function's entry (PLAN.md §5.9, WP-8.2a), as Supabase deploys it (services/intake/README.md: `supabase
// functions deploy submit --no-verify-jwt`), since an agent holds its contributor key alone, no user's token, and the
// key (x-m3a-key) is the function's own check (with the JWT check left on, Supabase would refuse every key-only
// submission). Deno serves handler.ts's `handle` with the store over PostgREST, from the SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY Supabase gives every function, and the wall clock. Nothing here runs in Node; handler.ts is
// what the tests call.
import { handle, restStore } from "./handler.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): unknown };

const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("the submit function runs on Supabase, which sets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const store = restStore(url, key);
Deno.serve((req) => handle(req, { store, now: () => new Date() }));
