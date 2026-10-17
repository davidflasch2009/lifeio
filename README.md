# Lifeio

link: https://davidflasch2009.github.io/lifeio/

Ideen sammeln und verwalten, was du in deiner Freizeit lernst – als Single-File-PWA
(`index.html` mit allem CSS + JS inline, kein Build-Step). Die vollständige Spezifikation steht in
[`SPEC.md`](SPEC.md).

- Läuft sofort im **lokalen Modus** (Daten im Browser), auch ohne Firebase.
- Mit Firebase: Google-Login + Sync zwischen Geräten (Firestore, offline-fähig).

## Funktionen

- **Start:** alle Skills, die du gerade lernst, untereinander. Antippen klappt eine Karte auf
  (Titel, Ursprungsordner, Status-Knöpfe, Notizzettel, Logbuch). Reihenfolge per Ziehgriff ⋮⋮ ändern.
  Darunter die zugeklappte Sektion **Pausiert**.
- **Ordner:** Hängeregister mit farbigen Reitern. Reihenfolge: ✅ Gelernt → 📥 Unsortiert → eigene Ordner.
  Antippen öffnet einen Ordner, die Ordner dahinter rutschen nach unten. Eigene Ordner über
  „+ Neuer Ordner“ anlegen, über ⋯ am Reiter bearbeiten, verschieben oder löschen
  (Ideen wandern dann nach Unsortiert). Die Suche oben findet Ideen-Titel.
- **+ (Schnell erfassen):** nur Titel ist Pflicht. Auf Start wird das Ding gleich aktiv gestartet, im
  Ordner-Tab als Idee gespeichert (umschaltbar).
- **Lebenszyklus:** 💡 Idee → 🔥 Aktiv ⇄ ⏸️ Pausiert → ✅ Gelernt, jederzeit 🗑️ Verwerfen.
  Jeder Statuswechsel lässt sich rückgängig machen.
- **Mehr:** Konto, Verworfen (wiederherstellen / endgültig löschen), Backup (JSON), Hell/Dunkel/Automatisch.
- **Design:** Frutiger Aero – Glasflächen, glänzende Knöpfe und Ordner, Aurora-Hintergrund mit Blasen und
  Funkeln. Dunkel = Ozean-Aurora, Hell = Himmel.

## Dateien

| Datei | Zweck |
| --- | --- |
| `index.html` | komplette App |
| `sw.js` | Service Worker (Offline-Cache) |
| `manifest.json` | PWA-Manifest |
| `icon-192.png`, `icon-512.png` | App-Icons mit transparenten Ecken (Desktop, Android) |
| `icon-maskable-512.png` | Android-Icon mit sicherem Rand (maskable) |
| `apple-touch-icon.png` | iPhone-Homescreen-Icon (randlos, iOS rundet selbst ab) |
| `favicon-64.png` | Browser-Tab-Icon |
| `firestore.rules` | Firestore-Sicherheitsregeln |
| `SPEC.md` | Spezifikation |

## 1. Firebase einrichten (einmalig)

1. In der [Firebase Console](https://console.firebase.google.com) ein **neues Projekt** anlegen (z. B. `lifeio-xxxxx`,
   nicht das von Lernio oder Trainio).
2. **Firestore Database** → Datenbank erstellen → *Native Mode*, Region `eur3 (Europe)`.
3. **Authentication** → *Sign-in method* → **Google** aktivieren.
4. **Authentication → Settings → Authorized domains** → `davidflasch2009.github.io` hinzufügen.
5. **Firestore → Regeln** durch den Inhalt von [`firestore.rules`](firestore.rules) ersetzen.
6. **Projekteinstellungen → Allgemein → Deine Apps → Web-App (`</>`)** registrieren und die
   `firebaseConfig` kopieren.
7. In `index.html` ganz oben im `<script>` die Platzhalter in `const FIREBASE_CONFIG = { … }`
   durch die echten Werte ersetzen.

Solange dort noch `DEINE_API_KEY` steht, läuft die App im lokalen Modus. Daten, die du lokal
erfasst hast, kannst du beim ersten Login ins Konto übernehmen.

## 2. Deployment (GitHub Pages)

1. Repo → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)`.
2. Live-URL: `https://davidflasch2009.github.io/lifeio/`
3. Änderungen veröffentlichen:

   ```bash
   git add . && git commit -m "…" && git push
   ```

> **Wichtig:** Bei jedem Deploy in `sw.js` die Konstante `CACHE` hochzählen
> (`lifeio-v1` → `lifeio-v2` …). Sonst zeigt das iPhone noch die alte Version.
> Die App meldet neue Versionen selbst („Neue Version verfügbar – Neu laden“).

### Installieren

- **iPhone (Safari):** Teilen → *Zum Home-Bildschirm*.
- **Windows (Chrome/Edge):** Install-Symbol in der Adressleiste oder *Mehr → App installieren*.

## Lokal testen

```bash
npx http-server -p 8000 -c-1
# → http://localhost:8000
```

Der Service Worker läuft nur über `http://localhost` oder `https://`, nicht über `file://`.
