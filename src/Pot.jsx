import React, { useEffect, useState } from 'react';
import { dayInfo, openDays, programOf, range, score, partOptions, KIES, catTint, photoBg } from './logic.js';
import { IcX, IcUp, IcDown } from './icons.jsx';

// "Wat de pot schaft": open dagen willekeurig (maar slim) vullen, vastzetten, opnieuw husselen.
const IcShuffle = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>;
const IcLock = ({ open }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d={open ? 'M8 11V7a4 4 0 017.6-1.7' : 'M8 11V7a4 4 0 018 0v4'} /></svg>;

export default function Pot({ ctx, onStop }) {
  const { db, d, actions, today, photoUrls, setSheet, say } = ctx;
  const storeKey = 'eten-pot-' + db.household.id;
  const std = db.household.std_days || [];
  const cats = db.categories.slice().sort((a, b) => a.position - b.position);
  const halenIds = new Set(db.categories.filter((c) => c.counts_for_shopping === false).map((c) => c.id));

  const pick = (row, rows) => {
    const used = new Set();
    const p = programOf(db.programs, row.day);
    if (p) range(p.start_date, p.end_date).forEach((x) => { const s = d.slotsByDay[x]; if (x !== row.day && s && s.meal_id) used.add(s.meal_id); });
    rows.forEach((o) => { if (o !== row && o.mealId) used.add(o.mealId); });
    const cands = db.meals.filter((m) => !m.archived
      && (row.cat ? m.category_id === row.cat : !halenIds.has(m.category_id))
      && (m.type === 'samen' || !used.has(m.id)));
    if (!cands.length) {
      const cn = row.cat && d.catsById[row.cat] ? d.catsById[row.cat].name : null;
      return Object.assign({}, row, { mealId: null, picks: [], note: cn ? 'Geen andere ' + cn + ' meer' : 'Geen maaltijden meer over' });
    }
    const w = cands.map((m) => 5 + score(d.stats[m.id]));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while (r > w[i] && i < w.length - 1) { r -= w[i]; i++; }
    const m = cands[i];
    const picks = m.type === 'samen' ? (m.parts || []).map((pt) => { const n = partOptions(pt).length; return n > 1 ? 1 + Math.floor(Math.random() * (n - 1)) : 0; }) : [];
    return Object.assign({}, row, { mealId: m.id, picks, note: '' });
  };
  const shuffle = (rows, only) => {
    const out = rows.slice();
    out.forEach((row, k) => {
      if (row.saved || row.locked || (only != null && only !== k)) return;
      out[k] = pick(out[k], out.map((o, j) => (j === k ? Object.assign({}, o, { mealId: null }) : o)));
    });
    return out;
  };
  const fresh = () => {
    const days = openDays({ programs: db.programs, slotsByDay: d.slotsByDay, stdDays: std, today });
    return shuffle(days.map((x) => { const s = d.slotsByDay[x]; return { day: x, cat: s && s.mode === 'cat' ? s.category_id : null, mealId: null, picks: [], locked: false, saved: false, note: '' }; }));
  };

  const [rows, setRows] = useState(() => {
    // Concept van eerder op dit toestel terughalen, zolang die dagen nog open zijn.
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
      if (saved && saved.length) {
        const open = new Set(openDays({ programs: db.programs, slotsByDay: d.slotsByDay, stdDays: std, today }));
        const keep = saved.filter((r) => !r.saved && open.has(r.day) && (!r.mealId || d.mealsById[r.mealId]));
        if (keep.length) return keep;
      }
    } catch (e) { /* geen opslag */ }
    return fresh();
  });
  const [catFor, setCatFor] = useState(null);
  const [partsFor, setPartsFor] = useState(null);

  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(rows)); } catch (e) { /* geen opslag */ } }, [rows, storeKey]);

  const save = (which) => {
    let n = 0;
    const next = rows.map((r) => {
      if (r.saved || !r.mealId || (which === 'locked' && !r.locked)) return r;
      actions.setSlot(r.day, { mode: r.cat ? 'cat' : 'vast', category_id: r.cat, meal_id: r.mealId, picks: r.picks || [], extras: [], mark: null, shopped: false });
      n++;
      return Object.assign({}, r, { saved: true, locked: true });
    });
    setRows(next);
    if (n) say(n + (n === 1 ? ' maaltijd staat' : ' maaltijden staan') + ' nu in het weekmenu.');
  };

  if (!rows.length) {
    return (
      <div className="page">
        <div className="row between"><h1>Wat de pot schaft</h1><button className="btn-pill" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }} onClick={onStop}>Stoppen</button></div>
        <div className="card center muted" style={{ padding: '24px 16px' }}>Er zijn geen open dagen. Maak eerst een (nieuw) weekprogramma.</div>
        <button className="btn" onClick={() => setSheet({ type: 'period', then: 'pot' })}>Nieuw weekprogramma</button>
      </div>
    );
  }

  const canShuffle = rows.some((r) => !r.locked && !r.saved);
  const nLocked = rows.filter((r) => r.locked && !r.saved && r.mealId).length;
  const anyOpen = rows.some((r) => !r.saved && r.mealId);
  const catRow = catFor != null ? rows[catFor] : null;
  const partRow = partsFor != null ? rows[partsFor] : null;
  const partMeal = partRow && partRow.mealId ? d.mealsById[partRow.mealId] : null;

  return (
    <div className="page">
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 14 }}>{dayInfo(rows[0].day).short} – {dayInfo(rows[rows.length - 1].day).short}</div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Wat de pot schaft</div>
        </div>
        <button className="btn-pill" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }} onClick={onStop}>Stoppen</button>
      </div>
      <div className="muted" style={{ fontSize: 14 }}>Zet vast wat je goed vindt en hussel de rest opnieuw. Tik op een maaltijd om hem te bekijken of aan te passen.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, k) => {
          const m = r.mealId ? d.mealsById[r.mealId] : null;
          const info = dayInfo(r.day);
          const photo = m && m.photo_path ? photoUrls[m.photo_path] : null;
          const sub = m && m.type === 'samen' ? (m.parts || []).map((pt, j) => { const o = partOptions(pt)[(r.picks || [])[j] || 0] || { name: KIES }; return o.name === KIES ? pt.letter + ': in de winkel' : o.name; }).join(' · ') : '';
          const set = (patch) => setRows(rows.map((o, j) => (j === k ? Object.assign({}, o, patch) : o)));
          return (
            <div key={r.day} style={Object.assign({ display: 'flex', alignItems: 'center', gap: 10, minHeight: 66, padding: '8px 6px 8px 8px', borderRadius: 14, border: '1px solid ' + (r.locked ? 'var(--green-line)' : '#2A342F'), background: r.saved ? '#16201B' : r.locked ? '#1E2E25' : 'var(--surface2)', opacity: r.saved ? 0.75 : 1 }, photo ? photoBg(photo) : null)} className={photo ? 'has-photo' : ''}>
              <div className="badge" style={Object.assign({ width: 44, height: 44 }, info.wkd ? { background: '#4A3A1F', color: '#F4D9A8' } : null)}><span>{info.dowCap}</span><b style={{ fontSize: 20 }}>{info.num}</b></div>
              {m && !photo && <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 10, backgroundSize: 'cover', backgroundPosition: 'center', background: photo ? 'center / cover url(' + photo + ')' : catTint(db.categories, m.category_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, opacity: 0.9 }}>{!photo && m.name.charAt(0)}</div>}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <button style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', maxWidth: '100%' }} disabled={!m}
                  onClick={() => { if (!m) return; if (m.type === 'samen' && !r.saved) setPartsFor(k); else setSheet({ type: 'detail', mealId: m.id }); }}>
                  <div style={{ fontSize: 16, fontWeight: m ? 600 : 500, color: m ? (photo ? '#fff' : 'var(--ink)') : 'var(--warn-ink)', textShadow: photo ? '0 1px 3px rgba(0,0,0,.6)' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m ? m.name : r.note || 'Nog niets'}</div>
                  {sub && <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
                </button>
                {r.saved ? <span className="tag" style={{ background: '#1F3A2C', color: 'var(--green-ink)', fontSize: 12 }}>In weekmenu</span>
                  : <button className="mini" style={{ margin: 0, minHeight: 30 }} onClick={() => setCatFor(k)}>{r.cat && d.catsById[r.cat] ? d.catsById[r.cat].name : 'Alles'} ▾</button>}
              </div>
              {!r.saved && (
                <>
                  <button className="icon-btn plain" aria-label={'Alleen ' + info.long + ' opnieuw husselen'} disabled={r.locked} style={{ color: r.locked ? 'var(--line2)' : 'var(--green-ink)', background: photo ? 'rgba(14,19,16,.6)' : 'transparent' }} onClick={() => setRows(shuffle(rows, k))}><IcShuffle /></button>
                  <button className="icon-btn" aria-pressed={!!r.locked} aria-label={r.locked ? 'Losmaken' : 'Vastzetten'} disabled={!m && !r.locked}
                    style={r.locked ? { border: 'none', background: 'var(--green)', color: '#fff' } : { background: 'var(--bg)', color: 'var(--muted)' }}
                    onClick={() => set({ locked: !r.locked })}><IcLock open={!r.locked} /></button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn btn-accent" style={{ minHeight: 56, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} disabled={!canShuffle} onClick={() => setRows(shuffle(rows))}><IcShuffle size={22} />Husselen</button>
      <div className="row">
        <button className="btn" style={{ flex: 1, fontSize: 15 }} disabled={!nLocked} onClick={() => save('locked')}>Vastgezette opslaan ({nLocked})</button>
        <button className="btn btn-ghost" style={{ flex: 1, fontSize: 15 }} disabled={!anyOpen} onClick={() => save('all')}>Alles opslaan</button>
      </div>
      {rows.every((r) => r.saved) && <button className="btn btn-plain" onClick={() => { try { localStorage.removeItem(storeKey); } catch (e) { /* */ } onStop(); }}>Klaar</button>}

      {catRow && (
        <div className="overlay">
          <button className="scrim" aria-label="Sluiten" onClick={() => setCatFor(null)} />
          <div className="sheet">
            <div className="sheet-head"><h2>Categorie voor {dayInfo(catRow.day).long}</h2><button className="icon-btn" aria-label="Sluiten" onClick={() => setCatFor(null)}><IcX size={20} /></button></div>
            <div className="muted" style={{ fontSize: 15 }}>Bij "Alles" doen categorieën die niet meetellen voor de boodschappen (zoals Bestellen/halen) niet mee.</div>
            <div className="chips">
              {[{ id: null, name: 'Alles' }].concat(cats).map((c) => {
                const on = (catRow.cat || null) === c.id;
                return <button key={c.id || 'alles'} className={on ? 'chip on' : 'chip'} onClick={() => {
                  const next = rows.map((o, j) => (j === catFor ? Object.assign({}, o, { cat: c.id, locked: false }) : o));
                  setRows(shuffle(next, catFor)); setCatFor(null);
                }}>{c.name}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      {partMeal && (
        <div className="overlay">
          <button className="scrim" aria-label="Sluiten" onClick={() => setPartsFor(null)} />
          <div className="sheet">
            <div className="sheet-head"><h2>{partMeal.name} aanpassen</h2><button className="icon-btn" aria-label="Sluiten" onClick={() => setPartsFor(null)}><IcX size={20} /></button></div>
            {(partMeal.parts || []).map((pt, j) => {
              const opts = partOptions(pt), i = (partRow.picks || [])[j] || 0, o = opts[i] || opts[0];
              const step = (dir) => setRows(rows.map((x, q) => { if (q !== partsFor) return x; const pk = (partMeal.parts || []).map((p2, z) => (x.picks || [])[z] || 0); pk[j] = (pk[j] + dir + opts.length) % opts.length; return Object.assign({}, x, { picks: pk }); }));
              return (
                <div key={j} className="strip" style={{ minHeight: 64 }}>
                  <div className="letter">{pt.letter || pt.name.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="muted small">{pt.name}</div><div className={o.name === KIES ? 'opt kies' : 'opt'} style={{ fontSize: 19 }}>{o.name}</div></div>
                  <button className="icon-btn plain" style={{ color: 'var(--green-ink)' }} aria-label={'Vorige keuze voor ' + pt.name} onClick={() => step(-1)}><IcUp size={20} /></button>
                  <button className="icon-btn plain" style={{ color: 'var(--green-ink)' }} aria-label={'Volgende keuze voor ' + pt.name} onClick={() => step(1)}><IcDown size={20} /></button>
                </div>
              );
            })}
            <button className="btn btn-ghost" onClick={() => { setSheet({ type: 'detail', mealId: partMeal.id }); setPartsFor(null); }}>{partMeal.name} bekijken</button>
            <button className="btn" onClick={() => setPartsFor(null)}>Klaar</button>
          </div>
        </div>
      )}
    </div>
  );
}
