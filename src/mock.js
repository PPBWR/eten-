// Nagebootste database voor testen zonder Supabase (VITE_MOCK=1). Bewaart in localStorage.
import { todayISO, addDays } from './logic.js';

const KEY = 'eten-mock-v1';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const ing = (n, q, u, a) => ({ n, q, u, a });

function seed() {
  const hid = 'h1', t = todayISO();
  const cats = ['AGV', 'Pasta', 'Rijst', 'Ovenschotel', 'Salade', 'Lekker', 'Variatie', 'Bestellen/halen']
    .map((name, i) => ({ id: 'c' + i, household_id: hid, name, position: i, counts_for_shopping: name !== 'Bestellen/halen' }));
  const C = (n) => cats.find((c) => c.name === n).id;
  const meal = (o) => Object.assign({ id: uid(), household_id: hid, type: 'compleet', photo_path: null, prep: '', extras_on: false, extras: [], ingredients: [], parts: [], archived: false }, o);
  const meals = [
    meal({ name: 'AGV', category_id: C('AGV'), type: 'samen', parts: [
      { name: 'Aardappelen', letter: 'A', afd: 'AGF', options: [{ name: 'Gekookt', ingredients: [ing('Aardappelen', 250, 'g', 'AGF')] }, { name: 'Puree', ingredients: [ing('Aardappelen', 250, 'g', 'AGF'), ing('Melk', 50, 'ml', 'Zuivel')] }, { name: 'Krieltjes', ingredients: [ing('Krieltjes', 250, 'g', 'AGF')] }] },
      { name: 'Groente', letter: 'G', afd: 'AGF', options: [{ name: 'Broccoli', ingredients: [ing('Broccoli', 200, 'g', 'AGF')] }, { name: 'Sperziebonen', ingredients: [ing('Sperziebonen', 200, 'g', 'AGF')] }] },
      { name: 'Vlees / vis / vega', letter: 'V', afd: 'Vlees & vis', options: [{ name: 'Kipfilet', ingredients: [ing('Kipfilet', 125, 'g', 'Vlees & vis')] }, { name: 'Gehaktbal', ingredients: [ing('Gehaktbal', 1, 'stuks', 'Vlees & vis')] }] }
    ], extras_on: true, extras: ['Jus', 'Appelmoes'] }),
    meal({ name: 'Nasi', category_id: C('Rijst'), extras_on: true, extras: ['Kroepoek', 'Banaan', 'Satésaus'], ingredients: [ing('Nasi-groente', 200, 'g', 'AGF'), ing('Kipfilet', 125, 'g', 'Vlees & vis'), ing('Rijst', 75, 'g', 'Houdbaar')] }),
    meal({ name: 'Pasta pesto', category_id: C('Pasta'), extras_on: true, extras: ['Geraspte kaas', 'Rucola'], ingredients: [ing('Penne', 100, 'g', 'Houdbaar'), ing('Pesto', 0.25, 'pot', 'Houdbaar')] }),
    meal({ name: 'Spaghetti bolognese', category_id: C('Pasta'), ingredients: [ing('Spaghetti', 100, 'g', 'Houdbaar'), ing('Gehakt', 125, 'g', 'Vlees & vis')] }),
    meal({ name: 'Pizza', category_id: C('Bestellen/halen') }),
    meal({ name: 'Lasagne', category_id: C('Ovenschotel'), ingredients: [ing('Lasagnebladen', 4, 'stuks', 'Houdbaar'), ing('Gehakt', 125, 'g', 'Vlees & vis')] }),
    meal({ name: 'Pannenkoeken', category_id: C('Lekker'), extras_on: true, extras: ['Stroop', 'Spek'] }),
    meal({ name: 'Wraps', category_id: C('Variatie') }),
    meal({ name: 'Dahl', category_id: C('Variatie') })
  ];
  const nasi = meals.find((m) => m.name === 'Nasi');
  return {
    household: { id: hid, name: 'Ons huishouden', persons: 2, std_days: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], sort_by_afd: false, afd_order: ['AGF', 'Vlees & vis', 'Zuivel', 'Brood', 'Houdbaar', 'Diepvries', 'Overig'] },
    categories: cats, meals,
    programs: [{ id: 'p1', household_id: hid, start_date: t, end_date: addDays(t, 6), ready: false }],
    slots: [
      { household_id: hid, day: addDays(t, -20), mode: 'vast', category_id: null, meal_id: nasi.id, picks: [], extras: [], mark: null, shopped: true },
      { household_id: hid, day: addDays(t, 1), mode: 'cat', category_id: C('AGV'), meal_id: null, picks: [], extras: [], mark: null, shopped: false }
    ],
    marks: []
  };
}

let db = null;
const load = () => { if (!db) { try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; } if (!db) db = seed(); } return db; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* geen opslag beschikbaar */ } };
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 60));
let session = null; const listeners = [];

export const mockApi = {
  async getSession() { try { session = JSON.parse(localStorage.getItem(KEY + '-s')); } catch (e) { session = null; } return session; },
  onAuth(cb) { listeners.push(cb); return () => {}; },
  async signIn(email) { session = { user: { email } }; try { localStorage.setItem(KEY + '-s', JSON.stringify(session)); } catch (e) {} listeners.forEach((l) => l('SIGNED_IN', session)); },
  async signOut() { session = null; try { localStorage.removeItem(KEY + '-s'); } catch (e) {} listeners.forEach((l) => l('SIGNED_OUT', null)); },
  async resetPassword() { return wait(); },
  async updatePassword() { return wait(); },
  async ensureHousehold() { return load().household.id; },
  async loadAll() { const d = load(); return wait(JSON.parse(JSON.stringify(d))); },
  async updateHousehold(id, patch) { Object.assign(load().household, patch); save(); return wait(Object.assign({}, db.household)); },
  async insertCategory(row) { const r = Object.assign({ id: uid(), household_id: 'h1', counts_for_shopping: true }, row); load().categories.push(r); save(); return wait(r); },
  async updateCategory(id, patch) { const r = load().categories.find((c) => c.id === id); Object.assign(r, patch); save(); return wait(Object.assign({}, r)); },
  async deleteCategory(id) { load(); db.categories = db.categories.filter((c) => c.id !== id); db.meals.forEach((m) => { if (m.category_id === id) m.category_id = null; }); save(); return wait(); },
  async insertMeal(row) { const r = Object.assign({ id: uid(), household_id: 'h1', type: 'compleet', photo_path: null, prep: '', extras_on: false, extras: [], ingredients: [], parts: [], archived: false }, row); load().meals.push(r); save(); return wait(r); },
  async updateMeal(id, patch) { const r = load().meals.find((m) => m.id === id); Object.assign(r, patch); save(); return wait(JSON.parse(JSON.stringify(r))); },
  async insertProgram(row) { const r = Object.assign({ id: uid(), household_id: 'h1', ready: false }, row); load().programs.push(r); save(); return wait(r); },
  async updateProgram(id, patch) { const r = load().programs.find((p) => p.id === id); Object.assign(r, patch); save(); return wait(Object.assign({}, r)); },
  async deleteProgram(id) { load(); db.programs = db.programs.filter((p) => p.id !== id); save(); return wait(); },
  async upsertSlot(row) { load(); db.slots = db.slots.filter((s) => s.day !== row.day).concat([row]); save(); return wait(row); },
  async deleteSlots(hid, days) { load(); db.slots = db.slots.filter((s) => days.indexOf(s.day) < 0); save(); return wait(); },
  async markShopped(hid, days) { load().slots.forEach((s) => { if (days.indexOf(s.day) >= 0) s.shopped = true; }); save(); return wait(); },
  async upsertMark(row) { load(); db.marks = db.marks.filter((m) => m.key !== row.key).concat([row]); save(); return wait(row); },
  async clearMarks() { load().marks = []; save(); return wait(); },
  async uploadPhoto() { return wait(); },
  async removePhoto() { return wait(); },
  async photoUrls() { return {}; }
};
