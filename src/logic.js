// Hulpfuncties zonder database: datums, stapel, boodschappenlijst.

export const DOW_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DOW_LONG = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const MON_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MON_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const STD_ORDER = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const UNITS = ['g', 'ml', 'stuks', 'pot', 'el', 'tl'];
export const KIES = 'Kies ik in de winkel';

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
export const range = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };

export function dayInfo(iso) {
  const d = fromISO(iso), w = d.getDay();
  return {
    dow: DOW_SHORT[w],
    dowCap: DOW_SHORT[w].charAt(0).toUpperCase() + DOW_SHORT[w].slice(1),
    num: d.getDate(),
    wkd: w === 0 || w === 6,
    short: DOW_SHORT[w] + ' ' + d.getDate() + ' ' + MON_SHORT[d.getMonth()],
    long: DOW_LONG[w] + ' ' + d.getDate() + ' ' + MON_LONG[d.getMonth()]
  };
}

export function fmtQty(q, u) {
  if (!q) return '';
  if (u === 'g' || u === 'ml') {
    const r = Math.round(q / 10) * 10 || Math.round(q);
    if (r >= 1000) return String((r / 1000).toFixed(1)).replace('.', ',') + (u === 'g' ? ' kg' : ' l');
    return r + ' ' + u;
  }
  if (u === 'pers.') return q + ' pers.';
  const h = Math.ceil(q * 2) / 2;
  return String(h).replace('.', ',') + ' ' + u;
}

export const parseNum = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };

// Opties van een onderdeel, met "Kies ik in de winkel" altijd vooraan.
export const partOptions = (part) => [{ name: KIES, ingredients: [] }].concat(part.options || []);

// Korte opsomming van een samengestelde maaltijd voor de week, zonder aardappelen.
export function samenSummary(meal, picks) {
  return (meal.parts || [])
    .filter((pt) => !/^aardappel/i.test((pt.name || '').trim()))
    .map((pt, k0) => {
      const k = (meal.parts || []).indexOf(pt);
      const o = partOptions(pt)[(picks || [])[k] || 0] || { name: KIES };
      return o.name === KIES ? (pt.name || '').toLowerCase() + ' naar keuze' : o.name;
    })
    .join(', ');
}

export function slotFilled(slot) { return !!(slot && (slot.meal_id || slot.mark)); }

// Statistiek per maaltijd uit de planning (dagen t/m vandaag tellen als gegeten).
export function mealStats(slots, today) {
  const st = {};
  slots.forEach((s) => {
    if (!s.meal_id || s.day > today) return;
    const cur = st[s.meal_id] || { times: 0, lastDay: null };
    cur.times++;
    if (!cur.lastDay || s.day > cur.lastDay) cur.lastDay = s.day;
    st[s.meal_id] = cur;
  });
  Object.keys(st).forEach((k) => { st[k].last = daysBetween(st[k].lastDay, today); });
  return st;
}

// Hoe hoger, hoe eerder in de stapel: lang niet gegeten + vaak gekozen.
export function score(stat) {
  const last = stat ? Math.min(stat.last, 90) : 45;
  const times = stat ? Math.min(stat.times, 20) : 0;
  return last + times * 3;
}

export function activePrograms(programs, today) {
  return programs.filter((p) => p.end_date >= today).sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
}

export function programDays(p, today) {
  return range(p.start_date > today ? p.start_date : today, p.end_date);
}

export function programOf(programs, day) {
  return programs.find((p) => day >= p.start_date && day <= p.end_date);
}

export function openDays({ programs, slotsByDay, stdDays, today }) {
  const out = [];
  activePrograms(programs, today).forEach((p) => {
    programDays(p, today).forEach((d) => {
      const s = slotsByDay[d];
      if (stdDays.indexOf(dayInfo(d).dow) < 0) return;
      if (slotFilled(s) || (s && s.shopped)) return;
      out.push(d);
    });
  });
  return out;
}

export function buildDeck({ meals, categoryId, target, programs, slotsByDay, stats, skipped }) {
  const p = target ? programOf(programs, target) : null;
  const planned = new Set();
  if (p) range(p.start_date, p.end_date).forEach((d) => { const s = slotsByDay[d]; if (d !== target && s && s.meal_id) planned.add(s.meal_id); });
  const list = meals
    .filter((m) => !m.archived)
    .filter((m) => !categoryId || m.category_id === categoryId)
    .filter((m) => m.type === 'samen' || !planned.has(m.id))
    .sort((a, b) => score(stats[b.id]) - score(stats[a.id]));
  const fresh = list.filter((m) => skipped.indexOf(m.id) < 0);
  const sk = skipped.map((id) => list.find((m) => m.id === id)).filter(Boolean);
  return fresh.concat(sk);
}

// Boodschappenlijst over alle geplande dagen waarvoor nog niet is ingekocht.
export function shoppingLines({ programs, slotsByDay, mealsById, catsById, persons, today }) {
  const map = {}, order = [], days = [];
  const add = (key, obj) => {
    if (!map[key]) { map[key] = obj; order.push(key); }
    else if (obj.q) map[key].q = (map[key].q || 0) + obj.q;
  };
  activePrograms(programs, today).forEach((p) => {
    programDays(p, today).forEach((d) => {
      const s = slotsByDay[d];
      if (!s || s.shopped || s.mark || !s.meal_id) return;
      const m = mealsById[s.meal_id]; if (!m) return;
      const cat = m.category_id ? catsById[m.category_id] : null;
      if (cat && cat.counts_for_shopping === false) return;
      days.push(d);
      if (m.type === 'samen') {
        (m.parts || []).forEach((pt, k) => {
          const opts = partOptions(pt);
          const o = opts[(s.picks || [])[k] || 0] || opts[0];
          if (o.name === KIES) {
            add('kies|' + pt.name, { name: pt.name + ' naar keuze', q: persons, u: 'pers.', a: pt.afd || 'Overig', note: 'Kies je in de winkel' });
          } else if (!o.ingredients || !o.ingredients.length) {
            add('opt|' + o.name.toLowerCase(), { name: o.name, q: persons, u: 'pers.', a: pt.afd || 'Overig' });
          } else {
            o.ingredients.forEach((x) => add(x.n.toLowerCase() + '|' + x.u, { name: x.n, q: x.q ? x.q * persons : 0, u: x.u, a: x.a || 'Overig' }));
          }
        });
      } else if (!(m.ingredients || []).length) {
        add('rem|' + m.id, { name: m.name, q: 0, u: '', a: 'Overig', note: 'Ingrediënten nog niet ingevuld' });
      } else {
        m.ingredients.forEach((x) => add(x.n.toLowerCase() + '|' + x.u, { name: x.n, q: x.q ? x.q * persons : 0, u: x.u, a: x.a || 'Overig' }));
      }
      (s.extras || []).forEach((e) => add('ex|' + e.toLowerCase(), { name: e, q: 0, u: '', a: 'Overig', note: 'Extra bij ' + m.name }));
    });
  });
  return { lines: order.map((k) => Object.assign({ key: k }, map[k])), days };
}

// Alle ingrediënten die al eens gebruikt zijn (voor automatisch aanvullen).
export function knownIngredients(meals) {
  const map = {};
  const put = (x) => { if (x && x.n && !map[x.n.toLowerCase()]) map[x.n.toLowerCase()] = x; };
  meals.forEach((m) => {
    (m.ingredients || []).forEach(put);
    (m.parts || []).forEach((pt) => (pt.options || []).forEach((o) => (o.ingredients || []).forEach(put)));
  });
  return Object.values(map).sort((a, b) => a.n.localeCompare(b.n, 'nl'));
}

const CAT_TINTS = ['#1F3A2C', '#3A3120', '#352E24', '#3A2723', '#26361F', '#3A2531', '#212C3A', '#2C2738', '#1E3434', '#33302A'];
// Achtergrond met foto en een donker verloop, zodat tekst leesbaar blijft.
export const photoBg = (url) => ({
  backgroundImage: 'linear-gradient(90deg, rgba(14,19,16,.94) 0%, rgba(14,19,16,.78) 45%, rgba(14,19,16,.35) 100%), url(' + url + ')',
  backgroundSize: 'cover', backgroundPosition: 'center'
});

export function catTint(categories, id) {
  const i = categories.findIndex((c) => c.id === id);
  return i < 0 ? '#26302B' : CAT_TINTS[i % CAT_TINTS.length];
}

// Foto verkleinen voor upload (max 1200 px, jpeg).
export function resizeImage(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto verkleinen mislukt'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto kon niet worden gelezen')); };
    img.src = url;
  });
}
