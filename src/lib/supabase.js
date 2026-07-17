import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hqdogmtcwtoqukxsslqj.supabase.co";
const supabaseKey = "sb_publishable_MEfKsaz6rNJQ5rbXFDSS6g_fgsZ4VGv";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});

// ⚠️ เฉพาะตอน dev เท่านั้น สำหรับ debug ใน Console — อย่าปล่อยไปด้วยตอน deploy production
if (import.meta.env.DEV) {
  window.supabase = supabase;
}