// Deze twee waarden zijn bedoeld om openbaar in de app te staan.
// De gegevens zelf worden beschermd door de beveiligingsregels (RLS) in de database.
// Geheime sleutels (service_role / secret key) horen hier NOOIT.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://awpqysobdezflgglvxkg.supabase.co';
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_oX5xLXc2KUk0Qn5gpfRkSA_pUcHJUUa';

// Alleen voor testen zonder database: start met VITE_MOCK=1
export const USE_MOCK = import.meta.env.VITE_MOCK === '1';
