# Lifeio – Spezifikation

## 0. Ziel

**Lifeio** ist eine Web-App, um Dinge zu verwalten, die man in der Freizeit lernen will.

Zwei Probleme werden gelöst:

1. **Ideen-Chaos:** Man hat ständig neue Ideen („will mal Gitarre / Japanisch / Kochen lernen“). Die sollen schnell
   in einen **Ideen-Speicher aus Ordnern** (Hängeregister-Optik) wandern.
2. **Überblick über das, was man gerade lernt:** Ein paar Skills sind **aktiv** und stehen klar sichtbar auf dem
   Start-Screen, mit Notizen und Logbuch.

Wenn man etwas Neues anfangen will, schaut man die Ordner durch, sucht sich eine Idee aus und aktiviert sie.

Primär für David selbst, aber jeder kann sich mit Google anmelden und die App für sich nutzen. Jeder Nutzer sieht nur
seine eigenen Daten, es gibt kein Teilen.

Sprache: **nur Deutsch**.

---

## 1. Tech-Stack (wie Trainio / Lernio)

- **Single-File-PWA:** `index.html` mit allem CSS + JS inline. Kein Build-Step, kein Framework, keine UI-Library.
- **Firebase JS SDK compat 10.14.1** per CDN: `firebase-app-compat.js`, `firebase-auth-compat.js`,
  `firebase-firestore-compat.js`.
- **Auth:** Google-Login (`signInWithPopup`, Fallback `signInWithRedirect` auf iOS-Safari / Standalone).
- **Firestore** mit `enablePersistence({ synchronizeTabs: true })` → offline-fähig.
- **Lokaler Modus zuerst:** Die App läuft sofort ohne Login. Daten liegen dann in `localStorage`. Solange in
  `FIREBASE_CONFIG` Platzhalter stehen, gibt es nur den lokalen Modus.
- **Service Worker** `sw.js`: network-first für Navigation, cache-first für Assets. Cache-Name `lifeio-v1`,
  wird bei jedem Deploy hochgezählt. Die App zeigt „Neue Version verfügbar – Neu laden“.
- **manifest.json** mit `display: standalone`.
- **Hosting:** GitHub Pages, Repo `davidflasch2009/lifeio`, Branch `main` / root →
  `https://davidflasch2009.github.io/lifeio/`.

### Dateien

```
lifeio/
  index.html      # komplette App
  sw.js           # Service Worker
  manifest.json   # PWA-Manifest
  icon-192.png    # App-Icon (Platzhalter bis zur Design-Phase)
  icon-512.png
  firestore.rules
  README.md       # Setup, Deployment, Funktionen
  SPEC.md         # diese Datei
```

### Firebase

- **Eigenes Firebase-Projekt** (nicht das von Lernio oder Trainio).
- Firestore Native Mode, Region `eur3`. Google als Sign-in-Provider, `davidflasch2009.github.io` als Authorized
  Domain.
- Regeln (`firestore.rules`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 2. Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Ding** | Ein Eintrag in der App, also etwas, das man lernen will/lernt/gelernt hat. Hat Titel, Ordner, Status, Notizzettel, Logbuch. |
| **Ordner** | Ein Fach im Hängeregister. Eine Ebene, keine Unterordner. |
| **Ursprungsordner** | Der Ordner, den sich ein Ding merkt, auch wenn es gerade nicht darin liegt (aktiv, pausiert, gelernt, verworfen). |
| **Notizzettel** | Ein freies Textfeld pro Ding für Wissen, Links, Tipps. |
| **Logbuch** | Datierte Einträge pro Ding: „was hab ich gemacht“. |

---

## 3. Zustände und Lebenszyklus

Jedes Ding hat genau einen Status:

| Status | Wo sichtbar | Aktionen |
| --- | --- | --- |
| 💡 **Idee** | im Ursprungsordner | **▶ Jetzt lernen** → Aktiv · ⋯ Verwerfen |
| 🔥 **Aktiv** | **Start**, Liste „Gerade am Lernen“ | **⏸️ Pausieren** · **✅ Gelernt** · **↩️ Zurück zu Ideen** · ⋯ Verwerfen |
| ⏸️ **Pausiert** | **Start**, zugeklappte Sektion „Pausiert“ unter den Aktiven | **▶ Weiterlernen** → Aktiv · **✅ Gelernt** · **↩️ Zurück zu Ideen** · ⋯ Verwerfen |
| ✅ **Gelernt** | fester Ordner **✅ Gelernt** | **🔁 Nochmal lernen** → Aktiv · ⋯ Verwerfen |
| 🗑️ **Verworfen** | nur unter **Mehr → Verworfen** | **Wiederherstellen** → Idee im Ursprungsordner · **Endgültig löschen** |

Regeln:

- Aktive und pausierte Dinge liegen **nicht** in einem Ordner. Sie merken sich aber ihren Ursprungsordner, der auf der
  Karte klein angezeigt wird.
- „Zurück zu Ideen“ und „Wiederherstellen“ legen das Ding als Idee in den Ursprungsordner.
- **Normale Ordner und Unsortiert enthalten nur Ideen.**
- Es gibt **kein Limit** für die Anzahl aktiver Dinge.
- Ein Ding, das aktiviert wird (auch per Weiterlernen oder Nochmal lernen), kommt **unten** an die Liste der Aktiven.

---

## 4. Datenmodell

Firestore unter `users/{uid}/…`. Im lokalen Modus liegt dieselbe Struktur als JSON in `localStorage`
(Schlüssel `lifeio-data`).

### 4.1 `users/{uid}/folders/{folderId}`

```json
{
  "name": "Musik",
  "emoji": "🎵",            // optional, "" wenn keins
  "color": "blue",          // Schlüssel aus der Farbpalette (ca. 10 Farben)
  "order": 3,               // manuelle Reihenfolge der eigenen Ordner
  "createdAt": "<timestamp>"
}
```

**Feste Ordner** werden nicht als Dokument gespeichert, sondern sind im Code definiert:

- `unsorted`: **📥 Unsortiert**. Echter Ordner für Ideen, nicht löschbar, nicht umbenennbar.
- `learned`: **✅ Gelernt**. Virtuell: zeigt alle Dinge mit Status `learned`, nicht löschbar.

### 4.2 `users/{uid}/items/{itemId}`

```json
{
  "title": "Gitarre spielen",
  "folderId": "abc123",          // Ursprungsordner, "unsorted" als Fallback
  "status": "idea",              // idea | active | paused | learned | discarded
  "notes": "Kanal X auf YouTube…\nhttps://…",
  "log": [
    { "id": "l1", "date": "2026-10-17", "text": "Akkorde C, G, Am geübt", "createdAt": "<timestamp>" }
  ],
  "activeOrder": 2,              // Reihenfolge auf Start (nur aktiv relevant)
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "statusChangedAt": "<timestamp>" // für „gelernt am“, Sortierung Pausiert/Verworfen
}
```

Das Logbuch liegt als Array im Ding-Dokument. Das reicht für Freizeit-Lernen locker (Firestore-Limit 1 MB pro
Dokument).

### 4.3 `users/{uid}/meta/settings`

```json
{ "theme": "auto" }   // auto | light | dark
```

---

## 5. Navigation

Drei Tabs unten:

1. **🏠 Start**: aktive und pausierte Dinge
2. **📁 Ordner**: das Hängeregister mit Suche
3. **⚙️ Mehr**: Konto, Verworfen, Backup, Darstellung, Version

Ein schwebender **„+“-Knopf** auf Start und Ordner (siehe 9).

---

## 6. Karten (überall gleich)

Jedes Ding erscheint als **Karte**. Bedienung überall gleich (Start, Ordner, Gelernt, Suche):

- **Zugeklappt:** Titel + Ursprungsordner (Farbpunkt, Emoji, Name). Auf Start zusätzlich ein Ziehgriff zum
  Umsortieren.
- **Antippen klappt die Karte in der Liste auf.** Es ist immer nur eine Karte offen. Antippen einer anderen klappt die
  vorige zu, erneutes Antippen der Kopfzeile schließt sie.
- **Aufgeklappt**, von oben nach unten:
  1. **Titel** (direkt bearbeitbar)
  2. **Ordner**-Auswahl (ändert den Ursprungsordner; bei Ideen = verschieben)
  3. **Status-Knöpfe** laut Tabelle in 3, **⋯-Menü** mit „Verwerfen“
  4. **Notizzettel**: Anzeige mit anklickbaren Links; antippen → Textfeld zum Bearbeiten. Speichert automatisch
     (ca. 600 ms nach dem letzten Tippen und beim Verlassen).
  5. **Logbuch**: nur sichtbar, wenn das Ding **nicht** Idee ist (oder schon Einträge hat). „+ Eintrag“ mit Datum
     (Standard heute) und Text, neueste oben. Einträge sind bearbeitbar und löschbar.

Es gibt **keine separate Detailseite**.

---

## 7. Tab Start

- Überschrift **„Gerade am Lernen“**, darunter alle aktiven Dinge **untereinander**, klar sichtbar und nicht in einem
  Ordner.
- Reihenfolge **manuell** per Ziehen (Ziehgriff, auf dem Handy per Long-Press). Gespeichert in `activeOrder`.
- Darunter die Sektion **„⏸️ Pausiert (n)“**, standardmäßig **zugeklappt**. Sortierung: zuletzt pausiert oben.
- **Leerer Zustand** (nichts aktiv): „Du lernst gerade nichts.“ + Knopf **„📁 Schau in deine Ideen“** → wechselt zum
  Ordner-Tab.

---

## 8. Tab Ordner (Hängeregister)

### 8.1 Stapel

- Oben die **Suchleiste**, darunter der **Stapel** aus Ordnern mit farbigen Reitern (Vorbild: Hängeregister-Bild).
- Reihenfolge, fest: **✅ Gelernt → 📥 Unsortiert → eigene Ordner (manuell sortiert) → Reiter „+ Neuer Ordner“**.
- Beim Öffnen des Tabs ist **kein Ordner offen**, man sieht nur den Stapel.
- Beim ersten Start gibt es **nur Unsortiert und Gelernt**, keine vorgefertigten Ordner.

### 8.2 Öffnen und Schließen

- Reiter antippen → der Ordner öffnet sich: Seine Karten erscheinen **direkt unter seinem Reiter**, und **alle Ordner
  dahinter rutschen animiert nach unten**, wie beim Durchblättern eines echten Hängeregisters. Die Ordner davor bleiben
  oben.
- Es ist immer nur **ein Ordner offen**. Antippen eines anderen Reiters wechselt, Antippen des eigenen schließt.
- Inhalt eines normalen Ordners / Unsortiert: **nur Ideen**, **neueste oben**.
- Inhalt von Gelernt: alle gelernten Dinge, mit Ursprungsordner und **„gelernt am TT.MM.JJJJ“**, neueste oben.
- Ein leerer Ordner zeigt **keinen** Hinweistext.

### 8.3 Ordner anlegen und bearbeiten

- Reiter **„+ Neuer Ordner“** am Ende → Dialog: **Name** (Pflicht), **Farbe** (ca. 10 Farben), **Emoji** (optional).
- **⋯ am Reiter des geöffneten Ordners** (nur eigene Ordner): Umbenennen / Farbe & Emoji ändern, Nach oben / Nach
  unten verschieben, Löschen.
- **Ordner löschen** (mit Bestätigung, „Ordner „Musik“ löschen? 4 Ideen wandern nach Unsortiert.“):
  - Seine Ideen wandern nach **Unsortiert**.
  - Alles, was ihn als Ursprungsordner hat (aktiv, pausiert, gelernt, verworfen), bekommt **Unsortiert** als
    Ursprungsordner.

### 8.4 Suche

- Durchsucht **nur die Titel von Ideen** (Status `idea`), ohne Groß/Kleinschreibung, Teiltreffer.
- Während eine Suche aktiv ist, wird der Stapel durch eine **flache Ergebnisliste** ersetzt. Die Karten zeigen ihren
  Ordner und lassen sich normal aufklappen.
- Suche leeren (✕) → zurück zum Stapel.

---

## 9. Schnell erfassen („+“)

- Schwebender **„+“-Knopf** auf **Start** und **Ordner**.
- Öffnet ein kleines Eingabefeld:
  - **Titel**: einziges Pflichtfeld, Fokus sofort drin, Enter speichert
  - **Ordner**: vorausgewählt = geöffneter Ordner, sonst **Unsortiert**
  - Schalter **„Gleich aktiv starten“**: auf Start **an**, im Ordner-Tab **aus**
- Ziel: Erfassen in unter 5 Sekunden.

---

## 10. Tab Mehr

In dieser Reihenfolge:

1. **Konto**: „Lokaler Modus“ bzw. angemeldet als …; **„Mit Google anmelden“** / Abmelden. Gibt es beim ersten Login
   lokale Daten, fragt die App „Lokale Daten ins Konto übernehmen?“.
2. **🗑️ Verworfen**: Liste aller verworfenen Dinge (zuletzt verworfen oben), je **Wiederherstellen** und
   **Endgültig löschen** (mit Bestätigung).
3. **Backup**: **JSON exportieren** (`lifeio-backup-JJJJ-MM-TT.json`) und **JSON importieren**. Der Import ersetzt nach
   Bestätigung alle Daten.
4. **Darstellung**: Hell / Dunkel / Automatisch.
5. **Version** und Hinweis bei neuer Version.

Backup-Format:

```json
{ "app": "lifeio", "version": 1, "exportedAt": "…", "folders": [ … ], "items": [ … ], "settings": { … } }
```

---

## 11. Rückgängig und Bestätigungen

- **Jeder Statuswechsel** (Jetzt lernen, Pausieren, Weiterlernen, Gelernt, Nochmal lernen, Zurück zu Ideen,
  Verwerfen, Wiederherstellen) und **jedes Löschen eines Logbuch-Eintrags** zeigt unten einen Hinweis mit
  **„Rückgängig“** (ca. 5 s).
- **Bestätigungsdialoge** nur bei: **Endgültig löschen**, **Ordner löschen**, **Backup importieren**.

---

## 12. Design (erster Build)

Erst die App, dann das Design.

- **Erster Build: flach und schlicht.** Eine Akzentfarbe, Hell/Dunkel/Auto über CSS Custom Properties, systemnahe
  Schrift, mobil zuerst, auf dem Laptop zentriert mit begrenzter Breite.
- Die **Hängeregister-Struktur** (farbige Reiter, Stapel, Aufklappen mit Nachrutschen) ist Teil der Bedienung und
  kommt **sofort**.
- **Später (Design-Phase):** Glas, Glanz, 3D-Ordner, Hintergrund wie im Vorbild-Bild, Icons, ggf. weitere Designs.

**Umgesetzt in v1.1 – Frutiger Aero:**

- **Dunkel** (wie die Mockups): Ozean-Verlauf Blau → Petrol → Grün mit regenbogenfarbigen Aurora-Bögen,
  Lichtstrahl, aufsteigenden Blasen und Funkeln. **Hell:** dieselbe Optik als heller Himmel.
- Glasflächen (Karten, Panels, Suchleiste, Tab-Leiste) mit Weichzeichner, Lichtkante oben und Schimmer.
- Glänzende „Aero“-Knöpfe: Lila (Hauptaktion), Blau (Backup), Rot (Löschen); „+“ als leuchtende Kugel.
- Ordner als glänzende 3D-Mappen mit funkelnden Reitern; der vorderste Ordner zeigt seine ganze Vorderseite.
  Karten im geöffneten Ordner sind helles „Papier“.
- Schwebende Glas-Tab-Leiste, großer leuchtender Spross im leeren Start-Screen.
- Logo: Glas-Ordner mit Zielscheibe (`icon-*.png`, `apple-touch-icon.png`).
- **v1.2 – 1:1 nach Mockup:** Maße, Farben und Positionen aus dem Mockup vermessen (375 px Breite):
  Titel 44 px, Panels Radius 19 px / Abstand 11 px, Tab-Leiste 86 px hoch und 13 px über dem Rand, „+“-Kugel 72 px.
  Hintergrund je Tab eigen (Start: Aurora-Bögen über dem Spross, Mehr: Marine → Türkis, Ordner: grüner Schein
  unten links). Spross, Haus, Ordner, Zahnrad, Lupe, Papierkorb, Handy, Pfeile, Haken und Ablage sind eigene
  SVG-Grafiken (sehen auf jedem Gerät gleich aus). Ordner-Reiter mit schrägen Flanken.
- **v1.3 – Animationen:** Intro (Logo ploppt auf, Oberfläche fliegt gestaffelt herein), gleitendes Glas-Leuchten
  in der Tab-Leiste mit Gelee-Icons, Inhalte gleiten beim Tab-Wechsel aus der passenden Richtung herein,
  Hintergrund überblendet weich. Karten gleiten an neue Plätze und klappen weich auf; erledigte Karten fliegen
  zum Ziel-Tab (Gelernt mit Konfetti, Jetzt lernen mit Funken, Pausieren in die Pause-Sektion, Verwerfen kippt
  weg). Spross wächst und wiegt sich, Aurora atmet, Blasen steigen, Tropfen wabbeln. Lichtwellen beim Antippen,
  Glanz über lila Knöpfen, pulsierende „+“-Kugel, Leuchtkugel beim Erfassen, auffächernde Ordner-Blätter,
  hüpfende Zahlen, federnde Sheets, Rückgängig-Zeitbalken. Bei „Bewegung reduzieren“ im System alles aus.
- **v1.4 – Feinschliff nach hochauflösendem Mockup:** Ordner als SVG-Rückwand mit S-Kurven-Reiter + glänzender
  Vorderklappe (Reiter-Breite passt sich der Beschriftung an; Gelernt/Unsortiert mit gemessenen Farben, eigene
  Ordner mit abgeleiteten Tönen). Spross als freigestelltes Bild aus dem Mockup (`sprout.png`). Suchleiste als
  klare Glasröhre. Animationen feiner: weniger Weg, kein starkes Überschwingen, weniger Partikel.
- Bei „Bewegung reduzieren“ im System stehen alle Animationen still.

---

## 13. Bewusst NICHT im ersten Build

- Fortschritt/Statistiken (Dauer, Heatmap, Streaks, Meilensteine, Level)
- Limit für aktive Dinge
- Zufallsvorschlag („Überrasch mich“)
- Lerninhalte (Karteikarten, Quizze)
- Unterordner, mehrere Ordner pro Ding
- Teilen zwischen Nutzern
- Design-Auswahl, Mehrsprachigkeit

---

## 14. Kleinigkeiten, die ich (Claude) selbst festgelegt habe

Bitte beim Gegenlesen prüfen, alles leicht änderbar:

- Zugeklappte Karten auf Start zeigen **nur Titel + Ursprungsordner**, kein „zuletzt geübt“ (passt zu „kein
  Fortschritt“).
- Unsortiert ist nicht umbenennbar; Gelernt ist ein virtueller Ordner.
- Pausierte sind nach „zuletzt pausiert“ sortiert, nicht manuell.
- Backup-Import **ersetzt** alles (kein Zusammenführen).
- Logbuch-Datum ist frei wählbar (auch rückwirkend).
- Notizzettel: Lese-Ansicht mit klickbaren Links, Antippen → Bearbeiten.

---

## 15. Bau-Reihenfolge

1. **Grundgerüst:** `index.html`, Tabs, Datenschicht mit lokalem Modus (`localStorage`), Hell/Dunkel.
2. **Karten + Start:** Karte zu/auf, Notizzettel, Logbuch, Statuswechsel, Rückgängig, Umsortieren.
3. **Ordner-Tab:** Hängeregister-Stapel, Öffnen mit Nachrutschen, Ordner anlegen/bearbeiten/löschen, Gelernt, Suche.
4. **„+“ Schnell erfassen.**
5. **Mehr:** Verworfen, Backup, Darstellung.
6. **Firebase:** Login, Firestore-Sync, Übernahme lokaler Daten.
7. **PWA:** `sw.js`, `manifest.json`, Platzhalter-Icons, README, Deploy auf GitHub Pages.
