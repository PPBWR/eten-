const S = (p) => ({ width: p.size || 22, height: p.size || 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.w || 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true });

export const IcWeek = (p) => <svg {...S(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const IcSwipe = (p) => <svg {...S(p)}><rect x="6" y="3.5" width="12" height="17" rx="2.5" transform="rotate(8 12 12)" /><path d="M3 12h2M19 12h2" /></svg>;
export const IcCart = (p) => <svg {...S(p)}><path d="M4 5h2l2 10h10l2-7H7.2" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="16.5" cy="19" r="1.4" /></svg>;
export const IcMeals = (p) => <svg {...S(p)}><path d="M5 4v7a3 3 0 006 0V4M8 4v16M17 4c-2 1.5-2.5 4-2.5 7h2.5v9" /></svg>;
export const IcX = (p) => <svg {...S({ w: 2.5, ...p })}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IcCheck = (p) => <svg {...S({ w: 2.8, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IcUp = (p) => <svg {...S({ w: 2.5, ...p })}><path d="M6 15l6-6 6 6" /></svg>;
export const IcDown = (p) => <svg {...S({ w: 2.5, ...p })}><path d="M6 9l6 6 6-6" /></svg>;
export const IcInfo = (p) => <svg {...S(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
export const IcSearch = (p) => <svg {...S(p)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const IcPlus = (p) => <svg {...S({ w: 2.4, ...p })}><path d="M12 5v14M5 12h14" /></svg>;
export const IcTrash = (p) => <svg {...S(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const IcGear = (p) => <svg {...S(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
export const IcCamera = (p) => <svg {...S(p)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
