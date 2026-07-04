# 🦊 GeoFuchs Vertrieb

**Kundenlisten aus Excel auf der Deutschlandkarte – Gebietsübersicht und Besuchsplanung für den Außendienst.**

> Installierbare Web-App (PWA) · Keine Anmeldung · Keine Cloud · Alle Daten bleiben im Browser

---

## Was macht GeoFuchs Vertrieb?

GeoFuchs beantwortet die zwei Kernfragen im Vertriebsalltag:

1. **„Wer betreut wo welche Kunden?“** – Excel-Liste hochladen, fertig. Kunden erscheinen
   auf der Deutschlandkarte, Gebiete werden nach Vertriebsbeauftragten eingefärbt.
2. **„Wen besuche ich als Nächstes?“** – Startpunkt wählen, Umkreis-Vorschläge erhalten,
   Tour zusammenstellen, Reihenfolge optimieren lassen und direkt in Google Maps navigieren.

### Funktionen im Überblick

| Bereich | Funktion |
|---|---|
| 📄 **Daten** | Excel-/CSV-Import per Klick oder Drag & Drop, automatische Spaltenerkennung mit Prüf-Dialog, Excel-Vorlage, Demo-Daten, Excel-Export |
| 📍 **Verortung** | Sofort über PLZ-Koordinaten (offline, ohne API-Schlüssel); optional adressgenau über OpenStreetMap/Nominatim |
| 🗺️ **Gebiete** | Landkreise (400 Kreise & Städte) **und** PLZ-Ebenen (1-, 2-, 3- und 5-stellig), eingefärbt nach dem Vertriebsbeauftragten mit den meisten Kunden; Klick zeigt Kunden & Team-Verteilung je Gebiet |
| 👥 **Team** | Vertriebsbeauftragte und Vertriebsgruppen einzeln ein-/ausblenden, feste Farben, Kundenzähler |
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
| Vertriebsbeauftragter | – | Max Mustermann |
| Vertriebsgruppe | – | Handel |
| Kundennummer, Umsatz, Lat/Lng | – | optional |

Eine fertige Vorlage gibt es in der App unter **Daten → Excel-Vorlage herunterladen**.

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

## Legacy

Die ursprüngliche Version mit KI-Chat-Assistent (Monolith, `app.html` bzw. `GeoFuchs_MVP V1.5.html`)
bleibt im Repository erhalten, ist aber nicht Teil des Builds. Die KI-Funktionen wurden bewusst
ausgeklammert – Konzept dazu folgt separat.

## Kontakt & Impressum

**Günter Struck** · Lönsberg 8 · 45136 Essen · geofuchs@online.de
GitHub: [@gunterstruck](https://github.com/gunterstruck)

Lizenz: siehe [LICENSE](./LICENSE)

**Made with 🦊 in Germany**
