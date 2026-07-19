# 🦊 TourFuchs Vertrieb

**Kundenlisten aus Excel auf der Deutschlandkarte – Gebiets-, Besuchs- und Servicevertragsplanung.**

> Installierbare Web-App (PWA) · Lokal nutzbar · Optionale M365-Anmeldung nur für Kundenbriefings

> ⚠️ **Privates, nicht-kommerzielles Projekt.** Nutzung auf eigene Gefahr, ohne Gewähr und ohne Haftung jeglicher Art. Siehe [LICENSE](./LICENSE).

---

## Was macht TourFuchs Vertrieb?

TourFuchs beantwortet die zwei Kernfragen im Vertriebsalltag:

1. **„Welcher Vertriebsbezirk betreut welche Kunden?“** – Excel-Liste hochladen, fertig.
   Kunden erscheinen auf der Deutschlandkarte, Gebiete werden nach Vertriebsbezirken eingefärbt.
2. **„Wen besuche ich als Nächstes?“** – Startpunkt wählen, Umkreis-Vorschläge erhalten,
   Tour zusammenstellen, Reihenfolge optimieren lassen und direkt in Google Maps navigieren.

### Funktionen im Überblick

| Bereich | Funktion |
|---|---|
| 📄 **Daten** | Excel-/CSV-Import per Klick oder Drag & Drop, automatische Spaltenerkennung mit Prüf-Dialog; eine neue Kundenliste ersetzt nach Warnung den bisherigen Bestand, reine Kontakt-/Gebietsdateien ergänzen ihn gezielt |
| 🛡️ **Sichere Demo** | Eindeutig markierte Beispielkunden, reservierte Drama-Rufnummern und `example.com`-Adressen; Telefon, E-Mail und Copilot-Briefing werden lokal simuliert, Exporte als Demo gekennzeichnet |
| 📍 **Verortung** | Sofort über PLZ-Koordinaten (offline, ohne API-Schlüssel); optional adressgenau über OpenStreetMap/Nominatim |
| 🗺️ **Gebiete** | Landkreise (400 Kreise & Städte) **und** PLZ-Ebenen (1-, 2-, 3- und 5-stellig); Flächen primär nach **Betriebsbezirk** einfärbbar, optional nach Vertriebsgruppe (mit Label und Umsatzsumme); Klick zeigt Kunden & Bezirksverteilung je Gebiet |
| ✏️ **Gebiets-Editor** | Im Gebiets-Popup „Kunden dieses Gebiets umordnen": Kundenliste des Gebiets mit Checkboxen & Filter, ausgewählte Kunden (oder das ganze Gebiet) einem anderen Betriebsbezirk oder einer Gruppe zuweisen – auch gemischte Gebiete gezielt aufteilen; wirkt sofort auf der Karte, mit **Rückgängig** |
| 🔍 **Zoom-Automatik** | „Automatisch (nach Zoom)": weit herausgezoomt zeigt die Karte Vertriebsgruppen als Flächen (mit Umsatz), mittlerer Zoom die Betriebsbezirke, hineingezoomt die einzelnen Kunden – der Detailgrad wächst mit dem Zoom |
| 👥 **Filter** | **Betriebsbezirk** ist die führende Ebene. Vertriebsgruppe kann zusätzlich eingeblendet werden; weitere optionale Ebenen lassen sich bei Bedarf ergänzen. Kundenzähler helfen beim schnellen Prüfen der Verteilung |
| 🚗 **Tour** | Startpunkt = eigener GPS-Standort oder ein Kunde; Vorschläge „Wen könnte ich in der Nähe noch besuchen?“ (Umkreis einstellbar); Tourenoptimierung (kürzeste Strecke, Nearest-Neighbor + 2-Opt); Übergabe an Google Maps zur Navigation |
| 📆 **Plan-Einstellungen** | Datum, Startzeit und Besuchsdauer (z. B. 45 min) der Tagestour sind einstellbar und fließen in Tagesplan-Druck und Kalender-Termine (.ics für Outlook, ein Termin je Besuch inkl. Fahrzeit) ein |
| 📲 **QR-Übergabe** | Am Desktop geplante Tour als QR-Code anzeigen, am Handy mit der Kamera scannen und übernehmen – nur die Tour (keine Datenbank), Bildschirm zu Kamera, ohne Netzwerk und ohne Server. Navigation und Kalender-Termine funktionieren direkt aus dem gescannten Code |
| 📋 **Kundenbriefing** | In **Basis** sofort ohne Einrichtung nutzbar: kundenspezifischen Prompt kopieren, Corporate Copilot öffnen und dort bewusst absenden. **Profi** ergänzt optional die automatische Entra-/Copilot-Verbindung und zeigt das Ergebnis direkt in TourFuchs |
| 🛡️ **Service-Vertragsradar** | Separater Excel-/CSV-Import für Vertragsstände aus SAP, SieSales/Salesforce oder weiteren Quellen. Exakter Kundenabgleich per Kundennummer, Quellenalter, Handlungsfristen, Vertragswert, SLA und Verantwortliche – im Profi-Modus, ohne den ruhigen Basis-Einstieg zu verändern |
| 🔊 **Zanobo-Brücke** | Serviceeinsätze mit Anlagen-ID verlinken direkt in die Schwester-App [Zanobo](https://zanobo.vercel.app) – akustischer Maschinen-Check am Smartphone, lokal im Browser, ohne Cloud. Vergleich statt Diagnose; die Anlagen-ID entspricht der Maschinen-ID am Zanobo-NFC-Tag und bleibt im URL-Fragment (wird nie an den Server übertragen). Eigene Zanobo-Instanz im Service-Cockpit einstellbar |
| 🔍 **Suche** | Kunden nach Name, Ort, PLZ oder Kundennummer finden und anfliegen |
| 📱 **PWA** | Auf Smartphone/Desktop installierbar, App-Shell und Gebietsdaten offline verfügbar, zuletzt gesehene Kartenausschnitte werden gecacht; mobil wird die Karte ruhig per Zwei-Finger-Geste statt zusätzlicher Zoomtasten bedient |
| 🖥️ **Mobile-Vorschau** | Zeigt am Desktop dieselben Kunden-, Briefing- und Tourabläufe im Smartphone-Format. Nach dem ersten Datenbestand weist ein einmaliger, ruhiger Kurzlauf auf den Einstieg hin und öffnet gezielt den mobilen Tour-Bereich |
| 🔐 **Datentresor** | Optional aktivierbar: Kundendaten werden **AES-256-verschlüsselt** lokal gespeichert (Schlüssel aus PIN via PBKDF2, nie gespeichert). Sperrbildschirm bei App-Start/Inaktivität, **optional Face/Touch ID** (WebAuthn-PRF als zusätzliche Tür), **einstellbare Auto-Lock-Zeit**, Wiederherstellungscode, Auto-Löschung nach zu vielen Fehlversuchen – alles ausschließlich mit der Web-Crypto-API, ohne Server |
| 🧳 **Sicherer Umzug** | Kundendaten verschlüsselt auf ein anderes Gerät übertragen: **verschlüsselte Datei** (`.tfsafe`, AES-256-GCM mit Zufallsschlüssel) + **Schlüssel als QR-Code**. Datei und Schlüssel reisen **getrennt** (Kanaltrennung) – ohne Schlüssel ist die Datei wertlos; der Schlüssel geht nur per Bildschirm→Kamera, nie übers Netz. Am Zielgerät folgt direkt das erzwungene Tresor-Setup |

### Erwartetes Excel-Format

Die Spaltennamen werden automatisch erkannt (auch Synonyme wie „Firma“, „Betreuer“, „Kundenkreis“ …)
und können beim Import manuell zugeordnet werden. Empfohlene Spalten:

| Spalte | Pflicht | Beispiel |
|---|---|---|
| Kundenname | ✅ | TourFuchs Demo · Autohaus 0001 |
| PLZ | ✅ (für die Karte) | 50667 |
| Straße & Hausnummer | – | Hauptstraße 12 |
| Ort | – | Köln |
| Betriebsbezirk | – (empfohlen) | Bezirk Rheinland |
| Vertriebschannel | – | Fachhandel |
| Vertriebsgruppe | – | Handel |
| Ansprechpartner, Telefon, E-Mail | – | Demo-Team · 0221 4710 000 · kunde-0001@example.com |
| Besuchsrhythmus (Wochen), Letzter Besuch | – | 6 · 12.05.2026 |
| Kundennummer, Umsatz, Lat/Lng | – | optional |

Der **Betriebsbezirk** ist die führende operative Ebene und steuert Gebietsplanung, Farben, Cockpit und Tourfilter. Er ist beim Import keine Pflicht: Eine einfache Liste (Name + PLZ) landet sofort auf der Karte, Kunden ohne Bezirk laufen unter „Ohne Zuordnung" und können später per neuem Import zugeordnet werden. **Vertriebsgruppe** ist die empfohlene zweite Ebene; Vertriebschannel und weitere Ebenen sind optional und werden nur angezeigt, wenn sie bewusst ergänzt werden. Persönliche Vertriebsnamen sind für die Gebietssteuerung nicht leitend.

Eine fertige Vorlage gibt es in der App unter **Daten → Excel-Vorlage herunterladen**.

### Servicevertrags-Dateien

Serviceverträge werden bewusst als separater Datenbestand importiert. Eine Zeile entspricht einem aktuellen Vertrag; eindeutiger Schlüssel ist `Quellsystem + Vertrags-ID`, die Verknüpfung zum Kunden erfolgt ausschließlich über die exakte `Kundennummer`. Ein Reimport ersetzt nur die in der Datei enthaltenen Vertragsquellen. Andere Quellen, Kunden, Gebiete und Touren bleiben erhalten.

Die geprüfte Excel-Vorlage mit Auswahllisten und Feldbeschreibung sowie ein UTF-8-CSV-Beispiel stehen im Profi-Modus unter **Service → Verträge** bereit. Das vollständige Schema und die Importregeln beschreibt [Serviceverträge in TourFuchs importieren](./docs/servicevertraege-import.md).

#### Flächenzeilen (Gebiete ohne Kunden zuordnen)

Neben Kundenzeilen kann die Liste **Flächenzeilen** enthalten: eine Zeile **ohne Kundenname**, aber mit der Spalte **Gebiet (LK/PLZ)** und einem **Betriebsbezirk**. So lässt sich ein ganzer Landkreis oder ein PLZ-Bereich einem Bezirk zuordnen, auch wenn dort (noch) keine Kunden sind – z. B. um Gebiete für Neukunden zu reservieren. „Gebiet" ist entweder ein **Landkreis-Name** (z. B. `Oberhausen`) oder eine **PLZ / PLZ-Präfix** (`46` = alle 46xxx, `46045` = genau dieses PLZ-Gebiet). Dasselbe geht interaktiv über das **Gebiets-Popup** auf der Karte oder im **Cockpit** (Häkchen „Auch Gebiete ohne Kunden einbeziehen").

#### Plausibilitätsprüfung beim Import

Beim Import werden die Zeilen geprüft. **Gültige Zeilen werden importiert**, problematische landen in einer **herunterladbaren Fehlerliste (Excel)** statt in einer unübersichtlichen Fehleranzeige. Erkannt werden u. a.: Dubletten (gleiche Kundennummer bzw. Name + PLZ), fehlender Betriebsbezirk, widersprüchliche Gebietszuordnungen (ein Gebiet zwei verschiedenen Bezirken zugewiesen), unbekannte Landkreise/PLZ-Gebiete sowie nicht auffindbare Kunden-PLZ (Hinweis).

Eine Datei mit Kundenzeilen gilt als **neuer vollständiger Kundenbestand**. Sind bereits Daten geladen, nennt TourFuchs vor dem Import die Wirkung und verlangt eine Bestätigung. Erst danach werden alte Kunden, Tour und Gebietszuordnungen ersetzt. Reine Kontakt- oder Gebietsdateien bleiben ergänzend, weil sie sich ausdrücklich auf den vorhandenen Kundenbestand beziehen.

### Datenschutz

- Kundendaten werden **lokal im Browser** gespeichert (IndexedDB); der Betreiber erhält sie nicht und es gibt kein Tracking.
- Bei Demo-Kunden werden Telefon, E-Mail, Copilot-Briefing und exakte Adress-Geocodierung nicht extern gestartet. Die sichtbaren Aktionen sind sichere Simulationen; echte importierte Kunden bleiben unverändert nutzbar.
- Im **Basis-Briefing** wird der vorbereitete Prompt zunächst nur lokal angezeigt und in die Zwischenablage kopiert. Eine Übertragung an Microsoft erfolgt erst, wenn der Nutzer ihn selbst in Copilot einfügt und absendet.
- Nur das optionale **Profi-Briefing** kann nach ausdrücklicher Zustimmung Kundenidentität und Tourkontext automatisch an Microsoft 365 Copilot übergeben. Microsoft-Entra-Rechte, Richtlinien und Vertraulichkeitsbezeichnungen der Organisation bleiben wirksam.
- Nur die optionale adressgenaue Verortung sendet die jeweilige Adresse an OpenStreetMap (Nominatim), gedrosselt gemäß deren Nutzungsrichtlinie.
- Optionale Straßenrouten (Routenlinie und Korridor-Vorschläge) senden **nach ausdrücklicher Zustimmung** die Koordinaten von Start und Tour-Stopps an OSRM (`router.project-osrm.org`) – keine Namen oder sonstigen Kundendaten. Ohne Zustimmung rechnet die App mit der Luftlinie, komplett offline.

### Schulungsunterlagen

- [Ausführliches Schulungshandbuch](./docs/schulung-tourfuchs.md)
- [Kurzanleitung für Anwender](./docs/kurzanleitung-tourfuchs.md)
- [Wissensbasis für den Guide-Bot](./docs/guide-ki-wissensbasis.md) – aufgabenorientiert mit dokumentierten Klickpfaden, aktueller Funktionsstand
- [PDF-Fassung der Guide-Wissensbasis](./TourFuchs_KI-Agent_Wissensbasis.pdf) – gut lesbare Referenz für Review, Schulung und Weitergabe
- [Lokaler Test des Copilot-Kundenbriefings](./docs/copilot-briefing.md) – Entra-Konfiguration, Berechtigungen und Testablauf

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

**Günter Struck** · Lönsberg 8 · 45136 Essen · tourfuchs@online.de

**Made with 🦊 in Germany**
