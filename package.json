# Stack Deploy 1:1

## 1. Supabase

1. Gehe zu `https://supabase.com`.
2. New project erstellen.
3. SQL Editor oeffnen.
4. Inhalt aus `supabase.sql` komplett einfuegen.
5. Run klicken.
6. Project Settings -> API oeffnen.
7. Kopiere:
   - Project URL -> `SUPABASE_URL`
   - service_role key -> `SUPABASE_SERVICE_ROLE_KEY`

## 2. Groq

1. Gehe zu `https://console.groq.com/keys`.
2. API Key erstellen.
3. In Render setzen als `GROQ_API_KEY`.
4. Modelle so lassen:

```env
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
```

## 3. Tavily

1. Gehe zu `https://app.tavily.com`.
2. API Key erstellen.
3. In Render setzen als `TAVILY_API_KEY`.

## 4. WebUntis

Setze in Render:

```env
WEBUNTIS_SCHOOL=DEINE_SCHULE
WEBUNTIS_USERNAME=DEIN_WEBUNTIS_USER
WEBUNTIS_PASSWORD=DEIN_WEBUNTIS_PASSWORT
WEBUNTIS_URL=neilo.webuntis.com
WEBUNTIS_LOOKAHEAD_DAYS=30
WEBUNTIS_TIMEOUT_MS=15000
```

`WEBUNTIS_URL` ist nur der Host, ohne `https://`.

## 5. Render Free

1. Gehe zu `https://dashboard.render.com`.
2. New -> Web Service.
3. Repository verbinden oder ZIP-Inhalt in ein GitHub Repo pushen.
4. Runtime: Node.
5. Region: Frankfurt oder naechste Region.
6. Branch: `main`.
7. Build Command:

```bash
npm install
```

8. Start Command:

```bash
npm start
```

9. Plan: Free.
10. Environment Variables setzen:

```env
PORT=10000
TZ=Europe/Berlin
MAIN_NUMBER=49DEINE_NUMMER_OHNE_PLUS
WHITELIST_NUMBERS=
REQUIRE_WHITELIST=false
ALLOW_GUESTS=true
GUEST_DAILY_CREDITS=20
ALLOW_GROUPS=true
GROUP_WHITELIST=*
RATE_LIMIT_MAX=6
RATE_LIMIT_WINDOW_MS=60000
WEBSEARCH_DAILY_LIMIT=10
CRON_SECRET=LANGES_RANDOM_SECRET
KILL_SWITCH=false
START_DELAY_MS=30000
SELF_PING_URL=https://DEIN-RENDER-SERVICE.onrender.com/health
SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=DEIN_SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY=DEIN_GROQ_API_KEY
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
TAVILY_API_KEY=DEIN_TAVILY_API_KEY
WEBUNTIS_SCHOOL=DEINE_SCHULE
WEBUNTIS_USERNAME=DEIN_WEBUNTIS_USER
WEBUNTIS_PASSWORD=DEIN_WEBUNTIS_PASSWORT
WEBUNTIS_URL=neilo.webuntis.com
WEBUNTIS_LOOKAHEAD_DAYS=30
WEBUNTIS_TIMEOUT_MS=15000
```

11. Deploy klicken.
12. Logs oeffnen.
13. QR-Code scannen.
14. Test in WhatsApp:

```text
Stack, ping
Stack, help
Stack, suche render free node whatsapp
Stack, HA: Mathe S.45 Nr.3, heute in Stunde gemacht: Gleichungen
```

## 6. Cron

Cron-job.org oder GitHub Actions Scheduler verwenden.

Cleanup alle 30 Minuten:

```text
https://DEIN-RENDER-SERVICE.onrender.com/cron/cleanup?key=LANGES_RANDOM_SECRET
```

WebUntis Proaktiv-Check alle 60 Minuten:

```text
https://DEIN-RENDER-SERVICE.onrender.com/cron/proactive?key=LANGES_RANDOM_SECRET
```

Backup-Check einmal pro Tag:

```text
https://DEIN-RENDER-SERVICE.onrender.com/cron/backup?key=LANGES_RANDOM_SECRET
```

## 7. Lokal pruefen

```bash
npm install
npm run check
```

Gruen bedeutet:

```text
tests 7
pass 7
fail 0
```

## 8. Wichtig

- `MAIN_NUMBER` immer ohne Plus und ohne Leerzeichen.
- Gruppen und Gaeste werden nach 12 Stunden vergessen.
- MAIN_NUMBER DM wird nach 90 Tagen vergessen.
- Bei WebUntis Login-Fail/Timeout bekommt MAIN_NUMBER: `WebUntis down Bruder, check Passwort`.
- Render Free schlaeft ein; `SELF_PING_URL` hilft nur als 0-Euro Keepalive-Versuch, keine Garantie.
