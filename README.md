# Machina

Prosta aplikacja webowa/PWA do zarządzania zleceniami i czasem w małym warsztacie CNC.

## Uruchomienie lokalne

```bash
pnpm install
pnpm build
pnpm preview --host 127.0.0.1
```

Bez konfiguracji Supabase aplikacja działa lokalnie i zapisuje dane w `localStorage` przeglądarki.

## Supabase sync

1. Utwórz projekt w Supabase.
2. W SQL Editor uruchom zawartość `supabase/schema.sql`.
3. Skopiuj `.env.example` do `.env.local`.
4. Ustaw:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

5. Zbuduj/uruchom aplikację ponownie.

Po konfiguracji dane są zapisywane w Supabase i odświeżane przez Realtime, więc telefon i laptop widzą ten sam stan.

Uwaga: obecna schema jest trybem MVP dla jednego warsztatu i pozwala klientowi przeglądarkowemu czytać/zapisywać wspólne dane przez klucz publiczny. Przed realnym użyciem z danymi klientów warto dodać Supabase Auth i polityki RLS oparte o `workspace_id`.

## GitHub Pages

Opublikowana wersja działa z brancha `gh-pages`, który zawiera gotowy build aplikacji z bazą `/Machina/`.

https://piotrstyla.github.io/Machina/

W ustawieniach repozytorium GitHub Pages źródłem powinien być:

1. `Settings` -> `Pages`
2. `Build and deployment` -> `Deploy from a branch`
3. Branch: `gh-pages`, folder: `/root`

Jeśli opublikowana wersja ma korzystać z Supabase, dodaj w repozytorium GitHub zmienne Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
