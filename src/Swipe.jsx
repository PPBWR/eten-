import React, { useRef, useState } from 'react';
import { dayInfo, openDays, buildDeck, partOptions, KIES, catTint } from './logic.js';
import { IcX, IcCheck, IcUp, IcDown, IcInfo } from './icons.jsx';
import Pot from './Pot.jsx';

export default function Swipe({ ctx, req }) {
  const { db, d, actions, today, photoUrls, setSheet, setTab } = ctx;
  const [mode, setMode] = useState(req.mode || null);
  const [targetDay, setTargetDay] = useState(req.targetDay || null);
  const [filterCat, setFilterCat] = useState(null); // null = automatisch, 'all' = alles, of een categorie-id
  const [skipped, setSkipped] = useState([]);
  const [picks, setPicks] = useState([]);
  const [extraSel, setExtraSel] = useState([]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [strip, setStrip] = useState({ i: null, dy: 0 });
  const g = useRef(null);
  const at = useRef(null);

  const std = db.household.std_days || [];
  const open = openDays({ programs: db.programs, slotsByDay: d.slotsByDay, stdDays: std, today });
  let target = null;
  if (mode === 'vanavond') target = today;
  else if (mode === 'one') target = targetDay || today;
  else if (mode === 'week') target = targetDay || open[0] || null;
  const slot = target ? d.slotsByDay[target] : null;
  const autoCat = mode === 'week' && slot && slot.mode === 'cat' ? slot.category_id : null;
  const catId = filterCat === 'all' ? null : (filterCat || autoCat);

  let deck = [];
  if (mode === 'one') { const m = d.mealsById[req.mealId]; deck = m ? [m] : []; }
  else if (mode && target) deck = buildDeck({ meals: db.meals, categoryId: catId, target, programs: db.programs, slotsByDay: d.slotsByDay, stats: d.stats, skipped });
  const cur = deck[0];

  const reset = () => { setDx(0); setPicks([]); setExtraSel([]); setStrip({ i: null, dy: 0 }); };

  const commit = (m) => {
    const day = target;
    const tonight = mode === 'vanavond' || (mode === 'one' && day === today);
    const msg = tonight ? 'Vanavond eten we ' + m.name + '.' : m.name + ' staat op ' + dayInfo(day).long + '.';
    actions.assignMeal(day, m, m.type === 'samen' ? (m.parts || []).map((pt, k) => picks[k] || 0) : [], extraSel, msg);
    setSkipped((s) => s.filter((id) => id !== m.id));
    reset();
    if (mode === 'week') { setTargetDay(null); setFilterCat(null); }
    else setTab('week');
  };
  const accept = () => {
    if (!cur || !target) return;
    const m = cur; setDx(560); clearTimeout(at.current); at.current = setTimeout(() => commit(m), 190);
  };
  const skip = () => {
    if (!cur) return;
    if (mode === 'one') { setTab('meals'); return; }
    const m = cur; setDx(-560); clearTimeout(at.current);
    at.current = setTimeout(() => { setSkipped((s) => s.filter((id) => id !== m.id).concat([m.id])); reset(); }, 190);
  };
  const step = (k, dir) => {
    if (!cur || cur.type !== 'samen') return;
    const n = partOptions(cur.parts[k]).length;
    setPicks((p) => { const c = cur.parts.map((x, j) => p[j] || 0); c[k] = (c[k] + dir + n) % n; return c; });
  };

  const onDown = (e) => {
    const el = e.target.closest ? e.target.closest('[data-strip]') : null;
    g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, el: e.currentTarget, strip: el ? Number(el.getAttribute('data-strip')) : null, dx: 0, dy: 0 };
  };
  const onMove = (e) => {
    const s = g.current; if (!s || e.pointerId !== s.id) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      try { s.el.setPointerCapture(s.id); } catch (err) { /* niet ondersteund */ }
    }
    if (s.axis === 'x') { s.dx = mx; setDx(mx); }
    else if (s.strip != null) { s.dy = my; setStrip({ i: s.strip, dy: my }); }
  };
  const onUp = () => {
    const s = g.current; g.current = null;
    if (!s || !s.axis) return;
    if (s.axis === 'x') { if (s.dx > 90) accept(); else if (s.dx < -90) skip(); else setDx(0); }
    else if (s.strip != null) { if (s.dy < -24) step(s.strip, 1); else if (s.dy > 24) step(s.strip, -1); setStrip({ i: null, dy: 0 }); }
  };

  if (mode === 'pot') return <Pot ctx={ctx} onStop={() => setMode(null)} />;

  if (!mode) {
    return (
      <div className="page">
        <h1 style={{ marginBottom: 6, textAlign: 'center' }}>Wat gaan we doen?</h1>
        <button className="choice primary" onClick={() => setMode('week')} disabled={!open.length}>
          <b>Weekprogramma vullen</b>
          <span>{open.length ? 'Nog ' + open.length + (open.length === 1 ? ' dag' : ' dagen') + ' open, vanaf ' + dayInfo(open[0]).long.toLowerCase() : 'Geen open dagen. Maak eerst een (nieuw) weekprogramma.'}</span>
        </button>
        <button className="choice" onClick={() => setSheet({ type: 'period' })}>
          <b>Nieuw weekprogramma</b><span>Kies zelf de start- en einddag</span>
        </button>
        <button className="choice" onClick={() => setMode('vanavond')}>
          <b>Vrij swipen voor vanavond</b><span>Gewoon kijken waar je trek in hebt</span>
        </button>
        <button className="choice" onClick={() => setMode('pot')}>
          <b>Wat de pot schaft</b><span>Laat ons de keuze voor je maken</span>
        </button>
      </div>
    );
  }

  if (mode === 'week' && !target) {
    return (
      <div className="page center" style={{ justifyContent: 'center', minHeight: '100%' }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Alle dagen zijn gevuld</div>
        <div className="muted">Je boodschappenlijst staat klaar.</div>
        <button className="btn" onClick={() => setTab('shop')}>Naar boodschappen</button>
        <button className="btn btn-plain" onClick={() => setTab('week')}>Week bekijken</button>
      </div>
    );
  }

  const kickerCat = catId ? (d.catsById[catId] || {}).name : null;
  const kicker = mode === 'vanavond' ? 'Vrij swipen' + (kickerCat ? ' · ' + kickerCat : '') : mode === 'one' ? 'Kies voor' : 'Kies voor' + (kickerCat ? ' · ' + kickerCat : '');
  const title = mode === 'vanavond' ? 'Wat eten we vanavond?' : dayInfo(target).long;
  const cats = db.categories.slice().sort((a, b) => a.position - b.position);
  const chipOn = (id) => (id === 'all' ? !catId : catId === id);

  return (
    <div className="page page-swipe">
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 14 }}>{kicker}</div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
        </div>
        <button className="btn-pill" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }} onClick={() => { setMode(null); setTargetDay(null); reset(); }}>Stoppen</button>
      </div>

      {cur ? (
        <>
          <div className="deck">
            <div className="swipe-card" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ transform: 'translateX(' + dx + 'px) rotate(' + (dx / 22).toFixed(2) + 'deg)', transition: g.current && g.current.axis === 'x' ? 'none' : 'transform .19s ease-out' }}>
              {cur.type === 'samen' ? <SamenCard meal={cur} picks={picks} strip={strip} step={step} onInfo={() => setSheet({ type: 'detail', mealId: cur.id })} stat={d.stats[cur.id]} />
                : <CompleetCard meal={cur} cat={cur.category_id ? d.catsById[cur.category_id] : null} tint={catTint(db.categories, cur.category_id)} photo={cur.photo_path ? photoUrls[cur.photo_path] : null} stat={d.stats[cur.id]} onInfo={() => setSheet({ type: 'detail', mealId: cur.id })} />}
              <div className="stamp" style={{ left: 18, borderColor: 'var(--green-ink)', color: 'var(--green-ink)', opacity: Math.max(0, Math.min(1, dx / 90)) }}>Toevoegen</div>
              <div className="stamp" style={{ right: 18, borderColor: 'var(--warn-ink)', color: 'var(--warn-ink)', opacity: Math.max(0, Math.min(1, -dx / 90)) }}>Nu even niet</div>
            </div>
          </div>
          <div className="actions">
            <button className="round" aria-label="Nu even niet" onClick={skip}><IcX size={26} /></button>
            {cur.extras_on && (cur.extras || []).length > 0 && (
              <button className={extraSel.length ? 'chip on' : 'btn-pill'} style={{ minWidth: 96, height: 48 }} onClick={() => setExtraOpen(true)}>{extraSel.length ? 'Extra (' + extraSel.length + ')' : 'Extra'}</button>
            )}
            <button className="round yes" aria-label="Toevoegen" onClick={accept}><IcCheck size={28} /></button>
          </div>
          {mode !== 'one' && <div className="muted small center">{deck.length} {deck.length === 1 ? 'maaltijd' : 'maaltijden'} in deze stapel · minst recent gegeten eerst</div>}
        </>
      ) : (
        <div className="center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{kickerCat ? 'Geen ' + kickerCat + '-maaltijden over' : 'Nog geen maaltijden'}</div>
          <div className="muted">Alles uit deze categorie staat al in dit weekprogramma, of er zit nog niets in. Voeg er een toe of kies hieronder een andere categorie.</div>
          <button className="btn" onClick={() => setSheet({ type: 'edit', categoryId: catId })}>Maaltijd toevoegen</button>
        </div>
      )}

      {mode !== 'one' && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Trek in een categorie?</div>
          <div className="chips-scroll">
            <button className={chipOn('all') ? 'chip on' : 'chip'} onClick={() => { setFilterCat('all'); reset(); }}>Alles</button>
            {cats.map((c) => <button key={c.id} className={chipOn(c.id) ? 'chip on' : 'chip'} onClick={() => { setFilterCat(c.id); reset(); }}>{c.name}</button>)}
          </div>
        </div>
      )}

      {extraOpen && cur && (
        <div className="overlay">
          <button className="scrim" aria-label="Sluiten" onClick={() => setExtraOpen(false)} />
          <div className="sheet">
            <div className="sheet-head"><h2>Extra bij {cur.name}</h2><button className="icon-btn" aria-label="Sluiten" onClick={() => setExtraOpen(false)}><IcX size={20} /></button></div>
            {(cur.extras || []).map((x) => {
              const on = extraSel.indexOf(x) >= 0;
              return (
                <button key={x} aria-pressed={on} className="switch" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => setExtraSel((s) => (on ? s.filter((y) => y !== x) : s.concat([x])))}>
                  <span className={on ? 'box on' : 'box'}>{on && <IcCheck size={16} />}</span><span>{x}</span>
                </button>
              );
            })}
            <button className="btn" onClick={() => setExtraOpen(false)}>Klaar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function lastLabel(stat) { return stat && stat.last >= 30; }

function CompleetCard({ meal, cat, tint, photo, stat, onInfo }) {
  const n = (meal.ingredients || []).length;
  return (
    <>
      <div className="photo" style={photo ? { backgroundImage: 'url(' + photo + ')' } : { background: tint }}>
        {!photo && <><span className="ini">{meal.name.charAt(0)}</span><span className="muted small">Nog geen foto</span></>}
      </div>
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        <div className="chips" style={{ gap: 6 }}>
          <span className="tag">{cat ? cat.name : 'Zonder categorie'}</span>
          {lastLabel(stat) && <span className="tag tag-warn">Lang niet gegeten</span>}
          {cat && cat.counts_for_shopping === false && <span className="tag">Niet op boodschappenlijst</span>}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, paddingRight: 48 }}>{meal.name}</div>
        <div className="muted" style={{ fontSize: 14 }}>{n ? n + ' ingrediënten' : 'Geen ingrediënten ingevuld'}</div>
        <button className="icon-btn" aria-label="Details bekijken" onClick={onInfo} style={{ position: 'absolute', right: 14, bottom: 14, color: 'var(--green-ink)', background: 'var(--bg)' }}><IcInfo /></button>
      </div>
    </>
  );
}

function SamenCard({ meal, picks, strip, step, onInfo, stat }) {
  return (
    <>
      <div className="row between" style={{ padding: '16px 18px 12px' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{meal.name}</div>
          <div className="muted small">Swipe elke strook omhoog of omlaag</div>
        </div>
        <div className="row">
          {lastLabel(stat) && <span className="tag tag-warn">Lang niet gegeten</span>}
          <button className="icon-btn" aria-label="Details bekijken" onClick={onInfo} style={{ color: 'var(--green-ink)', background: 'var(--bg)' }}><IcInfo /></button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 10px' }}>
        {(meal.parts || []).map((pt, k) => {
          const opts = partOptions(pt), i = picks[k] || 0, o = opts[i] || opts[0];
          const move = strip.i === k ? Math.max(-30, Math.min(30, strip.dy * 0.45)) : 0;
          return (
            <div key={k} className="strip" data-strip={k}>
              <div className="letter">{pt.letter || pt.name.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0, transform: 'translateY(' + move + 'px)' }}>
                <div className="muted small">{pt.name} · {i + 1}/{opts.length}</div>
                <div className={o.name === KIES ? 'opt kies' : 'opt'}>{o.name}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button className="icon-btn plain" style={{ color: 'var(--green-ink)' }} aria-label={'Vorige keuze voor ' + pt.name} onClick={() => step(k, -1)}><IcUp size={20} /></button>
                <button className="icon-btn plain" style={{ color: 'var(--green-ink)' }} aria-label={'Volgende keuze voor ' + pt.name} onClick={() => step(k, 1)}><IcDown size={20} /></button>
              </div>
            </div>
          );
        })}
        {!(meal.parts || []).some((pt) => (pt.options || []).length) && (
          <div className="muted small center" style={{ padding: 4 }}>Nog geen soorten ingevuld. Voeg ze toe via de info-knop → Bewerken.</div>
        )}
      </div>
    </>
  );
}
