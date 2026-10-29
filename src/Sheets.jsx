import React, { useEffect, useRef, useState } from 'react';
import { dayInfo, addDays, fmtQty, parseNum, knownIngredients, catTint, UNITS, STD_ORDER, programDays, partOptions, KIES, daysBetween } from './logic.js';
import { IcX, IcUp, IcDown, IcTrash, IcCamera, IcCheck } from './icons.jsx';
import { resizeImage } from './logic.js';

export default function Sheets({ ctx, sheet }) {
  const close = () => ctx.setSheet(null);
  let title = '', body = null;
  switch (sheet.type) {
    case 'slot': title = dayInfo(sheet.day).long; body = <SlotSheet ctx={ctx} day={sheet.day} close={close} />; break;
    case 'period': title = 'Nieuw weekprogramma'; body = <PeriodSheet ctx={ctx} close={close} />; break;
    case 'detail': { const m = ctx.d.mealsById[sheet.mealId]; title = m ? m.name : ''; body = m ? <DetailSheet ctx={ctx} meal={m} /> : null; break; }
    case 'pickday': { const m = ctx.d.mealsById[sheet.mealId]; title = m ? 'Op een dag zetten' : ''; body = m ? <PickDaySheet ctx={ctx} meal={m} /> : null; break; }
    case 'edit': { const m = sheet.mealId ? ctx.d.mealsById[sheet.mealId] : null; title = m ? 'Maaltijd bewerken' : 'Maaltijd toevoegen'; body = <EditSheet ctx={ctx} meal={m} categoryId={sheet.categoryId} close={close} />; break; }
    case 'settings': title = 'Instellingen'; body = <SettingsSheet ctx={ctx} />; break;
    case 'cats': title = 'Categorieën'; body = <CatsSheet ctx={ctx} />; break;
    default: return null;
  }
  return (
    <div className="overlay">
      <button className="scrim" aria-label="Sluiten" onClick={close} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Venster sluiten" onClick={close}><IcX size={20} /></button>
        </div>
        {body}
      </div>
    </div>
  );
}

// ── Dag ─────────────────────────────────────────────────────────────
function SlotSheet({ ctx, day, close }) {
  const { db, d, actions } = ctx;
  const s = d.slotsByDay[day] || {};
  const cats = db.categories.slice().sort((a, b) => a.position - b.position);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!s.shopped && <button className="btn" onClick={() => ctx.startSwipe({ mode: 'week', targetDay: day })}>{s.meal_id ? 'Andere maaltijd kiezen' : 'Swipen voor deze dag'}</button>}
      {s.meal_id && d.mealsById[s.meal_id] && <button className="btn btn-ghost" onClick={() => ctx.setSheet({ type: 'detail', mealId: s.meal_id })}>{d.mealsById[s.meal_id].name} bekijken</button>}
      <div className="label">Categorie voor deze dag</div>
      <div className="chips">
        {cats.map((c) => {
          const on = s.mode === 'cat' && s.category_id === c.id;
          return <button key={c.id} aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => { actions.setSlot(day, on ? { mode: s.meal_id ? 'vast' : 'leeg', category_id: null } : { mode: 'cat', category_id: c.id, meal_id: null, mark: null, picks: [], extras: [] }); close(); }}>{c.name}</button>;
        })}
      </div>
      <div className="label">Markeren</div>
      <div className="chips">
        {['Restjes', 'Uit eten', 'Bestellen'].map((k) => {
          const on = s.mark === k;
          return <button key={k} aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => { actions.setSlot(day, on ? { mark: null } : { mark: k, meal_id: null, picks: [], extras: [] }); close(); }}>{k}</button>;
        })}
      </div>
      <button className="btn btn-danger-text" onClick={() => { actions.clearDay(day); close(); }}>Dag leegmaken</button>
    </div>
  );
}

// ── Nieuw weekprogramma ─────────────────────────────────────────────
function PeriodSheet({ ctx, close }) {
  const { d, actions, today } = ctx;
  const last = d.active.length ? d.active[d.active.length - 1].end_date : null;
  const min = last && last >= today ? addDays(last, 1) : today;
  const [start, setStart] = useState(min);
  const [end, setEnd] = useState(addDays(min, 6));
  const [busy, setBusy] = useState(false);
  const len = daysBetween(start, end) + 1;
  const setS = (v) => { if (v < min) return; setStart(v); if (end < v) setEnd(v); if (daysBetween(v, end) > 13) setEnd(addDays(v, 13)); };
  const setE = (v) => { if (v < start || daysBetween(start, v) > 13) return; setEnd(v); };
  if (d.active.length >= 2) return <div className="muted">Er staan al twee weekprogramma's klaar. Verwijder er eerst een op de Week-pagina.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="muted" style={{ fontSize: 15 }}>De app stelt de eerste vrije dag voor, met zeven dagen looptijd.</div>
      <div className="stepper">
        <div><div className="muted small">Startdag</div><div style={{ fontSize: 18, fontWeight: 600 }}>{dayInfo(start).long}</div></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="step-btn" aria-label="Startdag eerder" disabled={start <= min} onClick={() => setS(addDays(start, -1))}>−</button>
          <button className="step-btn" aria-label="Startdag later" onClick={() => setS(addDays(start, 1))}>+</button>
        </div>
      </div>
      <div className="stepper">
        <div><div className="muted small">Einddag</div><div style={{ fontSize: 18, fontWeight: 600 }}>{dayInfo(end).long}</div></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="step-btn" aria-label="Einddag eerder" onClick={() => setE(addDays(end, -1))}>−</button>
          <button className="step-btn" aria-label="Einddag later" onClick={() => setE(addDays(end, 1))}>+</button>
        </div>
      </div>
      <div className="muted center">{len} {len === 1 ? 'dag' : 'dagen'}</div>
      <button className="btn" disabled={busy} onClick={async () => { setBusy(true); const r = await actions.createProgram(start, end); setBusy(false); if (r) ctx.startSwipe({ mode: 'week' }); else close(); }}>Akkoord, ga swipen</button>
    </div>
  );
}

// ── Maaltijdscherm ──────────────────────────────────────────────────
function useAssign(ctx, meal) {
  return (day) => {
    const needsCard = meal.type === 'samen' || (meal.extras_on && (meal.extras || []).length);
    if (needsCard) { ctx.startSwipe({ mode: 'one', mealId: meal.id, targetDay: day }); return; }
    ctx.actions.assignMeal(day, meal, [], [], day === ctx.today ? 'Vanavond eten we ' + meal.name + '.' : meal.name + ' staat op ' + dayInfo(day).long + '.');
    ctx.setSheet(null);
  };
}

function DetailSheet({ ctx, meal }) {
  const { db, d, actions, photoUrls } = ctx;
  const [prep, setPrep] = useState(meal.prep || '');
  const timer = useRef(null), pending = useRef(null);
  const flush = () => { if (pending.current != null) { actions.updatePrep(meal.id, pending.current); pending.current = null; } };
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, []); // eslint-disable-line
  const onPrep = (v) => { setPrep(v); pending.current = v; clearTimeout(timer.current); timer.current = setTimeout(flush, 800); };
  const assign = useAssign(ctx, meal);
  const cat = meal.category_id ? d.catsById[meal.category_id] : null;
  const photo = meal.photo_path ? photoUrls[meal.photo_path] : null;
  const st = d.stats[meal.id];
  const P = db.household.persons;
  const ingr = meal.ingredients || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="detail-photo" style={photo ? { backgroundImage: 'url(' + photo + ')' } : { background: catTint(db.categories, meal.category_id) }}>
        {!photo && <><span className="ini">{meal.name.charAt(0)}</span><span className="muted small">Nog geen foto</span></>}
      </div>
      <div className="chips" style={{ gap: 6 }}>
        <span className="tag">{cat ? cat.name : 'Zonder categorie'}</span>
        {st && st.last >= 30 && <span className="tag tag-warn">Lang niet gegeten</span>}
        <span className="tag muted">{!st ? 'Nog niet gegeten' : st.last === 0 ? 'Vandaag gegeten' : st.last + (st.last === 1 ? ' dag' : ' dagen') + ' geleden gegeten'}</span>
      </div>
      <div className="row">
        <button className="btn" style={{ flex: 1 }} onClick={() => assign(ctx.today)}>Vanavond</button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => ctx.setSheet({ type: 'pickday', mealId: meal.id })}>Op een dag zetten</button>
      </div>
      {meal.type === 'samen' ? (
        <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg)' }}>
          <div className="label">Onderdelen om uit te kiezen</div>
          {(meal.parts || []).map((pt, k) => <div key={k} style={{ fontSize: 15 }}><b>{pt.name}:</b> {(pt.options || []).map((o) => o.name).join(', ') || <span className="muted">nog geen soorten</span>}</div>)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="label">Ingrediënten voor {P} {P === 1 ? 'persoon' : 'personen'}</div>
          {ingr.length ? (
            <div className="list">{ingr.map((x, i) => <div key={i} className="list-row"><span style={{ flex: 1 }}>{x.n}</span><span className="muted" style={{ fontWeight: 600, paddingRight: 8 }}>{fmtQty(x.q * P, x.u)}</span></div>)}</div>
          ) : <div className="muted" style={{ padding: 14, borderRadius: 14, border: '1px dashed var(--line2)' }}>Nog geen ingrediënten. Voeg ze toe via Bewerken.</div>}
        </div>
      )}
      {meal.extras_on && (meal.extras || []).length > 0 && <div><div className="label">Extra's</div><div style={{ marginTop: 4 }}>{meal.extras.join(', ')}</div></div>}
      <div className="field">
        <label className="label" htmlFor="opm">Bereiding en opmerkingen</label>
        <textarea id="opm" className="input" value={prep} onChange={(e) => onPrep(e.target.value)} placeholder="Bijv. hoe je het maakt, of: lekker met extra knoflook" />
        <div className="muted small">Wordt vanzelf bewaard.</div>
      </div>
      <button className="btn btn-ghost" onClick={() => { flush(); ctx.setSheet({ type: 'edit', mealId: meal.id }); }}>Bewerken</button>
    </div>
  );
}

function PickDaySheet({ ctx, meal }) {
  const { d, today } = ctx;
  const assign = useAssign(ctx, meal);
  const days = [];
  d.active.forEach((p) => programDays(p, today).forEach((x) => days.push(x)));
  if (!days.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="muted">Er staat nog geen weekprogramma klaar.</div>
      <button className="btn" onClick={() => ctx.setSheet({ type: 'period' })}>Nieuw weekprogramma</button>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="muted" style={{ fontSize: 15 }}>Waar wil je {meal.name} zetten?</div>
      {days.map((x) => {
        const s = d.slotsByDay[x] || {};
        const cur = s.mark || (s.meal_id && d.mealsById[s.meal_id] ? d.mealsById[s.meal_id].name : 'Nog leeg');
        const info = dayInfo(x);
        return (
          <button key={x} className={'day' + (x === today ? ' today' : info.wkd ? ' wkd' : '')} disabled={s.shopped} onClick={() => assign(x)} style={s.shopped ? { opacity: 0.5 } : null}>
            <div className="badge"><span>{info.dowCap}</span><b>{info.num}</b></div>
            <div style={{ flex: 1 }}><div className={s.meal_id || s.mark ? 'day-title' : 'day-title empty'}>{cur}</div>{(s.meal_id || s.mark) && !s.shopped && <div className="day-sub">Wordt vervangen</div>}{s.shopped && <div className="day-sub">Al ingekocht</div>}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── Toevoegen / bewerken ────────────────────────────────────────────
function IngredientEditor({ items, onChange, known, afdList }) {
  const [n, setN] = useState('');
  const [qty, setQty] = useState('');
  const [u, setU] = useState('g');
  const [a, setA] = useState(null);
  const ql = n.trim().toLowerCase();
  const sugg = ql ? known.filter((x) => x.n.toLowerCase().indexOf(ql) >= 0 && x.n.toLowerCase() !== ql).slice(0, 5) : [];
  const add = () => {
    if (!n.trim()) return;
    const k = known.find((x) => x.n.toLowerCase() === ql);
    onChange(items.concat([{ n: k ? k.n : n.trim(), q: parseNum(qty), u, a: a || (k ? k.a : 'Overig') }]));
    setN(''); setQty(''); setA(null);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.length > 0 && (
        <div className="list">
          {items.map((x, i) => (
            <div key={i} className="list-row">
              <span style={{ flex: 1 }}>{x.n}<span className="muted small"> · {x.a || 'Overig'}</span></span>
              <span className="muted" style={{ fontWeight: 600 }}>{x.q ? fmtQty(x.q, x.u) + ' p.p.' : ''}</span>
              <button className="icon-btn plain" style={{ color: 'var(--warn-ink)' }} aria-label={x.n + ' verwijderen'} onClick={() => onChange(items.filter((y, j) => j !== i))}><IcX size={18} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)' }}>
        <div className="field">
          <label className="muted small" htmlFor="ing-n">Ingrediënt</label>
          <input id="ing-n" className="input" style={{ minHeight: 46, fontSize: 16 }} value={n} onChange={(e) => setN(e.target.value)} placeholder="Begin te typen, bijv. kip" autoComplete="off" />
        </div>
        {sugg.length > 0 && <div className="chips" style={{ gap: 6 }}>{sugg.map((x) => <button key={x.n} className="chip" style={{ minHeight: 36, borderColor: 'var(--green-line)', color: 'var(--green-ink)' }} onClick={() => { setN(x.n); setU(x.u || 'g'); setA(x.a || null); }}>{x.n}</button>)}</div>}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 104, flex: 'none' }}>
            <label className="muted small" htmlFor="ing-q">Per persoon</label>
            <input id="ing-q" className="input" style={{ minHeight: 46, fontSize: 16 }} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="125" />
          </div>
          <div className="chips" style={{ gap: 6, flex: 1 }}>{UNITS.map((x) => <button key={x} className={u === x ? 'chip on' : 'chip'} style={{ minWidth: 44, padding: '0 10px' }} onClick={() => setU(x)}>{x}</button>)}</div>
        </div>
        <div className="muted small">Afdeling</div>
        <div className="chips-scroll">{afdList.map((x) => <button key={x} className={(a || 'Overig') === x ? 'chip on' : 'chip'} style={{ minHeight: 36 }} onClick={() => setA(x)}>{x}</button>)}</div>
        <button className="btn" style={{ minHeight: 46 }} disabled={!n.trim()} onClick={add}>Ingrediënt toevoegen</button>
      </div>
    </div>
  );
}

function PartsEditor({ parts, onChange, known, afdList }) {
  const [open, setOpen] = useState(null); // "k-i" van optie met open ingrediënten
  const [newOpt, setNewOpt] = useState({});
  const [newPart, setNewPart] = useState('');
  const upd = (k, patch) => onChange(parts.map((p, j) => (j === k ? Object.assign({}, p, patch) : p)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {parts.map((pt, k) => (
        <div key={k} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)' }}>
          <div className="row between">
            <div style={{ fontWeight: 600 }}><span style={{ color: 'var(--green-ink)' }}>{pt.letter}</span> · {pt.name}</div>
            <button className="icon-btn plain" style={{ color: 'var(--warn-ink)' }} aria-label={'Onderdeel ' + pt.name + ' verwijderen'} onClick={() => onChange(parts.filter((x, j) => j !== k))}><IcTrash size={18} /></button>
          </div>
          <div className="muted small">Eerste keuze is altijd "{KIES}".</div>
          {(pt.options || []).map((o, i) => {
            const key = k + '-' + i;
            return (
              <div key={i} style={{ borderTop: '1px solid var(--raised)', paddingTop: 6 }}>
                <div className="row">
                  <span style={{ flex: 1 }}>{o.name}</span>
                  <button className="mini" onClick={() => setOpen(open === key ? null : key)}>Ingrediënten ({(o.ingredients || []).length})</button>
                  <button className="icon-btn plain" style={{ color: 'var(--warn-ink)' }} aria-label={o.name + ' verwijderen'} onClick={() => upd(k, { options: pt.options.filter((x, j) => j !== i) })}><IcX size={18} /></button>
                </div>
                {open === key && <div style={{ marginTop: 8 }}><IngredientEditor items={o.ingredients || []} known={known} afdList={afdList} onChange={(v) => upd(k, { options: pt.options.map((x, j) => (j === i ? Object.assign({}, x, { ingredients: v }) : x)) })} /></div>}
              </div>
            );
          })}
          <div className="row">
            <label className="sr" htmlFor={'opt-' + k}>Nieuwe soort voor {pt.name}</label>
            <input id={'opt-' + k} className="input" style={{ minHeight: 44, fontSize: 16 }} value={newOpt[k] || ''} onChange={(e) => setNewOpt(Object.assign({}, newOpt, { [k]: e.target.value }))} placeholder={'Nieuwe soort, bijv. ' + (k === 0 ? 'Puree' : k === 1 ? 'Broccoli' : 'Kipfilet')} />
            <button className="btn" style={{ minHeight: 44, padding: '0 14px' }} disabled={!(newOpt[k] || '').trim()} onClick={() => { upd(k, { options: (pt.options || []).concat([{ name: newOpt[k].trim(), ingredients: [] }]) }); setNewOpt(Object.assign({}, newOpt, { [k]: '' })); }}>Toevoegen</button>
          </div>
        </div>
      ))}
      <div className="row">
        <label className="sr" htmlFor="new-part">Nieuw onderdeel</label>
        <input id="new-part" className="input" style={{ minHeight: 44, fontSize: 16 }} value={newPart} onChange={(e) => setNewPart(e.target.value)} placeholder="Nieuw onderdeel, bijv. Saus" />
        <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 14px' }} disabled={!newPart.trim()} onClick={() => { const nm = newPart.trim(); onChange(parts.concat([{ name: nm, letter: nm.charAt(0).toUpperCase(), afd: 'Overig', options: [] }])); setNewPart(''); }}>Toevoegen</button>
      </div>
    </div>
  );
}

function EditSheet({ ctx, meal, categoryId, close }) {
  const { db, actions, photoUrls } = ctx;
  const [m, setM] = useState(() => meal ? JSON.parse(JSON.stringify(meal)) : { name: '', category_id: categoryId || null, type: 'compleet', prep: '', extras_on: false, extras: [], ingredients: [], parts: [] });
  const [extrasText, setExtrasText] = useState((meal && meal.extras || []).join(', '));
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [askArchive, setAskArchive] = useState(false);
  const fileRef = useRef(null);
  const known = knownIngredients(db.meals);
  const afdList = (db.household.afd_order || []).concat(['Overig']).filter((a, i, arr) => arr.indexOf(a) === i);
  const cats = db.categories.slice().sort((a, b) => a.position - b.position);
  const set = (patch) => setM((x) => Object.assign({}, x, patch));
  const existingPhoto = meal && meal.photo_path ? photoUrls[meal.photo_path] : null;

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const b = await resizeImage(f); setPhoto(b); setPhotoPreview(URL.createObjectURL(b)); }
    catch (x) { ctx.say(x.message); }
  };
  const save = async (extra) => {
    if (!m.name.trim()) return;
    setBusy(true);
    const extras = extrasText.split(',').map((x) => x.trim()).filter(Boolean);
    const r = await actions.saveMeal(Object.assign({}, m, { extras }, extra || {}), photo);
    setBusy(false);
    if (r) { if (r.archived) close(); else ctx.setSheet({ type: 'detail', mealId: r.id }); }
  };
  const setType = (t) => set(t === 'samen' && !(m.parts || []).length
    ? { type: t, parts: [{ name: 'Aardappelen', letter: 'A', afd: 'AGF', options: [] }, { name: 'Groente', letter: 'G', afd: 'AGF', options: [] }, { name: 'Vlees / vis / vega', letter: 'V', afd: 'Vlees & vis', options: [] }] }
    : { type: t });

  const shown = photoPreview || existingPhoto;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="field">
        <label className="label" htmlFor="m-naam">Naam (verplicht)</label>
        <input id="m-naam" className="input" value={m.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. Pizza" />
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="sr" onChange={pick} tabIndex={-1} aria-hidden="true" />
      {shown ? (
        <div className="detail-photo" style={{ backgroundImage: 'url(' + shown + ')', justifyContent: 'flex-end', alignItems: 'flex-end', padding: 10 }}>
          <button className="btn-pill" onClick={() => fileRef.current && fileRef.current.click()}>Andere foto</button>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ borderStyle: 'dashed', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => fileRef.current && fileRef.current.click()}><IcCamera /> Foto maken of kiezen (optioneel)</button>
      )}
      <div className="label">Categorie (optioneel)</div>
      <div className="chips">{cats.map((c) => <button key={c.id} aria-pressed={m.category_id === c.id} className={m.category_id === c.id ? 'chip on' : 'chip'} onClick={() => set({ category_id: m.category_id === c.id ? null : c.id })}>{c.name}</button>)}</div>
      {!meal && (
        <>
          <div className="label">Soort maaltijd</div>
          <div className="chips">
            <button className={m.type === 'compleet' ? 'chip on' : 'chip'} onClick={() => setType('compleet')}>Complete maaltijd</button>
            <button className={m.type === 'samen' ? 'chip on' : 'chip'} onClick={() => setType('samen')}>Zelf samenstellen</button>
          </div>
        </>
      )}
      {m.type === 'samen' ? (
        <>
          <div className="label">Onderdelen en soorten</div>
          <PartsEditor parts={m.parts || []} onChange={(v) => set({ parts: v })} known={known} afdList={afdList} />
        </>
      ) : (
        <>
          <div className="label">Ingrediënten per persoon (optioneel)</div>
          <IngredientEditor items={m.ingredients || []} onChange={(v) => set({ ingredients: v })} known={known} afdList={afdList} />
        </>
      )}
      <button className="switch" role="switch" aria-checked={!!m.extras_on} onClick={() => set({ extras_on: !m.extras_on })}>
        <span>Extra aanzetten</span><span className={m.extras_on ? 'track on' : 'track'}><span className="knob" /></span>
      </button>
      {m.extras_on && (
        <div className="field">
          <label className="label" htmlFor="m-extras">Extra's, gescheiden door komma's</label>
          <input id="m-extras" className="input" value={extrasText} onChange={(e) => setExtrasText(e.target.value)} placeholder="Bijv. kroepoek, banaan, satésaus" />
        </div>
      )}
      <button className="btn" style={{ minHeight: 52 }} disabled={!m.name.trim() || busy} onClick={() => save()}>{busy ? 'Bezig met opslaan…' : 'Opslaan'}</button>
      {meal && (askArchive ? (
        <div className="row">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAskArchive(false)}>Annuleren</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => save({ archived: true })}>Ja, uit aanbod halen</button>
        </div>
      ) : <button className="btn btn-danger-text" onClick={() => setAskArchive(true)}>Uit het aanbod halen</button>)}
    </div>
  );
}

// ── Instellingen en categorieën ─────────────────────────────────────
function SettingsSheet({ ctx }) {
  const { db, actions } = ctx;
  const h = db.household;
  const std = h.std_days || [];
  const afd = h.afd_order || [];
  const moveAfd = (i, dir) => { const a = afd.slice(), j = i + dir; if (j < 0 || j >= a.length) return; const t = a[i]; a[i] = a[j]; a[j] = t; actions.updateHousehold({ afd_order: a }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stepper">
        <span>Huishouden: <b>{h.persons}</b> {h.persons === 1 ? 'persoon' : 'personen'}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="step-btn" aria-label="Minder personen" onClick={() => actions.updateHousehold({ persons: Math.max(1, h.persons - 1) })}>−</button>
          <button className="step-btn" aria-label="Meer personen" onClick={() => actions.updateHousehold({ persons: Math.min(20, h.persons + 1) })}>+</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="label">Standaard kookdagen</div>
        <div className="row" style={{ gap: 6 }}>
          {STD_ORDER.map((x) => { const on = std.indexOf(x) >= 0; return <button key={x} aria-pressed={on} className={on ? 'chip on' : 'chip'} style={{ flex: 1, minWidth: 0, padding: 0 }} onClick={() => actions.updateHousehold({ std_days: on ? std.filter((y) => y !== x) : std.concat([x]) })}>{x}</button>; })}
        </div>
        <div className="muted small">Dagen zonder vinkje tonen "Geen kookdag" en worden bij het swipen overgeslagen.</div>
      </div>
      <button className="switch" onClick={() => ctx.setSheet({ type: 'cats' })}><span>Categorieën beheren</span><span className="muted small">{db.categories.length}</span></button>
      <button className="switch" role="switch" aria-checked={!!h.sort_by_afd} onClick={() => actions.updateHousehold({ sort_by_afd: !h.sort_by_afd })}>
        <span>Boodschappen sorteren per afdeling</span><span className={h.sort_by_afd ? 'track on' : 'track'}><span className="knob" /></span>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="label">Volgorde afdelingen</div>
        <div className="list">
          {afd.map((a, i) => (
            <div key={a} className="list-row">
              <span style={{ flex: 1 }}>{a}</span>
              <button className="icon-btn plain" style={{ color: 'var(--green-ink)' }} aria-label={a + ' omhoog'} onClick={() => moveAfd(i, -1)}><IcUp size={18} /></button>
              <button className="icon-btn plain" style={{ color: 'var(--green-ink)' }} aria-label={a + ' omlaag'} onClick={() => moveAfd(i, 1)}><IcDown size={18} /></button>
            </div>
          ))}
        </div>
      </div>
      <button className="btn btn-ghost" style={{ borderColor: 'var(--line)', color: 'var(--warn-ink)' }} onClick={actions.logout}>Uitloggen</button>
    </div>
  );
}

function CatsSheet({ ctx }) {
  const { db, actions } = ctx;
  const [ren, setRen] = useState(null);
  const [renVal, setRenVal] = useState('');
  const [newName, setNewName] = useState('');
  const [askDel, setAskDel] = useState(null);
  const cats = db.categories.slice().sort((a, b) => a.position - b.position);
  const count = (id) => db.meals.filter((m) => m.category_id === id && !m.archived).length;
  const exists = (n) => cats.some((c) => c.name.toLowerCase() === n.toLowerCase());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="muted" style={{ fontSize: 15 }}>Verwijder je een categorie, dan komen de maaltijden onder "Zonder categorie".</div>
      <div className="list">
        {cats.map((c, i) => (
          <div key={c.id}>
            {ren === c.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg)' }}>
                <label className="muted small" htmlFor="ren">Nieuwe naam voor {c.name}</label>
                <input id="ren" className="input" style={{ minHeight: 46 }} value={renVal} onChange={(e) => setRenVal(e.target.value)} />
                <div className="row">
                  <button className="btn btn-ghost" style={{ flex: 1, minHeight: 44 }} onClick={() => setRen(null)}>Annuleren</button>
                  <button className="btn" style={{ flex: 1, minHeight: 44 }} disabled={!renVal.trim() || (renVal.trim().toLowerCase() !== c.name.toLowerCase() && exists(renVal.trim()))} onClick={() => { actions.updateCategory(c.id, { name: renVal.trim() }, c.name + ' heet nu ' + renVal.trim() + '.'); setRen(null); }}>Opslaan</button>
                </div>
              </div>
            ) : askDel === c.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg)' }}>
                <div>{c.name} verwijderen?</div>
                <div className="row">
                  <button className="btn btn-ghost" style={{ flex: 1, minHeight: 44 }} onClick={() => setAskDel(null)}>Annuleren</button>
                  <button className="btn btn-danger" style={{ flex: 1, minHeight: 44 }} onClick={() => { actions.deleteCategory(c); setAskDel(null); }}>Verwijderen</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '8px 6px 8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="row">
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block' }}>{c.name}</span><span className="muted small">{count(c.id)} {count(c.id) === 1 ? 'maaltijd' : 'maaltijden'}</span></span>
                  <button className="icon-btn plain" aria-label={c.name + ' omhoog'} disabled={i === 0} onClick={() => actions.moveCategory(c, -1)}><IcUp size={18} /></button>
                  <button className="icon-btn plain" aria-label={c.name + ' omlaag'} disabled={i === cats.length - 1} onClick={() => actions.moveCategory(c, 1)}><IcDown size={18} /></button>
                  <button className="mini" onClick={() => { setRen(c.id); setRenVal(c.name); }}>Wijzig</button>
                  <button className="icon-btn plain" style={{ color: 'var(--warn-ink)' }} aria-label={c.name + ' verwijderen'} onClick={() => setAskDel(c.id)}><IcTrash size={18} /></button>
                </div>
                <button className="row" style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--muted)', fontSize: 14, textAlign: 'left' }} role="switch" aria-checked={c.counts_for_shopping !== false} onClick={() => actions.updateCategory(c.id, { counts_for_shopping: c.counts_for_shopping === false })}>
                  <span className={c.counts_for_shopping !== false ? 'box on' : 'box'} style={{ width: 20, height: 20 }}>{c.counts_for_shopping !== false && <IcCheck size={14} />}</span>
                  <span>Telt mee voor de boodschappenlijst</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="row">
        <label className="sr" htmlFor="nc">Nieuwe categorie</label>
        <input id="nc" className="input" style={{ minHeight: 46 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nieuwe categorie" />
        <button className="btn" style={{ minHeight: 46 }} disabled={!newName.trim() || exists(newName.trim())} onClick={() => { actions.addCategory(newName.trim()); setNewName(''); }}>Toevoegen</button>
      </div>
    </div>
  );
}
