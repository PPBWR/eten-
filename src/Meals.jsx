import React, { useState } from 'react';
import { score, catTint, programDays } from './logic.js';
import { IcPlus, IcSearch } from './icons.jsx';

export default function Meals({ ctx }) {
  const { db, d, today, photoUrls, setSheet } = ctx;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [alpha, setAlpha] = useState(false);

  const cats = db.categories.slice().sort((a, b) => a.position - b.position);
  const meals = db.meals.filter((m) => !m.archived);
  const planned = new Set();
  d.active.forEach((p) => programDays(p, today).forEach((x) => { const s = d.slotsByDay[x]; if (s && s.meal_id) planned.add(s.meal_id); }));
  const sorter = alpha ? (a, b) => a.name.localeCompare(b.name, 'nl') : (a, b) => score(d.stats[b.id]) - score(d.stats[a.id]);
  const noCat = meals.filter((m) => !m.category_id || !d.catsById[m.category_id]);

  const tile = (m) => {
    const photo = m.photo_path ? photoUrls[m.photo_path] : null;
    const isPlanned = planned.has(m.id);
    const long = d.stats[m.id] && d.stats[m.id].last >= 30;
    return (
      <button key={m.id} className={'tile' + (isPlanned ? ' planned' : '')} onClick={() => setSheet({ type: 'detail', mealId: m.id })}
        style={photo ? { backgroundImage: 'url(' + photo + ')' } : { background: catTint(db.categories, m.category_id) }}
        aria-label={m.name + (isPlanned ? ', al gepland' : '') + (long ? ', lang niet gegeten' : '')}>
        {!photo && <span className="ini" aria-hidden="true">{m.name.charAt(0)}</span>}
        {photo && <span className="shade" />}
        {isPlanned ? <span className="planned-tag">Al gepland</span> : long && <span className="dot" title="Lang niet gegeten" />}
        <span className={photo ? 'nm' : 'nm big'}>{m.name}</span>
      </button>
    );
  };
  const plusTile = (categoryId, key) => (
    <button key={key} className="tile plus" onClick={() => setSheet({ type: 'edit', categoryId })}><IcPlus size={26} /><span>Toevoegen</span></button>
  );

  const query = q.trim().toLowerCase();
  let body;
  if (query) {
    const hits = meals.filter((m) => m.name.toLowerCase().indexOf(query) >= 0 || (m.ingredients || []).some((x) => x.n.toLowerCase().indexOf(query) >= 0)).sort(sorter);
    body = (
      <>
        <div className="muted" style={{ fontSize: 14 }}>{hits.length ? hits.length + (hits.length === 1 ? ' maaltijd gevonden' : ' maaltijden gevonden') : 'Niets gevonden voor “' + q.trim() + '”'}</div>
        <div className="tiles">{hits.map(tile)}</div>
      </>
    );
  } else if (cat === 'all') {
    const groups = cats.map((c) => ({ id: c.id, title: c.name, items: meals.filter((m) => m.category_id === c.id).sort(sorter) }));
    if (noCat.length) groups.push({ id: null, title: 'Zonder categorie', items: noCat.sort(sorter) });
    body = groups.map((g) => (
      <div key={g.id || 'geen'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="group-title">{g.title} <span className="muted" style={{ fontWeight: 400 }}>· {g.items.length}</span></div>
        <div className="tiles">{g.items.map(tile)}{plusTile(g.id, 'plus-' + (g.id || 'geen'))}</div>
      </div>
    ));
  } else {
    const items = (cat === 'none' ? noCat : meals.filter((m) => m.category_id === cat)).sort(sorter);
    body = <div className="tiles">{items.map(tile)}{plusTile(cat === 'none' ? null : cat, 'plus')}</div>;
  }

  return (
    <div className="page">
      <div className="row between">
        <h1>Ons aanbod</h1>
        <button className="btn btn-accent" style={{ minHeight: 44 }} onClick={() => setSheet({ type: 'edit', categoryId: cat !== 'all' && cat !== 'none' ? cat : null })}>+ Toevoegen</button>
      </div>
      <div className="search">
        <label htmlFor="zoek" className="sr">Zoek een maaltijd of ingrediënt</label>
        <IcSearch size={20} />
        <input id="zoek" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek een maaltijd of ingrediënt" />
      </div>
      <div className="chips-scroll">
        <button className={cat === 'all' ? 'chip on' : 'chip'} onClick={() => setCat('all')}>Alles</button>
        {cats.map((c) => <button key={c.id} className={cat === c.id ? 'chip on' : 'chip'} onClick={() => setCat(c.id)}>{c.name}</button>)}
        {noCat.length > 0 && <button className={cat === 'none' ? 'chip on' : 'chip'} onClick={() => setCat('none')}>Zonder categorie</button>}
      </div>
      <div className="row between">
        <span className="muted small">{alpha ? 'Op alfabet' : 'Lang niet gegeten eerst'}</span>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn-plain" style={{ textDecoration: 'underline', textUnderlineOffset: 3, border: 'none' }} onClick={() => setAlpha(!alpha)}>{alpha ? 'Slim sorteren' : 'A–Z'}</button>
          <button className="btn-plain" style={{ textDecoration: 'underline', textUnderlineOffset: 3, border: 'none' }} onClick={() => setSheet({ type: 'cats' })}>Categorieën beheren</button>
        </div>
      </div>
      {meals.length === 0 && !query ? (
        <div className="card center" style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Jullie aanbod is nog leeg</div>
          <div className="muted">Voeg de maaltijden toe die jullie vaak eten. Alleen een naam is genoeg.</div>
          <button className="btn" onClick={() => setSheet({ type: 'edit', categoryId: null })}>Eerste maaltijd toevoegen</button>
        </div>
      ) : body}
    </div>
  );
}
