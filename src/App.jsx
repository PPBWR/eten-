import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import { todayISO, addDays, mealStats, range, activePrograms } from './logic.js';
import { IcWeek, IcSwipe, IcCart, IcMeals } from './icons.jsx';
import Week from './Week.jsx';
import Swipe from './Swipe.jsx';
import Shop from './Shop.jsx';
import Meals from './Meals.jsx';
import Sheets from './Sheets.jsx';
import { Login, NewPassword } from './Login.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getSession().then((s) => { if (alive) setSession(s || null); }).catch(() => alive && setSession(null));
    const off = api.onAuth((evt, s) => {
      if (evt === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s || null);
    });
    return () => { alive = false; off && off(); };
  }, []);

  if (session === undefined) return <div className="splash">Eten!</div>;
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
  return <Main />;
}

function Main() {
  const [db, setDb] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [photoUrls, setPhotoUrls] = useState({});
  const [tab, setTab] = useState('week');
  const [sheet, setSheet] = useState(null);
  const [swipeReq, setSwipeReq] = useState({ n: 0, mode: null });
  const [toast, setToast] = useState('');
  const tt = useRef(null);
  const today = todayISO();

  const say = useCallback((t) => { clearTimeout(tt.current); setToast(t); tt.current = setTimeout(() => setToast(''), 3200); }, []);

  const reload = useCallback(async () => {
    try {
      await api.ensureHousehold();
      const d = await api.loadAll(addDays(todayISO(), -400));
      setDb(d); setLoadError('');
      const paths = d.meals.map((m) => m.photo_path).filter(Boolean);
      if (paths.length) api.photoUrls(paths).then((u) => setPhotoUrls((p) => Object.assign({}, p, u))).catch(() => {});
    } catch (e) {
      setLoadError(e.message || 'Onbekende fout');
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  // Lokale wijziging direct tonen, daarna opslaan; bij een fout opnieuw laden.
  const run = useCallback(async (local, remote, okMsg) => {
    if (local) setDb((d) => local(d));
    try {
      const r = await remote();
      if (okMsg) say(okMsg);
      return r;
    } catch (e) {
      say('Opslaan mislukt: ' + (e.message || 'onbekende fout') + '. De gegevens worden opnieuw geladen.');
      reload();
      return null;
    }
  }, [reload, say]);

  const derived = useMemo(() => {
    if (!db) return null;
    const slotsByDay = {}; db.slots.forEach((s) => { slotsByDay[s.day] = s; });
    const mealsById = {}; db.meals.forEach((m) => { mealsById[m.id] = m; });
    const catsById = {}; db.categories.forEach((c) => { catsById[c.id] = c; });
    const marksByKey = {}; db.marks.forEach((m) => { marksByKey[m.key] = m; });
    return { slotsByDay, mealsById, catsById, marksByKey, stats: mealStats(db.slots, today), active: activePrograms(db.programs, today) };
  }, [db, today]);

  const actions = useMemo(() => {
    if (!db) return {};
    const hid = db.household.id;
    const setSlotLocal = (row) => (d) => Object.assign({}, d, { slots: d.slots.filter((s) => s.day !== row.day).concat([row]) });
    const slotRow = (day, patch) => {
      const cur = derived.slotsByDay[day] || { household_id: hid, day, mode: 'leeg', category_id: null, meal_id: null, picks: [], extras: [], mark: null, shopped: false };
      return Object.assign({}, cur, patch, { household_id: hid, day });
    };
    return {
      setSlot: (day, patch, msg) => { const row = slotRow(day, patch); return run(setSlotLocal(row), () => api.upsertSlot(row), msg); },
      clearDay: (day) => run((d) => Object.assign({}, d, { slots: d.slots.filter((s) => s.day !== day) }), () => api.deleteSlots(hid, [day])),
      assignMeal: (day, meal, picks, extras, msg) => {
        const cur = derived.slotsByDay[day];
        const row = slotRow(day, { mode: cur && cur.mode === 'cat' ? 'cat' : 'vast', meal_id: meal.id, picks: picks || [], extras: extras || [], mark: null, shopped: false });
        return run(setSlotLocal(row), () => api.upsertSlot(row), msg);
      },
      createProgram: async (start, end) => {
        const r = await run(null, () => api.insertProgram({ household_id: hid, start_date: start, end_date: end }));
        if (r) setDb((d) => Object.assign({}, d, { programs: d.programs.concat([r]) }));
        return r;
      },
      toggleReady: (p) => run((d) => Object.assign({}, d, { programs: d.programs.map((x) => (x.id === p.id ? Object.assign({}, x, { ready: !x.ready }) : x)) }), () => api.updateProgram(p.id, { ready: !p.ready }), p.ready ? null : 'Weekprogramma staat op gereed. De boodschappenlijst gaat uit van de gevulde dagen.'),
      deleteProgram: (p) => {
        const days = range(p.start_date > today ? p.start_date : today, p.end_date).filter((day) => derived.slotsByDay[day] && !derived.slotsByDay[day].shopped);
        return run((d) => Object.assign({}, d, { programs: d.programs.filter((x) => x.id !== p.id), slots: d.slots.filter((s) => days.indexOf(s.day) < 0) }),
          async () => { await api.deleteSlots(hid, days); await api.deleteProgram(p.id); }, 'Weekprogramma verwijderd.');
      },
      finishRound: (days) => run((d) => Object.assign({}, d, { slots: d.slots.map((s) => (days.indexOf(s.day) >= 0 ? Object.assign({}, s, { shopped: true }) : s)), marks: [] }),
        async () => { await api.markShopped(hid, days); await api.clearMarks(hid); }, 'Ronde afgerond. Deze dagen tellen niet meer mee voor de volgende lijst.'),
      setMark: (key, patch) => {
        const cur = derived.marksByKey[key] || { household_id: hid, key, in_home: false, in_cart: false };
        const row = Object.assign({}, cur, patch, { household_id: hid, key });
        return run((d) => Object.assign({}, d, { marks: d.marks.filter((m) => m.key !== key).concat([row]) }), () => api.upsertMark(row));
      },
      updateHousehold: (patch) => run((d) => Object.assign({}, d, { household: Object.assign({}, d.household, patch) }), () => api.updateHousehold(hid, patch)),
      addCategory: async (name) => {
        const r = await run(null, () => api.insertCategory({ household_id: hid, name, position: db.categories.length }), 'Categorie ' + name + ' toegevoegd.');
        if (r) setDb((d) => Object.assign({}, d, { categories: d.categories.concat([r]) }));
      },
      updateCategory: (id, patch, msg) => run((d) => Object.assign({}, d, { categories: d.categories.map((c) => (c.id === id ? Object.assign({}, c, patch) : c)) }), () => api.updateCategory(id, patch), msg),
      deleteCategory: (c) => run((d) => Object.assign({}, d, {
        categories: d.categories.filter((x) => x.id !== c.id),
        meals: d.meals.map((m) => (m.category_id === c.id ? Object.assign({}, m, { category_id: null }) : m)),
        slots: d.slots.map((s) => (s.category_id === c.id ? Object.assign({}, s, { category_id: null, mode: s.meal_id ? 'vast' : 'leeg' }) : s))
      }), () => api.deleteCategory(c.id), c.name + ' is verwijderd.'),
      moveCategory: async (c, dir) => {
        const list = db.categories.slice().sort((a, b) => a.position - b.position);
        const i = list.findIndex((x) => x.id === c.id), j = i + dir;
        if (j < 0 || j >= list.length) return;
        const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
        const updated = list.map((x, k) => Object.assign({}, x, { position: k }));
        await run((d) => Object.assign({}, d, { categories: updated }), () => Promise.all([api.updateCategory(updated[i].id, { position: i }), api.updateCategory(updated[j].id, { position: j })]));
      },
      saveMeal: async (draft, photoBlob) => {
        const fields = { name: draft.name.trim(), category_id: draft.category_id || null, type: draft.type, prep: draft.prep || '', extras_on: !!draft.extras_on, extras: draft.extras || [], ingredients: draft.ingredients || [], parts: (draft.parts || []).filter((pt) => (pt.name || '').trim()).map((pt) => Object.assign({}, pt, { name: pt.name.trim(), letter: (pt.letter || pt.name.trim().charAt(0)).toUpperCase() })), archived: !!draft.archived };
        let row = draft.id ? await run(null, () => api.updateMeal(draft.id, fields)) : await run(null, () => api.insertMeal(Object.assign({ household_id: hid }, fields)));
        if (!row) return null;
        if (photoBlob) {
          const path = hid + '/' + row.id + '-' + Date.now() + '.jpg';
          const up = await run(null, async () => { await api.uploadPhoto(path, photoBlob); return api.updateMeal(row.id, { photo_path: path }); });
          if (up) {
            if (row.photo_path) api.removePhoto(row.photo_path).catch(() => {});
            row = up;
            setPhotoUrls((p) => Object.assign({}, p, { [path]: URL.createObjectURL(photoBlob) }));
          }
        }
        setDb((d) => Object.assign({}, d, { meals: d.meals.some((m) => m.id === row.id) ? d.meals.map((m) => (m.id === row.id ? row : m)) : d.meals.concat([row]) }));
        say(fields.archived ? fields.name + ' is uit het aanbod gehaald.' : fields.name + (draft.id ? ' is bijgewerkt.' : ' staat in je aanbod.'));
        return row;
      },
      updatePrep: (id, prep) => run((d) => Object.assign({}, d, { meals: d.meals.map((m) => (m.id === id ? Object.assign({}, m, { prep }) : m)) }), () => api.updateMeal(id, { prep })),
      logout: () => api.signOut()
    };
  }, [db, derived, run, say, today]);

  if (loadError) {
    return (
      <div className="app"><div className="login">
        <div className="logo">Eten!</div>
        <div className="error">De gegevens konden niet worden geladen: {loadError}</div>
        <button className="btn" onClick={reload}>Opnieuw proberen</button>
        <button className="btn btn-plain" onClick={() => api.signOut()}>Uitloggen</button>
      </div></div>
    );
  }
  if (!db) return <div className="splash">Eten!</div>;

  const ctx = { db, d: derived, actions, today, photoUrls, say, setSheet, setTab,
    startSwipe: (req) => { setSwipeReq((r) => Object.assign({ n: r.n + 1 }, req)); setTab('swipe'); setSheet(null); } };

  return (
    <div className="app">
      <div className="main">
        {tab === 'week' && <Week ctx={ctx} />}
        {tab === 'swipe' && <Swipe ctx={ctx} req={swipeReq} key={swipeReq.n} />}
        {tab === 'shop' && <Shop ctx={ctx} />}
        {tab === 'meals' && <Meals ctx={ctx} />}
      </div>
      <nav className="nav" aria-label="Hoofdmenu">
        <button aria-current={tab === 'week' ? 'page' : undefined} onClick={() => setTab('week')}><IcWeek size={24} /><span>Week</span></button>
        <button aria-current={tab === 'swipe' ? 'page' : undefined} onClick={() => { setSwipeReq((r) => ({ n: r.n + 1, mode: null })); setTab('swipe'); }}><IcSwipe size={24} /><span>Swipen</span></button>
        <button aria-current={tab === 'shop' ? 'page' : undefined} onClick={() => setTab('shop')}><IcCart size={24} /><span>Boodschappen</span></button>
        <button aria-current={tab === 'meals' ? 'page' : undefined} onClick={() => setTab('meals')}><IcMeals size={24} /><span>Aanbod</span></button>
      </nav>
      {sheet && <Sheets ctx={ctx} sheet={sheet} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
