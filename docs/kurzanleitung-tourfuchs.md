# TourFuchs Vertrieb - Kurzanleitung

## 1. App starten

TourFuchs im Browser oder als installierte PWA öffnen.

Wichtig:

- Desktop: Daten, Gebiete, Cockpit, Simulation
- Smartphone: Karte und Tour

## 2. Daten laden

1. Tab Daten öffnen.
2. Excel-Liste hochladen.
3. Spaltenzuordnung prüfen.
4. Importieren.
5. Import-Ergebnis kontrollieren.

Pflichtfelder:

- Kundenname
- PLZ
- Vertriebsbezirk

## 3. Karte nutzen

- Suche oben für Kunde, Ort, PLZ oder Kundennummer.
- Marker anklicken, um Kundendetails zu sehen.
- Kartenstil wechseln: Hell, Standard oder Satellit.
- Im Gebietsmodus Flächen nach Vertriebsbezirk oder Vertriebsgruppe einfärben.

## 4. Gebiets-Cockpit

1. Modus Gebietsplanung wählen.
2. Tab Gebiete öffnen.
3. Gebiets-Cockpit öffnen.
4. KPI-Karten lesen:
   - Status
   - Top-Bezirk
   - Schwächster Bezirk
5. Tabelle lesen:
   - Standard: Top & Flop 3
   - Balken: relative Stärke zum stärksten sichtbaren Wert
   - Alle anzeigen: vollständige Liste

## 5. Was-wäre-wenn-Simulation

1. Ebene wählen, zum Beispiel Landkreise.
2. Gebiet suchen oder auswählen.
3. Ziel-Bezirk wählen.
4. Auswahl zuweisen.
5. Ergebnis prüfen.
6. Entweder Zuweisung übernehmen oder Simulation zurücksetzen.

Merksatz:

> Erst Zuweisung übernehmen schreibt dauerhaft.

## 6. Tour planen

1. Modus Außendienst wählen.
2. Tab Tour öffnen.
3. Vertriebsbezirk auswählen.
4. Startpunkt setzen.
5. Kunden im Umkreis oder entlang der Tour anzeigen.
6. Kunden zur Tour hinzufügen.
7. Reihenfolge optimieren.
8. Route anzeigen oder an Google Maps übergeben.

## 7. Mobile Nutzung

Auf dem Smartphone stehen Karte und Tour im Mittelpunkt.

- Bottom Sheet hochziehen oder minimieren; „Tour" zieht das Blatt ganz auf.
- Kunden antippen, um Details zu sehen.
- Tour zusammenstellen und navigieren.
- Die Tour ist ein Akkordeon aus **Startpunkt · Vorschläge · Meine Tour** –
  genau eine Gruppe ist offen und folgt dem Arbeitsfluss.
- Ein kleiner schwebender **Fuchs-Knopf** schlägt den nächsten Schritt vor:
  📍 Kunden in der Nähe → 🚩 Tour ab hier planen → 🗺️ Route auf die Karte.

Der Service-Modus ist ein optionales Modul: im Profi-Modus unten in der
Gebietsplanung per Häkchen einblendbar.

Komplexe Gebietsplanung bitte am Desktop durchführen.

## 8. Datenschutz

- Kundendaten bleiben lokal im Browser.
- OSM-Geocoding sendet nur Adresse, PLZ und Ort.
- Google Maps erhält Daten erst bei bewusster Übergabe.
- Vor Daten löschen bei Bedarf Excel-Export erstellen.

## 9. Häufige Probleme

### Keine Kunden sichtbar

- Filter prüfen.
- Bezirk prüfen.
- PLZ-Spalte prüfen.
- Karte herauszoomen.

### Keine Tourvorschläge

- Startpunkt setzen.
- Radius erhöhen.
- Bezirk prüfen.

### Alter PWA-Name

- Alte PWA entfernen.
- Seite neu laden.
- App neu installieren.

