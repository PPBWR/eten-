# Eten!

Kies samen wat jullie deze week eten, uit jullie eigen maaltijdenaanbod, en krijg er direct een boodschappenlijst bij.
Web-app (PWA) voor Android, met Supabase als database.

## Installatie (eenmalig)

1. **Database**: open Supabase → *SQL Editor* → plak de inhoud van `supabase/schema.sql` → *Run*.
2. **Aanmelden dichtzetten**: Supabase → *Authentication* → *Sign In / Providers* (of *Settings*) → zet *Allow new users to sign up* **uit**.
3. **Account aanmaken**: Supabase → *Authentication* → *Users* → *Add user* → *Create new user*. Vul e-mail en wachtwoord in en vink *Auto Confirm User* aan.
4. **Vercel**: *Add New* → *Project* → importeer deze repository → *Deploy*. Instellingen hoeven niet te worden aangepast (Vite wordt automatisch herkend).
5. **Supabase-adres van de app**: Supabase → *Authentication* → *URL Configuration* → zet *Site URL* op het Vercel-adres (nodig voor de mail bij "wachtwoord vergeten").
6. Open het Vercel-adres op de telefoon → menu → *Toevoegen aan startscherm*.

## Ontwikkelen

```bash
npm install
npm run dev              # tegen de echte database
VITE_MOCK=1 npm run dev  # met nagebootste gegevens, zonder database
```

De Supabase-URL en de publishable key staan in `src/config.js`. Die mogen openbaar zijn; de gegevens worden beschermd door de beveiligingsregels (RLS) in `supabase/schema.sql`. Zet hier nooit de service_role- of secret-key.

## Wat nog niet in versie 1 zit

- Echte pushmeldingen: "Vraag om check" opent nu het deelmenu van de telefoon (bijv. WhatsApp).
- Eigen accounts per persoon, "Trek in", delen via link (versie 2).
- Bibliotheek met moderatie en "Ontdekken" (versie 3).
