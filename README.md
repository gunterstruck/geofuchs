# 🦊 TourFuchs Vertrieb

**Kundenlisten aus Excel auf der Deutschlandkarte – Gebietsübersicht und Besuchsplanung für den Außendienst.**

> Installierbare Web-App (PWA) · Keine Anmeldung · Keine Cloud · Alle Daten bleiben im Browser

> ⚠️ **Privates, nicht-kommerzielles Projekt.** Nutzung auf eigene Gefahr, ohne Gewähr und ohne Haftung jeglicher Art. Siehe [LICENSE](./LICENSE).

---

## Was macht TourFuchs Vertrieb?

TourFuchs beantwortet die zwei Kernfragen im Vertriebsalltag:

1. **„Wer betreut wo welche Kunden?“** – Excel-Liste hochladen, fertig. Kunden erscheinen
   auf der Deutschlandkarte, Gebiete werden nach Vertriebsbeauftragten eingefärbt.
2. **„Wen besuche ich als Nächstes?“** – Startpunkt wählen, Umkreis-Vorschläge erhalten,
   Tour zusammenstellen, Reihenfolge optimieren lassen und direkt in Google Maps navigieren.

### Funktionen im Überblick

| Bereich | Funktion |
|---|---|
| 📄 **Daten** | Excel-/CSV-Import per Klick oder Drag & Drop, automatische Spaltenerkennung mit Prüf-Dialog, Excel-Vorlage, Demo-Daten, Excel-Export |
| 📍 **Verortung** | Sofort über PLZ-Koordinaten (offline, ohne API-Schlüssel); optional adressgenau über OpenStreetMap/Nominatim |
| 🗺️ **Gebiete** | Landkreise (400 Kreise & Städte) **und** PLZ-Ebenen (1-, 2-, 3- und 5-stellig); Flächen einfärbbar nach Vertriebsbeauftragtem, **Betriebsbezirk** oder **Vertriebsgruppe** (mit Namens-Label und Umsatzsumme); Klick zeigt Kunden & Team-Verteilung je Gebiet |
| ✏️ **Gebiets-Editor** | Im Gebiets-Popup „Kunden dieses Gebiets umordnen": Kundenliste des Gebiets mit Checkboxen & Filter, ausgewählte Kunden (oder das ganze Gebiet) einem anderen Vertriebsbeauftragten/Betriebsbezirk zuweisen – auch gemischte Gebiete gezielt aufteilen; wirkt sofort auf der Karte, mit **Rückgängig** |
| 🔍 **Zoom-Automatik** | „Automatisch (nach Zoom)": weit herausgezoomt zeigt die Karte Vertriebsgruppen als Flächen (mit Umsatz), mittlerer Zoom die Betriebsbezirke, hineingezoomt die einzelnen Kunden – der Detailgrad wächst mit dem Zoom |
| 👥 **Team** | Vertriebsbeauftragte (feste Farben) und die dreistufige Vertriebshierarchie **Vertriebschannel › Vertriebsgruppe › Betriebsbezirk** einzeln ein-/ausblenden; jede Ebene optional, nur vorhandene Ebenen werden angezeigt; Kundenzähler |
| 🚗 **Tour** | Startpunkt = eigener GPS-Standort oder ein Kunde; Vorschläge „Wen könnte ich in der Nähe noch besuchen?“ (Umkreis einstellbar); Tourenoptimierung (kürzeste Strecke, Nearest-Neighbor + 2-Opt); Übergabe an Google Maps zur Navigation |
| 🔍 **Suche** | Kunden nach Name, Ort, PLZ oder Kundennummer finden und anfliegen |
| 📱 **PWA** | Auf Smartphone/Desktop installierbar, App-Shell und Gebietsdaten offline verfügbar, zuletzt gesehene Kartenausschnitte werden gecacht |

### Erwartetes Excel-Format

Die Spaltennamen werden automatisch erkannt (auch Synonyme wie „Firma“, „Betreuer“, „Kundenkreis“ …)
und können beim Import manuell zugeordnet werden. Empfohlene Spalten:

| Spalte | Pflicht | Beispiel |
|---|---|---|
| Kundenname | ✅ | Autohaus Schmidt GmbH |
| PLZ | ✅ (für die Karte) | 50667 |
| Straße & Hausnummer | – | Hauptstraße 12 |
| Ort | – | Köln |
| Betriebsbezirk | ✅ | Bezirk Rheinland |
| Vertriebsbeauftragter | – | Max Mustermann |
| Vertriebschannel | – | Fachhandel |
| Vertriebsgruppe | – | Handel |
| Ansprechpartner, Telefon, E-Mail | – | Herr Schmidt · 0221 123456 |
| Besuchsrhythmus (Wochen), Letzter Besuch | – | 6 · 12.05.2026 |
| Kundennummer, Umsatz, Lat/Lng | – | optional |

Die drei Ebenen **Vertriebschannel › Vertriebsgruppe › Betriebsbezirk** bilden eine Hierarchie (oben → unten). Der **Betriebsbezirk** (unterste, operative Ebene) ist Pflicht; Vertriebschannel, Vertriebsgruppe und der Vertriebsbeauftragte sind optional – fehlt eine dieser optionalen Spalten, wird die Ebene einfach nicht angezeigt. Im Gebiets-Cockpit lässt sich wahlweise nach **Vertriebsbeauftragtem oder Betriebsbezirk** (bzw. Gruppe/Channel) auswerten und zuweisen.

Eine fertige Vorlage gibt es in der App unter **Daten → Excel-Vorlage herunterladen**.

#### Flächenzeilen (Gebiete ohne Kunden zuordnen)

Neben Kundenzeilen kann die Liste **Flächenzeilen** enthalten: eine Zeile **ohne Kundenname**, aber mit der Spalte **Gebiet (LK/PLZ)** und einem **Betriebsbezirk** (oder Vertriebsbeauftragten). So lässt sich ein ganzer Landkreis oder ein PLZ-Bereich einem Bezirk/VB zuordnen, auch wenn dort (noch) keine Kunden sind – z. B. um Gebiete für Neukunden zu reservieren. „Gebiet" ist entweder ein **Landkreis-Name** (z. B. `Oberhausen`) oder eine **PLZ / PLZ-Präfix** (`46` = alle 46xxx, `46045` = genau dieses PLZ-Gebiet). Dasselbe geht interaktiv über das **Gebiets-Popup** auf der Karte oder im **Cockpit** (Häkchen „Auch Gebiete ohne Kunden einbeziehen").

#### Plausibilitätsprüfung beim Import

Beim Import werden die Zeilen geprüft. **Gültige Zeilen werden importiert**, problematische landen in einer **herunterladbaren Fehlerliste (Excel)** statt in einer unübersichtlichen Fehleranzeige. Erkannt werden u. a.: Dubletten (gleiche Kundennummer bzw. Name + PLZ), fehlender Betriebsbezirk, widersprüchliche Gebietszuordnungen (ein Gebiet zwei verschiedenen Bezirken zugewiesen), unbekannte Landkreise/PLZ-Gebiete sowie nicht auffindbare Kunden-PLZ (Hinweis).

### Datenschutz

- Kundendaten werden **ausschließlich lokal im Browser** gespeichert (IndexedDB) – kein Server, kein Tracking, keine KI.
- Nur die optionale adressgenaue Verortung sendet die jeweilige Adresse an OpenStreetMap (Nominatim), gedrosselt gemäß deren Nutzungsrichtlinie.

---

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal testen
```

**Stack:** Vite · Leaflet + markercluster · SheetJS (xlsx) · vite-plugin-pwa (Workbox) · Vanilla JS (ES Modules)

### Projektstruktur

```
src/
├── main.js               # Einstiegspunkt & Wiederherstellung des gespeicherten Zustands
├── core/
│   ├── config.js         # zentrale Konfiguration (Farben, Ebenen, Karten-Setup)
│   └── state.js          # App-State + Pub/Sub
├── services/
│   ├── excel.js          # Import/Export, Spaltenerkennung, Vorlage, Demo-Daten
│   ├── geocode.js        # PLZ-Zentroide + optionale Nominatim-Geocodierung
│   ├── geodata.js        # Gebiets-GeoJSON laden, Point-in-Polygon
│   └── storage.js        # IndexedDB-Persistenz
├── features/
│   ├── map.js            # Leaflet-Karte, Gebiets-Layer, Marker, Tour-Anzeige
│   ├── territory.js      # Kunden→Gebiet-Aggregation
│   └── tour.js           # Umkreis, Routenoptimierung, Google-Maps-Link
└── ui/                   # Sidebar, Import-Assistent, Tour-Panel, Suche, Toasts

public/geodata/           # gebündelte Gebietsdaten (siehe Datenquellen)
```

### Deployment (Vercel)

Das Repository ist deployfertig für [Vercel](https://vercel.com):

1. Repository bei Vercel importieren (Framework **Vite** wird automatisch erkannt, `vercel.json` liegt bei)
2. Build-Kommando `npm run build`, Output `dist/` – beides vorkonfiguriert
3. Nach dem Deploy ist die App unter der Vercel-URL erreichbar und als PWA installierbar
   (Browser-Menü → „App installieren“ / „Zum Startbildschirm hinzufügen“)

Alternativ per CLI: `npx vercel`

---

## Datenquellen & Lizenzen

| Daten | Quelle | Lizenz |
|---|---|---|
| Landkreisgrenzen (VG250, vereinfacht) | © GeoBasis-DE / [BKG](https://gdz.bkg.bund.de/) 2024 | [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0) |
| PLZ-Gebiete (vereinfacht, aus OSM) | [Esri Deutschland Open Data](https://opendata-esridede.opendata.arcgis.com/) / © OpenStreetMap-Mitwirkende | [ODbL](https://opendatacommons.org/licenses/odbl/) |
| PLZ-Koordinaten | [WZB plz_geocoord](https://github.com/WZBSocialScienceCenter/plz_geocoord) / © OpenStreetMap-Mitwirkende | ODbL |
| Kartendarstellung | © OpenStreetMap & [CARTO](https://carto.com/attributions) | – |
| Geocoding (optional) | [Nominatim](https://nominatim.org/) | [Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) |

Verwendete Software-Bibliotheken (mit Lizenz) sind in der App unter **Lizenz & Rechtliches** sowie in der [LICENSE](./LICENSE)-Datei aufgeführt.

## Lizenz & Haftung

Privates, nicht-kommerzielles Projekt. **Alle Rechte vorbehalten** – keine Nutzung, Weitergabe oder
kommerzielle Verwertung ohne Zustimmung des Urhebers. Bereitstellung ohne jegliche Gewährleistung,
Nutzung auf eigene Gefahr, **keine Haftung jeglicher Art**. Vollständiger Text: [LICENSE](./LICENSE).

## Kontakt & Impressum

**Günter Struck** · Lönsberg 8 · 45136 Essen · geofuchs@online.de

**Made with 🦊 in Germany**
