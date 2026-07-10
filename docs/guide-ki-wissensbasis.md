# TourFuchs Vertrieb – Wissensbasis für den Guide-Bot

**Stand: 10.07.2026** · Basiert auf dem aktuellen Funktionsstand der App.
Dieses Dokument ist die Wissensgrundlage für den TourFuchs-Guide (Custom-Bot).
Es ist aufgabenorientiert aufgebaut: Jeder Abschnitt beantwortet eine Nutzerfrage
eigenständig und enthält den **Klickpfad** mit den exakten Beschriftungen aus der App.

**Klickpfad-Konvention:** `Modus → Tab → Schaltfläche` – Beschriftungen stehen in
Anführungszeichen genau so, wie sie in der App erscheinen (inklusive Symbol).
Beispiel: `Gebietsplanung → Tab „🗺️ Gebiete" → „📊 Gebiets-Cockpit öffnen"`.

---

## 1. Was ist TourFuchs Vertrieb?

TourFuchs ist eine installierbare Web-App (PWA) für den Außendienst in Deutschland.
Sie beantwortet zwei Kernfragen:

1. **„Welcher Vertriebsbezirk betreut welche Kunden?"** – Excel-/CSV-Liste hochladen,
   Kunden erscheinen auf der Deutschlandkarte, Gebiete werden nach Betriebsbezirken eingefärbt.
2. **„Wen besuche ich als Nächstes?"** – Startpunkt wählen, Vorschläge erhalten,
   Tour zusammenstellen, Reihenfolge optimieren, in Google Maps navigieren.

**Grundprinzipien (immer gültig):**
- **Lokal-first:** Keine Anmeldung, keine Cloud. Alle Kundendaten bleiben im Browser
  des Geräts (IndexedDB). Es gibt keinen TourFuchs-Server, der Daten empfängt.
- **Betriebsbezirk ist die führende Ebene.** Er steuert Färbung, Cockpit, Tourfilter
  und Simulation. Die Vertriebsgruppe ist die empfohlene übergeordnete Vergleichsebene.
- **Desktop und Smartphone haben verschiedene Aufgaben:** Desktop = Import,
  Gebietsplanung, Cockpit, Simulation. Smartphone = Karte, Tour, Navigation.
  Komplexe Gebietsplanung ist mobil bewusst ausgeblendet.
- **Die Tour plant der Nutzer selbst.** TourFuchs macht Vorschläge (Umkreis, entlang
  der Tour, überfällige zuerst), aber es gibt keinen Automatik-Knopf, der die Tour
  ungefragt baut. Das ist eine bewusste Produktentscheidung.

---

## 2. Oberfläche: Modi, Tabs, Topbar

**Topbar (oben):** Menü-Schalter „☰", TourFuchs-Logo, Suchfeld
„Kunde, Ort, PLZ suchen…", Mobile-Vorschau „📱" (Desktop), Info „ⓘ".

**Moduswechsel (oben im Bedienpanel):** zwei Schaltflächen
- **„🚗 Außendienst"** – Alltag: Karte, Tour, Kunden. Tabs: „📄 Daten", „Filter", „Tour".
- **„🗺️ Gebietsplanung"** – Analyse: Flächen, Cockpit, Simulation. Tabs: „📄 Daten", „Filter", „🗺️ Gebiete".

Auf dem Smartphone gibt es zusätzlich den Tab **„Karte"**; das Tour-Panel liegt als
Bottom Sheet über der Karte (minimiert / halb / voll, per Wischen).

Im Tour-Tab gibt es unten den Umschalter **„Basis" / „Experte"**: Der Experten-Modus
blendet zusätzliche Optionen ein (z. B. Ziel, Vorschlagsmodus, Druck/Export-Aktionen).
Wenn ein Nutzer eine Schaltfläche nicht findet, zuerst prüfen: richtiger Modus,
richtiger Tab, ggf. „Experte" aktivieren.

---

## 3. Installation als App (PWA)

**Desktop (Chrome/Edge):**
1. TourFuchs im Browser öffnen.
2. Browser-Menü → „App installieren".

**Android (Chrome):**
1. TourFuchs im Browser öffnen.
2. Menü (⋮) → „App installieren" bzw. „Zum Startbildschirm hinzufügen".

**iPhone (Safari):**
1. TourFuchs in Safari öffnen.
2. Teilen-Symbol → „Zum Home-Bildschirm".

**Problem „alter App-Name wird angezeigt":** alte PWA vom Homescreen entfernen,
Browser neu laden, App neu installieren.

**Updates:** TourFuchs prüft beim Start, in Intervallen und beim Fokuswechsel auf
Updates. Bei verfügbarem Update erscheint ein Hinweis mit Aktualisieren-Option.
Lokale Daten bleiben bei Updates erhalten.

---

## 4. Demo-Daten laden (empfohlener Einstieg)

**Klickpfad:** Tab „📄 Daten" → **„✨ App in 60 Sekunden erleben"**

Lädt flächendeckende Demo-Daten (fiktive Kunden mit Bezirken, Gruppen, Umsätzen und
Besuchsrhythmen). Ideal zum Ausprobieren ohne echte Kundendaten. Eigene Daten können
jederzeit danach geladen werden.

---

## 5. Excel-/CSV-Import

### 5.1 Vorlage herunterladen
**Klickpfad:** Tab „📄 Daten" → **„📋 Excel-Vorlage herunterladen"**

### 5.2 Pflicht- und empfohlene Spalten
- **Pflicht:** Kundenname, PLZ (für die Karte), **Betriebsbezirk**
- **Empfohlen:** Straße & Hausnummer, Ort, Kundennummer, Umsatz, Vertriebsgruppe,
  Ansprechpartner, Telefon, E-Mail, Besuchsrhythmus (Wochen), Letzter Besuch
- Spaltennamen werden automatisch erkannt (auch Synonyme wie „Firma", „Bezirk",
  „Jahresumsatz"); die Zuordnung wird im Dialog **„Spalten zuordnen"** geprüft.

### 5.3 Importieren
**Klickpfad:** Tab „📄 Daten" → **„📤 Excel- oder CSV-Liste hochladen"** →
Datei wählen oder per Drag & Drop ablegen → Dialog „Spalten zuordnen" prüfen →
**„Importieren"** → Dialog „Import abgeschlossen" kontrollieren.

- CSV wird robust eingelesen (Semikolon, Komma oder Tab; UTF-8 und Windows-1252).
- Beim Upload muss bestätigt werden, dass die Daten verarbeitet werden dürfen (Compliance).
- **Fehlerhafte Zeilen** landen nicht in der Karte, sondern in einer herunterladbaren
  Fehlerliste: im Ergebnis-Dialog **„⬇ Fehlerliste (.xlsx)"**. Erkannt werden u. a.
  Dubletten, fehlender Betriebsbezirk, widersprüchliche Gebietszuordnungen,
  unbekannte Landkreise/PLZ.

### 5.4 Umsatz-Formate
Der Import versteht Umsätze als Excel-Zahl sowie als Text in deutschem Format
(`1.234,56`), englischem Format (`1,234.56`) und ohne Gruppierung (`45000`, `45.5`).
Währungszeichen werden ignoriert. Die **Umsatzspalte wird spaltenweit einheitlich**
gelesen: Erkennt TourFuchs eindeutige deutsche Tausenderpunkte (z. B. `189.245`),
wird die ganze Spalte deutsch interpretiert (`350.070` → 350 070 €, nicht 350,07).
Nennt die **Überschrift** eine Einheit (`T€`, `TEUR`, `Tsd €`, `Mio €`), wird
entsprechend ×1000 bzw. ×1 000 000 in volle Euro umgerechnet. In beiden Fällen
zeigt der Import-Dialog einen **Hinweis mit der erkannten Gesamtsumme** zum Prüfen.

### 5.5 Neue Liste / Delta-Import
**Klickpfad:** Tab „📄 Daten" → **„📤 Andere Excel- oder CSV-Liste laden"**
Beim erneuten Import werden bestehende Kunden über die Kundennummer, sonst über
Name + PLZ wiedererkannt; Besuchshistorie und Kontakte werden zusammengeführt.

### 5.6 Flächenzeilen (Gebiete ohne Kunden zuordnen)
Eine Zeile **ohne Kundenname**, aber mit Spalte „Gebiet (LK/PLZ)" und einem
Betriebsbezirk, ordnet ein ganzes Gebiet zu – z. B. `Oberhausen` (Landkreis),
`46` (alle 46xxx) oder `46045` (genau dieses PLZ-Gebiet). So lassen sich weiße
Flecken für Neukunden reservieren. Alternativ interaktiv über das Gebiets-Popup
auf der Karte oder im Cockpit (Häkchen „Auch Gebiete ohne Kunden einbeziehen").

### 5.7 Adressgenaue Verortung (optional)
**Klickpfad:** Tab „📄 Daten" → **„🎯 Adressen exakt verorten"**
Standard ist die Offline-Verortung über PLZ-Koordinaten. Diese optionale Funktion
sendet die Adresse (Straße, PLZ, Ort – keine Namen, kein Umsatz) an den Dienst
Nominatim (OpenStreetMap) und ist gedrosselt. Nur nach bewusstem Klick.

### 5.8 Export und Löschen
- **„💾 Als Excel exportieren"** – kompletter Datenbestand als Excel-Datei.
  Vor größeren Änderungen oder dem Löschen immer empfehlen!
- **„🗑 Daten löschen"** – entfernt alle lokalen Daten nach Bestätigung.

---

## 6. Karte bedienen

### 6.1 Suche
Suchfeld oben: „Kunde, Ort, PLZ suchen…" – findet Kunden nach Name, Ort, PLZ oder
Kundennummer und fliegt sie an.

### 6.2 Kundenmarker und Popup
Kunden erscheinen als Marker (bei vielen Kunden als Cluster-Zahlen). Klick/Tipp auf
einen Marker zeigt: Name, Adresse, Hierarchie (Channel › Gruppe › Bezirk), Umsatz,
Ansprechpartner mit Telefon/E-Mail, Besuchsstatus und Aktionen
(„➕ Zur Tour", „📋 Kopieren").

### 6.3 Kartenstil
Umschalter auf der Karte: **„Standard"** (Voreinstellung), **„Hell"** (gut für
Datenanalyse), **„Satellit"**. Die Wahl wird gespeichert.

### 6.4 Gebietsflächen einfärben
**Klickpfad:** `„🗺️ Gebietsplanung" → Tab „🗺️ Gebiete"` →
- **„Ebene"**: „Keine Gebiete", „Landkreise", „PLZ-Zonen (1-stellig)" …
  „PLZ-Gebiete (5-stellig)"
- **„Anzeige"** (unter „Ansicht & Farbe"): „Automatisch (nach Zoom)",
  „Vertriebsbezirk (Flächen)", „Vertriebsgruppe (Flächen)", „Besuchsstatus",
  „🕳️ Weiße Flecken (Abdeckung)" – rot = keine Kunden, gelb = zugeordnet aber
  leer, grün = abgedeckt.

**Automatisch (nach Zoom):** weit herausgezoomt → Vertriebsgruppen als Flächen mit
Umsatz-Label; mittlerer Zoom → Betriebsbezirke; nah herangezoomt → einzelne Kunden.

### 6.5 Zahlen auf der Karte richtig lesen
- Flächen-Labels zeigen den Namen der Einheit und die **Gesamtumsatzsumme als
  „Σ … T€"** (Tausend Euro, gerundet). Der exakte Eurobetrag steht im Tooltip
  (Maus über dem Label).
- Die Label-Summe ist die **fachliche Gesamtsumme über alle Kunden der Einheit** –
  aktive Filter oder ein Tour-Fokus ändern diese Summe nicht. Jede Gruppe / jeder
  Bezirk erhält ein Label, auch wenn seine Kunden gerade ausgefiltert sind.
- Anzeige-Regel überall in der App: ab 10.000 € kompakt in T€, exakter Betrag im Tooltip.

### 6.6 Gebiets-Popup (Desktop)
Klick auf eine Fläche zeigt Kundenzahl, Bezirksverteilung und „Umsatz gesamt".
Dort außerdem:
- **„✏️ Kunden dieses Gebiets umordnen …"** – öffnet den Gebiets-Editor: Kunden des
  Gebiets mit Checkboxen filtern und einem anderen Betriebsbezirk/einer Gruppe
  zuweisen, mit Rückgängig.
- **„Ganze Fläche zuweisen"** – Dropdown „Vertriebsbezirk" ordnet die komplette
  Fläche zu (auch ohne Kunden).
Auf dem Smartphone sind Gebiete nur lesbar (Hinweis in der App); Änderungen am Desktop.

---

## 7. Gebiets-Cockpit (Analysezentrum)

**Klickpfad:** `„🗺️ Gebietsplanung" → Tab „🗺️ Gebiete" → „📊 Gebiets-Cockpit öffnen"`

### 7.1 Aufbau
- **„Vertriebsgruppe"-Auswahl (oben):** begrenzt Kennzahlen, Vergleich und Simulation
  auf eine Gruppe („Alle Gruppen" = Gesamtvergleich). Praxis-Empfehlung: innerhalb
  der eigenen Vertriebsgruppe vergleichen und umverteilen.
- **Drei KPI-Karten:** „Status" (Ausgewogen / Ungleich verteilt, mit Kunden-Faktor),
  „Top – …" und „Flop – …" (die Beschriftung folgt der gewählten Ebene, z. B.
  „Top – Vertriebsbezirk"). Groß steht der Wert, klein darunter der Name der Einheit.
- **Tabelle:** Spalten „Vertriebsbezirk" (bzw. gewählte Ebene), „Kunden", „Umsatz",
  „Auslastung". Standard-Sortierung „Umsatz ↓", umschaltbar auf „Kunden ↓" und
  „Name A–Z". Standardansicht: Top 3 und Flop 3 mit Trennlinie; **„Alle anzeigen"**
  öffnet die komplette Liste. Suchfeld „filtern…" für einzelne Einheiten.
- **Balken „Auslastung":** relative Stärke zum stärksten sichtbaren Wert
  (stärkster = 100 %); Bezugsgröße ist die gewählte Sortier-Kennzahl.
- Umsätze in der Tabelle: kompakt (T€-Regel), exakter Betrag als Tooltip.

### 7.2 Fairness-Kennzahl
„Ausgewogen" bis Kunden-Faktor 1,5× zwischen größter und kleinster Einheit;
darüber „Ungleich verteilt". Ziel von Umverteilungen ist ein Faktor ≤ 1,5.

---

## 8. Was-wäre-wenn-Simulation (Gebiete umverteilen)

Die Simulation ändert **keine echten Daten**, bis „Zuweisung übernehmen" gedrückt wird.

### 8.1 Klickpfad komplett
1. `„🗺️ Gebietsplanung" → Tab „🗺️ Gebiete" → „📊 Gebiets-Cockpit öffnen"`
2. Bereich **„Was-wäre-wenn: Gebiete zuweisen"**:
   - **„Ebene"** wählen (z. B. Landkreise)
   - **„Suche / PLZ-Präfix"**: z. B. `52` findet alle PLZ 52xxx; oder Kreisname
   - optional Hierarchie-Filter (z. B. nur ein Vertriebsbezirk)
   - optional Häkchen **„Auch Gebiete ohne Kunden einbeziehen"** (weiße Flecken)
3. Gebiete per Checkbox auswählen oder **„Alle sichtbaren auswählen"**
4. **„Zuweisen als"** (Vertriebsbezirk / Vertriebsgruppe / ggf. Channel) und
   **„Ziel"** wählen
5. **„Auswahl zuweisen"** – die Kennzahlen oben aktualisieren sich sofort
   (Deltas in Grün/Rot, Umsatz je Aktion und Gesamtsumme der umgebuchten Kunden)
6. Prüfen, ggf. weitere Zuweisungen; **„↶ Ein Schritt zurück"** nimmt den letzten
   Schritt zurück (bis zu 30 Schritte), **„Simulation zurücksetzen"** verwirft alles
7. **„Zuweisung übernehmen"** schreibt dauerhaft (mit Bestätigungsdialog)

**Merksatz:** „Auswahl zuweisen" ist Simulation – erst „Zuweisung übernehmen" schreibt.

### 8.2 Simulation auf der Karte prüfen
Bei aktiver Simulation heißt der Button oben im Cockpit **„Simulation auf Karte
prüfen"** (sonst „Zur Karte"). Er schließt das Cockpit und zeigt die Simulationsleiste
auf der Karte mit drei Ansichten:
- **„Alt"** – Zuordnung vor der Simulation
- **„Neu"** – Zuordnung nach der Simulation
- **„Änderungen"** – nur geänderte Flächen hervorgehoben (alte Randfarbe + neue Füllfarbe)

Tooltips/Popups zeigen je Gebiet „Alt → Neu", Kundenzahl und Umsatz.
Aktionen in der Leiste: **„Simulation bearbeiten"** (zurück ins Cockpit, Entwurf
bleibt erhalten), **„Verwerfen"**, **„Zuweisung übernehmen"**.

---

## 9. Tour planen (Außendienst)

Der Nutzer plant seine Tour **selbst**, Schritt für Schritt. TourFuchs unterstützt
mit Vorschlägen und Optimierung.

### 9.1 Schritt für Schritt
**Klickpfad:** `„🚗 Außendienst" → Tab „Tour"`
1. **Vertriebsbezirk wählen** (oben im Tour-Tab). Vorschläge kommen dann nur aus
   diesem Bezirk. „Alle Bezirke" ist möglich.
2. **„1. Startpunkt"**: entweder **„📍 Mein Standort"** (GPS) oder im Feld
   „…oder Kunde als Start wählen" einen Kunden suchen und antippen.
3. **Plan-Einstellungen** (direkt darunter): **„Datum"** (vorbelegt: heute),
   **„Start"** (Uhrzeit, Standard 08:00), **„Besuch (Min.)"** (Standard 45).
   Diese Werte steuern Tagesplan-Druck, Kalender-Termine und die QR-Übergabe.
4. **Vorschläge**: Umschalter **„Umkreis um Start"** / **„Entlang der Tour"**
   (Experten-Modus), Umkreis/Korridor per Schieberegler, Häkchen
   **„Überfällige zuerst"** priorisiert fällige Kunden.
5. Kunden aus der Vorschlagsliste oder aus Karten-Popups mit **„➕ Zur Tour"** hinzufügen.
6. **„⚡ Reihenfolge optimieren"** – kürzeste Strecke (Nearest-Neighbor + 2-Opt).
7. **„🗺️ Route auf Karte anzeigen"** – fokussiert die Karte auf die Tour.
8. **„🧭 In Google Maps navigieren"** – Übergabe zur Navigation (max. 10 Stopps).

### 9.2 Ziel und Rundreise
- **„2. Ziel (optional)"** (Experten-Modus): fester Endpunkt der Tour; Vorschläge
  „Entlang der Tour" nutzen dann die Strecke Start → Stopps → Ziel.
- Häkchen **„🔁 Rundreise (zurück zum Start)"**: Start ist zugleich Ziel.
- Ohne Ziel und ohne Rundreise ist der letzte Stopp automatisch das Ziel.

### 9.3 Straßenroute (OSRM) – Zustimmung erforderlich
Die Routenlinie kann als Luftlinie oder als echte Straßenroute gezeichnet werden
(Umschalten über „🗺️ Route auf Karte anzeigen" → der Button wechselt zu
„🗺️ Straßenroute anzeigen" / „🗺️ Luftlinie anzeigen"). Auch die Vorschläge
„Entlang der Tour" können dem echten Straßenverlauf folgen.

**Wichtig:** Straßenrouten berechnet der externe Dienst OSRM. Beim ersten Aktivieren
fragt TourFuchs um **ausdrückliche Zustimmung**; übertragen werden nur die
Koordinaten von Start und Stopps – keine Namen, keine Kundendaten. Ohne Zustimmung
arbeitet alles mit der direkten Verbindung (Luftlinie), komplett offline.

### 9.4 Tagesplan drucken und Outlook-Termine
- **„🖨️ Tagesplan drucken"**: druckbarer Plan mit Ankunftszeiten (aus Datum,
  Startzeit, Fahrzeit-Schätzung und Besuchsdauer), Adressen, Kontakten, Checkboxen.
- **„📅 Kalender-Export (.ics)"**: erzeugt **einen Kalendertermin je Besuch**
  (für Outlook & Co.) – Beginn = berechnete Ankunft, Dauer = eingestellte
  Besuchsdauer (z. B. 45 min), mit Adresse und Kontaktdaten im Termin.
- **„📋 Als Text kopieren (Outlook/Copilot)"**: Tour als Text in die Zwischenablage.

### 9.5 Tour speichern
Bereich „Gespeicherte Touren" (Experten-Modus): Namen eingeben
(„Tourname, z. B. Dienstag Nord") → **„💾"**. Gespeicherte Touren später laden.

### 9.6 „Was ist in meiner Nähe?"
**Klickpfad:** Tab „Tour" → **„📍 Was ist in meiner Nähe?"** (bzw. Karte-Tab mobil)
Setzt den GPS-Standort als Start und zeigt Kunden im Umkreis, überfällige zuerst.
Die Ansicht „🎯 Chancen" zeigt nur fällige/überfällige Kunden auf der Karte.

### 9.7 Besuchsstatus und „Heute besucht" abhaken
Aus „Besuchsrhythmus (Wochen)" und „Letzter Besuch" berechnet TourFuchs je Kunde:
**ok** (grün) / **bald fällig** (gelb) / **überfällig** (rot; auch: noch nie besucht).
Kunden ohne Rhythmus haben keinen Status.
Einen Besuch als erledigt eintragen geht an zwei Stellen:
- **direkt in der Tourliste** (Bereich „Meine Tour"): je Stopp der Button
  **„✓ Heute"** – der Stopp wird als besucht markiert (durchgestrichen/grün),
  ideal zum Abarbeiten unterwegs.
- im **Kunden-Popup** auf der Karte: **„✓ Heute besucht"**.
Der Besuchsstatus (auch die Farbe auf der Karte) aktualisiert sich sofort und
wird lokal gespeichert.

---

## 10. Tour vom Desktop aufs Handy übertragen (QR-Code)

Überträgt **nur die geplante Tour** – nie die Kundendatenbank. Der Weg ist
Bildschirm → Kamera: ohne Netzwerk, ohne Datei, ohne Server.

### 10.1 Am Desktop (Sender)
**Klickpfad:** Tab „Tour" → Tour planen → **„📲 An Handy übergeben (QR)"**
Zeigt den Dialog „📲 Tour an Handy übergeben" mit dem QR-Code. Im Code stecken:
Stopps (Name, Koordinaten, Adresse, Telefon, Kundennummer), Startpunkt, Datum,
Startzeit, Besuchsdauer, Rundreise-Einstellung. Maximal 12 Stopps je Code.
Der QR-Code enthält einen **App-Link** (die Tour steckt im Adress-Fragment `#t=…`,
das nie an einen Server gesendet wird).

### 10.2 Am Handy (Empfänger) – schnellster Weg: normale Kamera
Den QR-Code einfach mit der **normalen Handy-Kamera** (oder der Kamera-App)
scannen. Das Handy erkennt den Link und öffnet TourFuchs direkt mit der Tour –
die **installierte PWA**, sonst der **Browser**. Die App muss vorher nicht
geöffnet werden. Es erscheint sofort der Empfangs-Dialog (siehe 10.3).

### 10.3 Am Handy (Empfänger) – alternativ in der App scannen
**Klickpfad:** Tab „Tour" → **„📷 Tour vom Desktop scannen"**
1. Kamera auf den QR-Code am Desktop-Bildschirm richten (Scan läuft automatisch).
2. Falls die Kamera nicht verfügbar ist: unten „Foto des QR-Codes wählen"
   (Foto aufnehmen oder aus der Galerie wählen).
3. Nach dem Scan erscheint die empfangene Tour mit drei Aktionen:
   - **„➕ Als Tour übernehmen"** – Stopps werden mit den lokalen Kundendaten
     abgeglichen (über Kundennummer, sonst Name + PLZ) und als Tour gesetzt.
     Nur möglich, wenn mindestens ein Stopp lokal gefunden wird; die App meldet,
     wie viele Stopps zugeordnet werden konnten.
   - **„🧭 In Google Maps navigieren"** – funktioniert **auch ohne lokale
     Kundendaten**, direkt aus dem QR-Code.
   - **„📅 Termine als Kalender (.ics)"** – ebenfalls direkt aus dem Code,
     mit Datum/Startzeit/Besuchsdauer aus der Desktop-Planung.

---

## 11. Filter (Tab „Filter")

Gebietshierarchie: Vertriebschannel (optional) › Vertriebsgruppe (empfohlen) ›
**Betriebsbezirk (Pflicht, führend)**. Zusätzliche Ebenen aus eigenen Importspalten
erscheinen automatisch, wenn die Spalte sinnvolle Werte enthält.

Im Tab „Filter" lassen sich Werte je Ebene ein-/ausblenden (durchsuchbar, mit
Kundenzählern). Wichtig für Support-Fragen: **Filter blenden Kunden auf der Karte
aus** – häufigste Ursache für „Kunden fehlen". Die Umsatz-Labels der Flächen zeigen
trotzdem immer die Gesamtsumme (fachliche Sicht).

---

## 12. Mobile Bedienung

- Mobil stehen **Karte und Tour** im Mittelpunkt; Gebietsplanung/Cockpit sind
  ausgeblendet (Hinweis verweist auf den Desktop).
- **Bottom Sheet:** das Tour-Panel unten lässt sich in Stufen ziehen
  (minimiert / halb / voll), die Karte bleibt sichtbar.
- **Hochformat** ist optimiert; im Querformat erscheint ein Drehhinweis.
- Kunden-Popups sind scrollbar; „➕ Zur Tour" funktioniert auch aus dem Popup.
- Im Experten-Modus können einzelne Abschnitte per Wischgeste ausgeblendet werden;
  „Elemente zurücksetzen" holt sie zurück.
- **Mobile-Vorschau am Desktop:** Symbol „📱" in der Topbar simuliert die
  Smartphone-Ansicht (praktisch für Schulungen).
- **„Datenbank zurücksetzen"** (unten im mobilen Panel) löscht die lokalen Daten
  auf dem Gerät – vorher Export empfehlen.

---

## 13. Datenschutz-Fakten (für Antworten des Bots verbindlich)

1. Kundendaten werden **ausschließlich lokal im Browser** gespeichert (IndexedDB).
   Kein Server, keine Cloud, kein Tracking.
2. **Nominatim (OpenStreetMap)** – nur bei bewusst ausgelöster Funktion
   „🎯 Adressen exakt verorten": gesendet werden Straße, PLZ, Ort.
   Nicht gesendet: Kundenname, Umsatz, Ansprechpartner, Telefon, E-Mail.
3. **OSRM (Straßenrouten)** – nur nach ausdrücklicher Zustimmung (einmaliger
   Dialog): gesendet werden ausschließlich die Koordinaten von Startpunkt und
   Tour-Stopps. Ohne Zustimmung: Luftlinie, keine externe Anfrage.
4. **Google Maps** – erst bei bewusstem Klick auf „🧭 In Google Maps navigieren"
   verlassen Routendaten die App; ab dann gelten Googles Bedingungen.
5. **Kartenkacheln** (OpenStreetMap/CARTO/Esri) werden beim Betrachten geladen;
   dabei erhalten die Dienste technische Zugriffsdaten (z. B. IP-Adresse).
6. **QR-Übergabe** überträgt nichts über das Netz (Bildschirm → Kamera).
7. Browserwechsel, Gerätewechsel oder Löschen der Browserdaten kann lokale Daten
   entfernen → vorher „💾 Als Excel exportieren".

---

## 14. Fehlerbilder: Symptom → Ursache → Lösung

**Kunden erscheinen nicht auf der Karte**
- PLZ fehlt/ungültig → Import-Fehlerliste prüfen, Excel korrigieren, neu importieren
- Spalte falsch zugeordnet → erneut importieren, Dialog „Spalten zuordnen" prüfen
- Durch Filter ausgeblendet → Tab „Filter" prüfen (Häkchen der Ebenen-Werte)
- Tour-Fokus aktiv → „🗺️ Route auf Karte anzeigen" deaktivieren bzw. Tour leeren
- Falscher Modus/Zoom → Modus prüfen, herauszoomen

**Gebiete sind nicht eingefärbt**
- „Ebene" steht auf „Keine Gebiete" → Ebene wählen (Tab „🗺️ Gebiete")
- Keine Betriebsbezirk-Spalte importiert → Import prüfen
- „Anzeige" unpassend → z. B. „Vertriebsbezirk (Flächen)" wählen
- Gebiet ohne Kunden und ohne Zuordnung → Flächenzeile importieren oder
  Fläche per Gebiets-Popup zuweisen

**Umsatzzahlen wirken falsch**
- Anzeige ist „Σ … T€" = Tausend Euro (gerundet); exakter Betrag im Tooltip
- Label-Summe = Gesamtsumme der Einheit, unabhängig von Filtern
- Bei Import aus Fremdsystemen Zahlformat der Umsatzspalte prüfen (Punkt/Komma)

**Keine Tourvorschläge**
- Kein Startpunkt gesetzt → „📍 Mein Standort" oder Kunden als Start wählen
- Falscher/kein Bezirk gewählt → Bezirksauswahl oben im Tour-Tab prüfen
- Radius zu klein → Schieberegler erhöhen
- Alle passenden Kunden schon in der Tour, Filter zu eng

**„Entlang der Tour" zeigt nur Luftlinie**
- OSRM-Zustimmung nicht erteilt → beim Umschalten auf Straßenroute zustimmen
- Routingdienst gerade nicht erreichbar → App fällt automatisch auf die direkte
  Verbindung zurück (Hinweistext erscheint), später erneut versuchen

**Kalender-Termine haben falsche Zeit/Dauer**
- Plan-Einstellungen prüfen: „Datum", „Start", „Besuch (Min.)" im Tour-Tab –
  sie steuern die .ics-Termine

**QR-Scan funktioniert nicht**
- Kamera-Berechtigung verweigert → Foto-Fallback nutzen („Foto des QR-Codes wählen")
- QR zu klein/unscharf → am Desktop Dialog größer ziehen, Bildschirmhelligkeit hoch
- „Als Tour übernehmen" ausgegraut → kein Stopp in den lokalen Daten gefunden;
  Navigation und .ics funktionieren trotzdem direkt aus dem Code

**PWA zeigt alten Namen / Update erscheint nicht**
- Alte PWA vom Homescreen entfernen, Browser neu laden, neu installieren
- App schließen und neu öffnen; Update-Hinweis bestätigen

**Alles zurücksetzen**
- Tab „📄 Daten" → „💾 Als Excel exportieren" (Sicherung) → „🗑 Daten löschen" →
  neue Liste importieren

---

## 15. Glossar

- **Betriebsbezirk / Vertriebsbezirk:** führende operative Gebietsebene (Pflichtspalte)
- **Vertriebsgruppe:** übergeordnete Vergleichs-/Steuerungsebene (empfohlen)
- **Flächenzeile:** Importzeile ohne Kundenname, ordnet ein Gebiet einem Bezirk zu
- **Simulation:** testweise Umverteilung im Cockpit; echt erst nach „Zuweisung übernehmen"
- **Bottom Sheet:** mobiles Tour-Panel, in Stufen über der Karte
- **PWA:** installierbare Web-App mit Offline-Fähigkeit
- **T€:** Tausend Euro (Anzeige-Einheit ab 10.000 €)
- **Überfällig / bald fällig:** Besuchsstatus aus Rhythmus + letztem Besuch
- **Korridor:** Vorschlagsmodus „Entlang der Tour" (Abstand zur Route)
- **Weißer Fleck:** Gebiet ohne Kunden und ohne Zuordnung (Auswertung „Lücken")

---

## 16. Antwortregeln für den Guide-Bot

1. **Immer den Klickpfad nennen** – mit den exakten Beschriftungen aus diesem
   Dokument, inklusive Modus und Tab (viele Probleme sind nur ein falscher Modus).
2. **Mobil vs. Desktop unterscheiden:** Gebietsplanung/Cockpit/Simulation gibt es
   nur am Desktop; auf dem Handy Karte und Tour.
3. **Nichts versprechen, was die App nicht hat.** Es gibt insbesondere: keinen
   automatischen Tourvorschlag, keine Cloud-Synchronisierung, kein Nutzerkonto,
   keine KI-Funktionen in der App selbst.
4. **Datenschutzfragen** nur mit den Fakten aus Abschnitt 13 beantworten; im
   Zweifel auf die Datenschutzerklärung in der App verweisen (ⓘ → Rechtliches).
5. **Vor destruktiven Aktionen** („🗑 Daten löschen", „Datenbank zurücksetzen")
   immer zuerst „💾 Als Excel exportieren" empfehlen.
6. Bei Simulationsfragen immer den Merksatz nennen: *„Auswahl zuweisen" ist
   Simulation – erst „Zuweisung übernehmen" schreibt dauerhaft.*
7. Bei unklaren Fehlermeldungen zuerst die drei Standardprüfungen: richtiger
   Modus? richtiger Tab? Filter aktiv?
