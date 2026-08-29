# OCSC Sideline

Live sub tracker, game log, and season stats for the OCSC 5th/6th grade girls team. React + Vite on Vercel, Supabase for data and sign-in.

## Deploy (about 15 minutes)

1. **Supabase** — create a free project. In *SQL Editor*, paste `supabase/schema.sql` and run it.
   - *Authentication → Providers → Email*: keep Email enabled; magic links are on by default.
   - *Authentication → URL Configuration*: add your Vercel URL to Redirect URLs once you have it.
   - *Project Settings → API*: copy the **Project URL** and **anon public** key.
2. **GitHub** — push this folder to a new private repo.
3. **Vercel** — *New Project → import the repo*. Add two environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   Deploy. Vercel detects Vite automatically.
4. Open the site, enter your email, tap the link. Add players under **Players**. Chris signs in the same way.

## Local dev
```
cp .env.example .env   # fill in the two keys
npm install
npm run dev
```

## How it works
- Everything that happens in a game is a row in `game_events` (on, off, move, goal, assist, opp_goal, save, card, half, final). Minutes are computed from on/off events, so there is one source of truth.
- The clock lives on the `games` row (`elapsed_seconds` + `clock_started_at`), so both phones show the same time and a refresh never loses it.
- Realtime is on for `games` and `game_events`: a sub made on one phone appears on the other.
- Sign-in is restricted to whoever you invite. To lock it down further, turn off *Enable sign ups* in Supabase Auth after both coaches have signed in once.

## Folding in Soccer Smarts
Paste the existing component into `src/pages/SoccerSmarts.jsx`. The `/smarts` route is public, so the parent link keeps working without sign-in.
