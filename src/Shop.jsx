import React from 'react';
import { shoppingLines, fmtQty } from './logic.js';
import { IcCheck } from './icons.jsx';

export default function Shop({ ctx }) {
  const { db, d, actions, today } = ctx;
  const h = db.household;
  const { lines, days } = shoppingLines({ programs: db.programs, slotsByDay: d.slotsByDay, mealsById: d.mealsById, catsById: d.catsById, persons: h.persons, today });
  const mark = (k) => d.marksByKey[k] || {};
  const visible = lines.filter((l) => !mark(l.key).in_home);
  const home = lines.filter((l) => mark(l.key).in_home);
  const order = h.afd_order || [];
  const groups = h.sort_by_afd
    ? order.concat(['Overig']).filter((a, i, arr) => arr.indexOf(a) === i)
      .map((a) => ({ title: a, items: visible.filter((l) => (order.indexOf(l.a) >= 0 ? l.a : 'Overig') === a) }))
      .filter((g) => g.items.length)
    : visible.length ? [{ title: '', items: visible }] : [];

  return (
    <div className="page">
      <h1>Boodschappen</h1>
      <div className="stepper">
        <span>Voor <b>{h.persons}</b> {h.persons === 1 ? 'persoon' : 'personen'}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="step-btn" aria-label="Minder personen" onClick={() => actions.updateHousehold({ persons: Math.max(1, h.persons - 1) })}>−</button>
          <button className="step-btn" aria-label="Meer personen" onClick={() => actions.updateHousehold({ persons: Math.min(20, h.persons + 1) })}>+</button>
        </div>
      </div>
      <button className="switch" role="switch" aria-checked={!!h.sort_by_afd} onClick={() => actions.updateHousehold({ sort_by_afd: !h.sort_by_afd })}>
        <span>Sorteren per afdeling</span><span className={h.sort_by_afd ? 'track on' : 'track'}><span className="knob" /></span>
      </button>

      {!visible.length && (
        <div className="muted center" style={{ padding: '28px 12px' }}>{lines.length ? 'Alles is al in huis.' : 'Nog niets te halen. Plan maaltijden in je weekprogramma.'}</div>
      )}

      {groups.map((g) => (
        <div key={g.title || 'alles'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {g.title && <div className="group-title">{g.title}</div>}
          <div className="list">
            {g.items.map((l) => {
              const inCart = !!mark(l.key).in_cart;
              return (
                <div key={l.key} className="shop-row">
                  <button className="icon-btn plain" aria-pressed={inCart} aria-label={l.name + ' in mandje'} onClick={() => actions.setMark(l.key, { in_cart: !inCart })}>
                    <span className={inCart ? 'box on' : 'box'}>{inCart && <IcCheck size={16} />}</span>
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={inCart ? 'shop-name done' : 'shop-name'}>{l.name}</div>
                    {l.note && <div className="muted small">{l.note}</div>}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtQty(l.q, l.u)}</span>
                  <button className="mini" onClick={() => actions.setMark(l.key, { in_home: true })}>In huis</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {home.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="label">Al in huis ({home.length})</div>
          <div className="chips">
            {home.map((l) => <button key={l.key} className="chip" style={{ borderStyle: 'dashed', color: 'var(--muted)' }} onClick={() => actions.setMark(l.key, { in_home: false })}>{l.name} terugzetten</button>)}
          </div>
        </div>
      )}

      {days.length > 0 && <button className="btn" style={{ minHeight: 54, marginTop: 6 }} onClick={() => actions.finishRound(days)}>Boodschappen besteld/gedaan</button>}
    </div>
  );
}
