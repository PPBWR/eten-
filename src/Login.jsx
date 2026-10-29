import React, { useState } from 'react';
import { api } from './api.js';

const nlError = (e) => {
  const m = (e && e.message) || '';
  if (/invalid login credentials/i.test(m)) return 'E-mailadres of wachtwoord klopt niet.';
  if (/email not confirmed/i.test(m)) return 'Dit e-mailadres is nog niet bevestigd. Kijk in je mail, of bevestig de gebruiker in Supabase.';
  if (/network|fetch/i.test(m)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  return m || 'Er ging iets mis.';
};

export function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const can = email.trim() && pw && !busy;

  const submit = async (e) => {
    e.preventDefault(); if (!can) return;
    setBusy(true); setErr(''); setInfo('');
    try { await api.signIn(email.trim(), pw); } catch (x) { setErr(nlError(x)); }
    setBusy(false);
  };
  const forgot = async () => {
    setErr(''); setInfo('');
    if (!email.trim()) { setErr('Vul eerst je e-mailadres in.'); return; }
    try { await api.resetPassword(email.trim()); setInfo('Als dit adres bekend is, krijg je een mail om je wachtwoord opnieuw in te stellen.'); }
    catch (x) { setErr(nlError(x)); }
  };

  return (
    <div className="app">
      <form className="login" onSubmit={submit}>
        <div className="logo">Eten!</div>
        <div className="muted" style={{ fontSize: 17, marginBottom: 16 }}>Log in om jullie weekmenu te openen.</div>
        <div className="field">
          <label className="label" htmlFor="email">E-mailadres</label>
          <input id="email" className="input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pw">Wachtwoord</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        {info && <div className="muted" role="status">{info}</div>}
        <button className="btn" style={{ minHeight: 54, marginTop: 8 }} disabled={!can} type="submit">{busy ? 'Bezig…' : 'Inloggen'}</button>
        <button className="btn btn-plain" type="button" onClick={forgot}>Wachtwoord vergeten?</button>
        <div className="muted small center">Jullie gebruiken samen één account. Je blijft ingelogd tot je uitlogt.</div>
      </form>
    </div>
  );
}

export function NewPassword({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setErr('Kies een wachtwoord van minstens 8 tekens.'); return; }
    try { await api.updatePassword(pw); onDone(); } catch (x) { setErr(nlError(x)); }
  };
  return (
    <div className="app">
      <form className="login" onSubmit={submit}>
        <div className="logo">Eten!</div>
        <div className="field">
          <label className="label" htmlFor="npw">Nieuw wachtwoord</label>
          <input id="npw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn" type="submit">Opslaan</button>
      </form>
    </div>
  );
}
