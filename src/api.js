// Gegevenslaag. Gebruikt Supabase, of een nagebootste database als VITE_MOCK=1.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, USE_MOCK } from './config.js';
import { mockApi } from './mock.js';

const sb = USE_MOCK ? null : createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const ok = ({ data, error }) => { if (error) throw error; return data; };

const supabaseApi = {
  async getSession() { const { data } = await sb.auth.getSession(); return data.session; },
  onAuth(cb) { const { data } = sb.auth.onAuthStateChange((evt, session) => cb(evt, session)); return () => data.subscription.unsubscribe(); },
  async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
  async signOut() { await sb.auth.signOut(); },
  async resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })); },
  async updatePassword(password) { ok(await sb.auth.updateUser({ password })); },

  async ensureHousehold() { return ok(await sb.rpc('ensure_household')); },
  async loadAll(sinceDay) {
    const [h, c, m, p, s, k] = await Promise.all([
      sb.from('households').select('*').single(),
      sb.from('categories').select('*').order('position'),
      sb.from('meals').select('*').order('name'),
      sb.from('programs').select('*').order('start_date'),
      sb.from('slots').select('*').gte('day', sinceDay),
      sb.from('shop_marks').select('*')
    ]);
    return { household: ok(h), categories: ok(c), meals: ok(m), programs: ok(p), slots: ok(s), marks: ok(k) };
  },
  async updateHousehold(id, patch) { return ok(await sb.from('households').update(patch).eq('id', id).select().single()); },

  async insertCategory(row) { return ok(await sb.from('categories').insert(row).select().single()); },
  async updateCategory(id, patch) { return ok(await sb.from('categories').update(patch).eq('id', id).select().single()); },
  async deleteCategory(id) { ok(await sb.from('categories').delete().eq('id', id)); },

  async insertMeal(row) { return ok(await sb.from('meals').insert(row).select().single()); },
  async updateMeal(id, patch) { return ok(await sb.from('meals').update(patch).eq('id', id).select().single()); },

  async insertProgram(row) { return ok(await sb.from('programs').insert(row).select().single()); },
  async updateProgram(id, patch) { return ok(await sb.from('programs').update(patch).eq('id', id).select().single()); },
  async deleteProgram(id) { ok(await sb.from('programs').delete().eq('id', id)); },

  async upsertSlot(row) { return ok(await sb.from('slots').upsert(Object.assign({}, row, { updated_at: new Date().toISOString() }), { onConflict: 'household_id,day' }).select().single()); },
  async deleteSlots(householdId, days) { if (days.length) ok(await sb.from('slots').delete().eq('household_id', householdId).in('day', days)); },
  async markShopped(householdId, days) { if (days.length) ok(await sb.from('slots').update({ shopped: true }).eq('household_id', householdId).in('day', days)); },

  async upsertMark(row) { return ok(await sb.from('shop_marks').upsert(row, { onConflict: 'household_id,key' }).select().single()); },
  async clearMarks(householdId) { ok(await sb.from('shop_marks').delete().eq('household_id', householdId)); },

  async uploadPhoto(path, blob) { ok(await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })); },
  async removePhoto(path) { await sb.storage.from('photos').remove([path]); },
  async photoUrls(paths) {
    if (!paths.length) return {};
    const data = ok(await sb.storage.from('photos').createSignedUrls(paths, 60 * 60 * 12));
    const map = {};
    data.forEach((d) => { if (d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  }
};

export const api = USE_MOCK ? mockApi : supabaseApi;
