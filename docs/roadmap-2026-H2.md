# 🦊 TourFuchs Vertrieb – Produkt-Roadmap H2/2026

**Stand:** 10.07.2026 · **Rolle:** Product Owner · **Status:** verbindliche Arbeitsgrundlage

---

## 1. Produktvision (North Star)

TourFuchs ist die PWA, die zwei Momente perfekt macht:

> **Moment A – Außendienst, morgens, 07:30:**
> „Ich öffne TourFuchs und habe in **30 Sekunden** meinen fertig optimierten Tagesplan –
> überfällige Kunden zuerst, Route steht, ein Tipp und Google Maps navigiert."

> **Moment B – Vertriebsleitung, Gebietsreform:**
> „Ich simuliere eine Umverteilung in **10 Minuten**, sehe Alt/Neu auf der Karte mit
> Umsatzwirkung und exportiere eine **fertige Entscheidungsvorlage** fürs Management."

Alles, was auf keinen der beiden Momente einzahlt, ist Backlog – nicht Sprint.

**Leitplanken (nicht verhandelbar):**
- **Lokal-first bleibt das Alleinstellungsmerkmal.** Keine Cloud, kein Login, keine Kundendaten auf fremden Servern ohne ausdrückliches, informiertes Opt-in.
- **Mobile ist der primäre Formfaktor** für Moment A, Desktop für Moment B.
- Jede Übermittlung an Drittdienste (Nominatim, OSRM) ist offengelegt und abschaltbar.

---

## 2. Release-Plan

### Release 1 – „Vertrauen & Fundament" *(sofort, ~1 Woche)*

Ziel: Die Datenschutz-Zusage stimmt wieder mit dem Verhalten überein, und die
Kernlogik ist gegen Regressionen abgesichert. Kein neues Feature, bevor das steht.

| # | Item | Akzeptanzkriterien |
|---|---|---|
| 1.1 | **OSRM-Routing transparent & opt-in** (Finding F1) | Datenschutzseite nennt OSRM-Routing als Drittdienst inkl. übermittelter Daten (Koordinaten von Start/Stopps). Straßenroute ist eine bewusste Nutzerentscheidung (Schalter, Standard: aus oder erste Nutzung mit Hinweis bestätigen). Luftlinie funktioniert vollständig ohne externe Calls. |
| 1.2 | **Test-Fundament + CI-Gate** (F3) | Vitest eingerichtet. Unit-Tests für reine Logik: `visits.js` (Fälligkeit), `territory.js` (Aggregation), Cockpit-Simulationsrechnung (Umsatz-Dedup, Undo-Snapshot), vollständige Datensatz-Ersetzung. GitHub Action: `build` + `test` müssen grün sein, bevor gemergt wird. Kein Selbst-Merge unter 5 Minuten ohne grünen Check. |
| 1.3 | **Kunden-Index statt linearem `find`** (F4) | `getCustomer()` O(1) über Map-Index; Cockpit mit 5.000 Demo-Kunden flüssig (< 200 ms Re-Render). |
| 1.4 | **KPI-Karten-Label dynamisch** (F5) | „Top-/Schwächster Bezirk" folgt dem gewählten Zuweisungs-Attribut (Bezirk/Gruppe/Channel). |
| 1.5 | **Eine Umsatz-Darstellungsregel** (F6) | Verbindlich: ab 10 T€ immer `Σ x T€` (gerundet), voller Betrag im Tooltip; Cockpit und Karte identisch. |

### Release 2 – „Mein Tag" · **WOW-Feature #1** *(~2–3 Wochen)*

Ziel: Moment A. Aus vorhandenen Bausteinen (Besuchsrhythmus/`visitStatus`,
Tourenoptimierung, Umkreis/Korridor) wird ein **Ein-Klick-Tagesplaner**:

> Button **„Plane meinen Tag"** → TourFuchs schlägt automatisch eine Tagestour vor:
> überfällige/fällige Kunden des eigenen Bezirks, gewichtet nach Fälligkeit, Umsatz
> und Fahrstrecke, optimiert als Route ab GPS-Standort.

> **Produktentscheidung 10.07.2026 (Nutzerfeedback):** Die Tour plant der Nutzer
> **manuell** – so wie bisher. Ein automatischer Tourvorschlag (ursprünglich 2.1)
> ist **gestrichen**; die Wochen-Vorschau (2.2) und der Morgen-Startscreen (2.3)
> sind **zurückgestellt**, bis der Bedarf erneut validiert ist. Automatik unterstützt
> nur dort, wo sie nichts vorwegnimmt: Zeiten, Termine, Übergabe.

| # | Item | Status | Akzeptanzkriterien |
|---|---|---|---|
| 2.1 | ~~Tagesplan-Vorschlag (automatisch)~~ | ❌ gestrichen | Nutzerentscheidung: manuelle Planung bleibt der Weg. Logik in Git-Historie erhalten. |
| 2.2 | Wochen-Vorschau | ⏸ zurückgestellt | Nur nach erneuter Validierung mit Nutzern. |
| 2.3 | Morgen-Startscreen (Mobile) | ⏸ zurückgestellt | Nur nach erneuter Validierung mit Nutzern. |
| 2.4 | **Besuch abhaken unterwegs** | offen | Stopp als „besucht" markieren aktualisiert `besuche[]` und den Fälligkeitsstatus sofort; nächster Stopp rückt nach. |
| 2.5 | **Route aufs Handy per QR-Code** | ✅ umgesetzt | Am Desktop geplante Tour als QR-Code anzeigen (nur die notwendigen Daten). Handy-PWA scannt per Kamera und übernimmt die Tour – ohne Netzwerk, ohne Datei, ohne Server. Es wird nie die Kundendatenbank übertragen, nur die Tour. |
| 2.6 | **Plan-Einstellungen für Termine** | ✅ umgesetzt | Datum, Startzeit und Besuchsdauer (Standard 45 min) sind wählbar und steuern Tagesplan-Druck und Outlook-Kalendertermine (.ics, ein Termin je Besuch inkl. Fahrzeit). |

**Der WOW-Moment von Release 2** ist die QR-Übergabe (2.5): Bildschirm zeigen,
scannen, losfahren – Lokal-first in Reinform. Die manuelle Planung bleibt dabei
vollständig in der Hand des Nutzers.

### Release 3 – „Entscheidungsvorlage" · **WOW-Feature #2** *(~2 Wochen)*

Ziel: Moment B zu Ende denken. Die Simulation (PRs #44–#48) ist stark, aber ihr
Ergebnis „verpufft" im Dialog.

| # | Item | Akzeptanzkriterien |
|---|---|---|
| 3.1 | **Simulations-Report exportieren** | Ein Klick erzeugt aus der aktiven Simulation eine druckfertige Vorlage (HTML-Druckansicht → PDF): Kartenbild Alt/Neu, Kennzahlen-Tabelle je Bezirk (Kunden, Umsatz, Delta), Fairness-Kennzahl vorher/nachher, Aktionsliste. Zusätzlich Excel-Export der Umbuchungsliste. |
| 3.2 | **Ausgewogenheits-Assistent** | Button „Vorschlag: ausgleichen": Greedy-Heuristik schlägt Gebietsverschiebungen vor, die den Kunden-/Umsatz-Faktor Richtung ≤ 1,5 senken – als Simulation, die der Nutzer prüft, editiert, verwirft oder übernimmt. Keine Blackbox: jede vorgeschlagene Verschiebung ist einzeln begründet (Gebiet, Kunden, Umsatz). |
| 3.3 | **Benannte Simulations-Szenarien** | Simulation als Szenario speichern/laden (IndexedDB), z. B. „Variante Nord" vs. „Variante Süd" vergleichbar. |

### Release 4 – „Tresor" · High-End-Sicherheit *(~3 Wochen, nach Release 3)*

Ziel: Echte Kundendaten dürfen bedenkenlos auf dem privaten Handy liegen.
Verschlüsselung **at rest** und **in transit** – ohne das Lokal-first-Prinzip zu brechen.

| # | Item | Akzeptanzkriterien |
|---|---|---|
| 4.1 | **Lokaler App-Tresor (Data at Rest)** | Optional aktivierbar. Kundendaten in IndexedDB mit AES-256-GCM verschlüsselt; Schlüssel wird aus einer PIN abgeleitet (PBKDF2/Argon2, hohe Iterationszahl) und **nie gespeichert**. Sperrbildschirm beim App-Start und nach Inaktivität. Ohne PIN sind die Daten kryptografisch unlesbar. |
| 4.2 | **Biometrie-Unlock (Komfortstufe)** | Wo verfügbar (WebAuthn mit PRF-/largeBlob-Erweiterung) FaceID/Fingerabdruck statt PIN. Realistische Grenze: plattformabhängig, v. a. iOS-PWA eingeschränkt – **PIN bleibt der garantierte Weg**, Biometrie ist Zusatz, kein Ersatz. |
| 4.3 | **Auto-Wipe** | Nach N Fehlversuchen (konfigurierbar, Standard 10) werden die lokalen Daten gelöscht. Ehrliche Einordnung im UI: Abschreckung, kein Hardware-Schutz – der eigentliche Schutz ist die Verschlüsselung aus 4.1. |
| 4.4 | **Verschlüsselter Export mit QR-Schlüssel (Data in Transit)** | Datei-Export (Excel/JSON) optional AES-256-verschlüsselt; der Schlüssel wird **nicht** mit der Datei transportiert, sondern als QR-Code am Desktop angezeigt (Out-of-Band). Handy: Datei öffnen + QR scannen = lokal entschlüsselt. Datei allein (E-Mail, USB, Cloud) ist wertlos. |

**Abgrenzung zu 2.5:** Die QR-Tour-Übergabe (Release 2) überträgt wenige, bewusst
ausgewählte Daten direkt Bildschirm→Kamera und braucht keine Verschlüsselung.
Release 4 sichert den Fall ab, dass die **ganze Datenbank** als Datei den Rechner
verlässt oder dauerhaft auf dem Gerät liegt.

### Backlog & Vision (bewusst NICHT jetzt)

- **POIs auf der Karte** (Ladestationen, eigene Niederlassungen): nur als Opt-in –
  externe POI-Abfragen sind eine neue Drittdienst-Verbindung und unterliegen der
  Offenlegungspflicht (DoD Nr. 3). Eigene Niederlassungen alternativ als lokale
  Importdatei (kein externer Call) – das zuerst.
- **KI-Assistent in der App:** kollidiert mit der aktiven Zusage „keine KI-Verarbeitung"
  auf der Datenschutzseite. Nur denkbar als lokales Modell oder als ausdrückliches
  Opt-in mit angepasster Datenschutzerklärung. Kein Termin, bewusste Grundsatz-
  entscheidung nötig, bevor hier irgendetwas gebaut wird.
- **Connector-Anleitungen** (Export-Leitfäden für CRM-Systeme): reine Dokumentation,
  geringer Aufwand – wird als Lückenfüller zwischen Releases mitgenommen.
- Eigener OSRM-/Nominatim-Endpoint bzw. konfigurierbarer Routing-Server (F2) – erst
  relevant, wenn > ~5 regelmäßige Nutzer; bis dahin: Fallback + Opt-in reichen.
- Refactoring `map.js`/`sidebar.js`/`tourPanel.js` in Untermodule (F7) – opportunistisch
  im Zuge von Release 2/3, kein eigenes Projekt.
- Mehrsprachigkeit, Themes, weitere Kartenanbieter: kein Beitrag zu Moment A/B.

---

## 3. Arbeitsweise (Definition of Done)

Ab Release 1 gilt für jeden PR:
1. `npm run build` **und** `npm test` grün (CI-Check, kein Merge ohne).
2. Neue oder geänderte **reine Logik** hat Unit-Tests; UI-Verhalten ist im PR-Text mit
   konkreten Prüfschritten dokumentiert (wie bisher – das Niveau der PR-Beschreibungen
   #44–#50 ist gut und bleibt Standard).
3. Jede neue externe Netzwerkverbindung wird im selben PR in `datenschutz.html`
   und README offengelegt – sonst kein Merge.
4. Mobile-Check (schmaler Viewport) gehört zur Prüfung jedes UI-PRs.

---

## 4. Erfolgsmessung (ohne Tracking – Selbsttest-Kriterien)

- **Moment A:** Vom App-Start bis zur startklaren Tagestour ≤ 30 s, ≤ 3 Interaktionen.
- **Moment B:** Von „Cockpit öffnen" bis exportierter Entscheidungsvorlage ≤ 10 min.
- **Vertrauen:** Jeder Satz auf der Datenschutzseite ist im Code nachweisbar wahr.
