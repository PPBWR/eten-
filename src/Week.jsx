import React, { useState } from 'react';
import { dayInfo, programDays, slotFilled, partOptions, KIES, openDays } from './logic.js';
import { IcGear } from './icons.jsx';

export async function shareText(text, say) {
  const url = window.location.origin;
  try {
    if (navigator.share) { await navigator.share({ title: 'Eten!', text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); say('Bericht gekopieerd. Plak het in WhatsApp of een sms.'); }
  catch (e) { say(text); }
}

export default function Week({ ctx }) {
  const { db, d, actions, today, setSheet, say } = ctx;
  const [askDel, setAskDel] = useState(null);
  const std = db.household.std_days || [];
  const active = d.active;

  const allDays = [];
  active.forEach((p) => programDays(p, today).forEach((x) => { if (std.indexOf(dayInfo(x).dow) >= 0) allDays.push(x); }));
  const nFilled = allDays.filter((x) => slotFilled(d.slotsByDay[x])).length;

  const askCheck = () => {
    if (!allDays.length) { say('Er staat nog geen weekprogramma klaar.'); return; }
    const text = nFilled === allDays.length
      ? 'Het weekmenu staat klaar. Kijk je even in Eten! of het akkoord is voordat ik de boodschappen bestel?'
      : 'Weekmenu: ' + nFilled + ' van ' + allDays.length + ' dagen gevuld. Kun je ’m in Eten! aanvullen of even checken?';
    shareText(text, say);
  };

  return (
    <div className="page">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="kicker">Eten!</div>
          <h1>Weekmenu</h1>
        </div>
        <div className="row">
          <button className="btn-pill" style={{ padding: '0 12px' }} onClick={askCheck}>Vraag om check</button>
          <button className="icon-btn" aria-label="Instellingen" onClick={() => setSheet({ type: 'settings' })}><IcGear /></button>
        </div>
      </div>

      {active.length === 0 && (
        <div className="card center muted" style={{ padding: '28px 16px' }}>Er staat nog geen weekprogramma klaar. Begin een nieuwe planning.</div>
      )}

      {active.map((p, pi) => {
        const days = programDays(p, today);
        const cook = days.filter((x) => std.indexOf(dayInfo(x).dow) >= 0);
        const filled = cook.filter((x) => slotFilled(d.slotsByDay[x])).length;
        return (
          <section key={p.id} className="card prog">
            <div className="row between" style={{ padding: '0 4px 10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>Weekprogramma {pi + 1}</div>
                <div className="muted" style={{ fontSize: 14 }}>{dayInfo(p.start_date).short} – {dayInfo(p.end_date).short} · {filled} van {cook.length} gevuld</div>
              </div>
              <button className={p.ready ? 'chip on' : 'chip'} onClick={() => actions.toggleReady(p)}>{p.ready ? 'Gereed' : 'Op gereed zetten'}</button>
            </div>
            {days.map((x) => <DayRow key={x} day={x} ctx={ctx} isStd={std.indexOf(dayInfo(x).dow) >= 0} />)}
            {askDel === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 6px 6px' }}>
                <div className="center" style={{ fontSize: 15 }}>De komende dagen van dit weekprogramma worden leeggemaakt.</div>
                <div className="row">
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAskDel(null)}>Annuleren</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setAskDel(null); actions.deleteProgram(p); }}>Ja, verwijderen</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-danger-text" style={{ minHeight: 44 }} onClick={() => setAskDel(p.id)}>Weekprogramma verwijderen</button>
            )}
          </section>
        );
      })}

      {active.length < 2 ? (
        <button className="btn btn-ghost" style={{ borderStyle: 'dashed', borderRadius: 16, minHeight: 52 }} onClick={() => setSheet({ type: 'period' })}>+ Nieuw weekprogramma</button>
      ) : (
        <p className="muted center" style={{ margin: 0, fontSize: 14 }}>Er staan al twee weekprogramma's klaar.</p>
      )}
      {openDays({ programs: db.programs, slotsByDay: d.slotsByDay, stdDays: std, today }).length > 0 && (
        <button className="btn" onClick={() => ctx.startSwipe({ mode: 'week' })}>Open dagen vullen</button>
      )}
    </div>
  );
}

function DayRow({ day, ctx, isStd }) {
  const { d, today, setSheet } = ctx;
  const s = d.slotsByDay[day] || {};
  const info = dayInfo(day);
  const m = s.meal_id ? d.mealsById[s.meal_id] : null;
  const cat = s.category_id ? d.catsById[s.category_id] : null;
  let title = 'Nog leeg', sub = '', chip = '', strong = false;
  if (s.mark) { title = s.mark; strong = true; }
  else if (m) {
    title = m.name; strong = true;
    const bits = [];
    if (m.type === 'samen') (m.parts || []).forEach((pt, k) => { const o = partOptions(pt)[(s.picks || [])[k] || 0] || { name: KIES }; bits.push(o.name === KIES ? pt.letter + ': in de winkel' : o.name); });
    if (s.extras && s.extras.length) bits.push('+ ' + s.extras.join(', '));
    sub = bits.join(' · ');
  } else if (s.mode === 'cat' && cat) title = cat.name + ' · nog kiezen';
  else if (!isStd) title = 'Geen kookdag';
  const mcat = m && m.category_id ? d.catsById[m.category_id] : null;
  if (s.shopped) chip = 'Ingekocht';
  else if (mcat && mcat.counts_for_shopping === false) chip = 'Halen';
  else if (s.mode === 'cat' && cat && m) chip = cat.name;
  const cls = 'day' + (day === today ? ' today' : info.wkd ? ' wkd' : '');
  return (
    <button className={cls} onClick={() => setSheet({ type: 'slot', day })}>
      <div className="badge"><span>{info.dowCap}</span><b>{info.num}</b></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={strong ? 'day-title' : 'day-title empty'}>{title}</div>
        {sub && <div className="day-sub">{sub}</div>}
        {day === today && !sub && <div className="day-sub">Vandaag</div>}
      </div>
      {chip && <span className={s.shopped ? 'day-chip done' : 'day-chip'}>{chip}</span>}
    </button>
  );
}
