# 🦊 TourFuchs ↔ Google Maps – Produktvergleich

**Stand:** 16.07.2026 · **Rolle:** Product Owner · **Status:** Ideenpapier – nichts davon ist beschlossen oder beauftragt

---

## 1. Ausgangspunkt: Was ist der Unterschied?

Google Maps und TourFuchs beantworten oberflächlich dieselben Fragen: *Was ist in
meiner Nähe? Wie komme ich hin? In welcher Reihenfolge?* Der entscheidende
Unterschied liegt in der Datenbasis:

| | Google Maps | TourFuchs |
|---|---|---|
| **Kennt** | Die ganze Welt: jedes Geschäft, Öffnungszeiten, Fotos, Bewertungen, Verkehr | **Meine Kunden**: Bezirk, Umsatz, Besuchsrhythmus, Ansprechpartner, Historie |
| **Weiß nicht** | Wer mein Kunde ist, wer überfällig ist, wer wie viel Umsatz bringt | Verkehrslage, fremde Geschäfte, Fotos, Bewertungen |
| **Datenhaltung** | Cloud, Konto, Tracking | Lokal im Browser, kein Login, kein Server |
| **Optimiert für** | Jeden Menschen, jeden Anlass | Außendienst (mobil) und Vertriebsleitung (Desktop) |

**Kernthese:** Wir kopieren von Google Maps nicht die *Features*, sondern die
*Muster* – und füllen sie mit dem, was nur TourFuchs hat: den Kundendaten.
Google zeigt Öffnungszeiten und Bewertungen von Restaurants; TourFuchs zeigt
Fälligkeit, Umsatz und Besuchshistorie von Kunden. Gleiche UX-Grammatik,
anderes Wissen. Und überall dort, wo Google unschlagbar ist (Live-Verkehr,
Navigation, Street View), bauen wir nichts nach, sondern **übergeben** – das
tun wir heute schon mit dem Google-Maps-Link.

---

## 2. Von Google Maps übernehmen (übersetzt auf Kundendaten)

Sortiert nach Produktnutzen. Jede Idee nennt das Google-Vorbild und die
TourFuchs-Übersetzung. Leitplanken (lokal-first, keine Automatik, die dem
Nutzer die Planung abnimmt – Produktentscheidung 10.07.2026) sind geprüft.

### A. Der „Ortseintrag" für Kunden – die Kunden-Detailkarte ⭐ Favorit

**Google-Vorbild:** Tippt man in Google Maps auf ein Geschäft, öffnet sich ein
perfekt komponiertes Place Sheet: Name, Kategorie, Öffnungszeiten („schließt
bald"), Foto, und darunter eine feste Aktionszeile – *Route, Anrufen, Speichern,
Teilen, Website*. Alles Wichtige ohne einen weiteren Klick.

**TourFuchs-Übersetzung:** Der Kunden-Popup wird zum **Kunden-Steckbrief** mit
derselben Grammatik:

- Kopf: Name, Bezirk-Farbchip, Fälligkeitsstatus als Ampel („überfällig seit
  3 Wochen" ≙ Googles „schließt bald" – dieselbe psychologische Funktion:
  Dringlichkeit auf einen Blick).
- Kennzahlen-Zeile: Umsatz, letzter Besuch, Rhythmus.
- **Feste Aktionszeile: 📞 Anrufen · ✉️ E-Mail · 🚗 Navigieren · ➕ Zur Tour.**
  Telefon und E-Mail sind bereits importierte Spalten – heute stehen sie nur
  als Text da, statt als `tel:`-/`mailto:`-Aktion einen Fingertipp entfernt zu sein.

Das ist die billigste Stelle, an der sich TourFuchs sofort „wie eine große App"
anfühlt. Alle Daten sind schon da.

### B. Öffnungszeiten – Googles Killerinfo, unsere Lücke

**Google-Vorbild:** Die meistgenutzte Info überhaupt: „Hat der Laden auf, wenn
ich ankomme?" Google warnt sogar: *„Geschäft ist bei Ankunft geschlossen."*

**TourFuchs-Übersetzung:** Öffnungszeiten (oder schlichter: „Besuchsfenster",
z. B. „nicht vor 9 Uhr, Mittagspause 12–14") als **optionale Importspalte** und
Feld am Kunden. TourFuchs rechnet bereits Ankunftszeiten je Stopp (Startzeit +
Besuchsdauer + Fahrzeit für die .ics-Termine) – die Warnung **„⚠️ Ankunft 12:40,
Kunde hat Mittagspause"** im Tour-Panel ist die logische Vollendung. Für den
Außendienst ist das bares Geld: vergebliche Anfahrten sind der teuerste Fehler
des Tages. Komplett offline machbar.

### C. Kategorien-Chips für „In der Nähe"

**Google-Vorbild:** Oben auf der Karte: `Restaurants · Tankstellen · Cafés` –
ein Tipp filtert die Umgebung nach Kategorie.

**TourFuchs-Übersetzung:** Der neue mobile „In der Nähe"-Begleiter (#84) bekommt
Chips mit *unseren* Kategorien: **`Überfällig` · `Fällig` · `Nie besucht` ·
`Top-Umsatz`**. Google filtert nach Weltkategorien, wir nach Vertriebsrelevanz.
Wichtig: Das ist reines Filtern auf Fingertipp, **kein** automatischer
Vorschlag – die Planung bleibt beim Nutzer (Entscheidung vom 10.07. bleibt
unberührt).

### D. Gespeicherte Listen & eigene Labels

**Google-Vorbild:** „Favoriten", „Möchte ich besuchen", eigene Listen mit
Emoji-Label – Nutzer organisieren Orte nach *ihren* Begriffen, unabhängig von
Googles Kategorien.

**TourFuchs-Übersetzung:** Persönliche **Kunden-Listen/Markierungen** neben der
offiziellen Bezirksstruktur: „Neukunden-Kandidaten", „Reklamation offen",
„Messe-Nachfassen". Die Bezirke sind die *Firmen*-Sicht; Listen wären die
*persönliche* Sicht des Außendienstlers – genau die Lücke, die Google mit
Listen neben den offiziellen Kategorien füllt. Lokal gespeichert, exportierbar.

### E. Timeline – „Wo war ich?"

**Google-Vorbild:** Die Zeitachse zeigt, wo man war – rückblickende
Selbstvergewisserung.

**TourFuchs-Übersetzung:** Sobald „Besuch abhaken unterwegs" (Roadmap 2.4)
existiert, entsteht die Datenbasis für eine **Wochen-Rückschau**: gefahrene
Touren, besuchte Kunden, abgedeckte Gebiete auf der Karte. Nutzen doppelt:
Selbstorganisation („wen habe ich diese Woche geschafft?") und
Besuchsbericht-Grundlage. Kein GPS-Tracking nötig – die Quelle sind die
abgehakten Besuche, nicht der Standortverlauf. Das ist die datenschutzfreundliche
Übersetzung der Timeline.

### F. ETA je Stopp sichtbar machen

**Google-Vorbild:** Bei Multi-Stopp-Routen steht an jedem Ziel die Ankunftszeit.

**TourFuchs-Übersetzung:** Die Ankunftszeiten werden bereits für Kalender und
Druck berechnet – sie gehören **auch in die Tour-Liste selbst**: „Stopp 3 ·
Autohaus Schmidt · an ~11:20". Kleiner Schritt, großer
Professionalitäts-Eindruck, Voraussetzung für B (Öffnungszeiten-Warnung).

### G. Ein Suchfeld, das alles versteht

**Google-Vorbild:** Ein einziges Suchfeld für Orte, Adressen, Kategorien,
Koordinaten – niemals „bitte wählen Sie erst den Suchtyp".

**TourFuchs-Status:** Weitgehend erfüllt (Name, Ort, PLZ, Kundennummer).
Ausbaustufe: auch Bezirks- und Gebietsnamen („Bezirk Rheinland", „Landkreis
Oberhausen") über dasselbe Feld findbar machen und hinfliegen. Kein neues UI,
nur ein breiterer Index.

### H. Street View & Foto – per Übergabe, nicht nachgebaut

**Google-Vorbild:** Vor Ort das Gebäude erkennen.

**TourFuchs-Übersetzung:** Kein eigenes Street View! Aber der Kunden-Steckbrief
(A) kann neben „Navigieren" einen zweiten Google-Link anbieten, der die Adresse
direkt in der Google-Ansicht öffnet („Wie sieht's da aus?"). Gleiches Muster
wie die Navigation heute: Google macht, was Google am besten kann – erst bei
bewusster Übergabe.

---

## 3. Bewusst NICHT übernehmen

Genauso wichtig wie die Übernahme-Liste. Diese Google-Features sind für
TourFuchs Gift oder überflüssig:

| Google-Feature | Warum nicht |
|---|---|
| **Live-Verkehr & Echtzeit-ETA** | Braucht permanente Serververbindung + Bewegungsdaten – bricht lokal-first. Die Übergabe an Google Maps löst das Problem bereits vollständig: Grobplanung bei uns, Echtzeit bei Google. Arbeitsteilung statt Nachbau. |
| **Bewertungen & Fotos fremder Orte / POI-Datenbank** | Nicht unser Spielfeld. Fremd-POIs stehen bewusst nur als Opt-in-Vision im Backlog; alles andere verwässert den Fokus „meine Kunden". |
| **Konto, Cloud-Sync, Standort-Teilen** | Das Gegenteil unseres Alleinstellungsmerkmals. Gerätewechsel ist mit QR-Tour-Übergabe und verschlüsseltem Umzug (`.tfsafe`) bereits gelöst – lokal-first-konform. |
| **„Für dich"-Empfehlungen / proaktive Vorschläge** | Googles Personalisierungs-Magie ist genau die Automatik, die unsere Nutzer am 10.07.2026 abgewählt haben (2.1 gestrichen). TourFuchs unterstützt auf Abruf (Filter, Chips, Umkreis), drängt aber nichts auf. |
| **Sprachnavigation, Fahrspur-Hinweise, Offline-Navigation** | Navigation ist delegiert. Jeder Meter eigener Navigations-Code wäre verlorene Zeit. |
| **Werbung / gesponserte Pins** | Erwähnt der Vollständigkeit halber: niemals. Vertrauen ist das Produkt. |

---

## 4. Im heutigen TourFuchs weglassen oder verstecken

Googles größte Leistung ist nicht, was es zeigt, sondern was es *verbirgt*.
Milliarden Datenpunkte, aber die Oberfläche kennt genau: eine Karte, ein
Suchfeld, ein Sheet. Daran gemessen:

1. **Manuelle Ebenen-Wahl (PLZ 1-/2-/3-/5-stellig, Landkreise) aus dem
   Standard-Pfad nehmen.** Google lässt niemanden „Detailgrad" wählen – der Zoom
   entscheidet. Unsere Zoom-Automatik kann der alleinige Standard werden; die
   manuelle Ebenen-Wahl wandert vollständig in den Profi-Modus. (Basis/Profi
   existiert mobil schon – konsequent zu Ende führen, auch am Desktop.)
2. **Vertriebschannel als sichtbare Ebene beerdigen.** Ist bereits „optional,
   nur wenn bewusst ergänzt" – Kandidat für vollständigen Rückbau aus der UI,
   solange kein Nutzer ihn vermisst. Jede Ebene weniger macht die Karte lesbarer.
3. **Kartenstile nicht weiter ausbauen.** Hell/Standard/Satellit deckt alles ab;
   Google kommt mit ähnlich wenig aus. (Steht sinngemäß schon im Backlog-Nein –
   hier bestätigt.)
4. **Ein Zahlenformat, überall.** Google zeigt nie zwei Schreibweisen derselben
   Information. Die Umsatz-Regel aus Release 1 (1.5, `Σ x T€`) ist genau dieses
   Prinzip – konsequent auch auf künftige Anzeigen anwenden, bevor Wildwuchs
   entsteht.
5. **Desktop-only bleibt Desktop-only.** Simulation und Gebiets-Editor gehören
   nicht aufs Handy – so wie Google My Maps nie in die mobile Maps-App gewandert
   ist. Der mobile Fokus (Karte + Tour) ist richtig und bleibt.

Keine dieser Streichungen kostet einen der beiden North-Star-Momente – sie
schärfen ihn.

---

## 5. Fazit & Empfehlung

Google Maps' Wow-Effekte beruhen auf drei Mustern, die wir übernehmen können,
ohne unser Alleinstellungsmerkmal zu opfern:

1. **Alles Wichtige eine Fingerspitze entfernt** → Kunden-Steckbrief mit
   Aktionszeile (A) + ETA je Stopp (F).
2. **Zeitliches Wissen als Dringlichkeit** („schließt bald") → Fälligkeits-Ampel
   und Öffnungszeiten-Warnung (B) – die Vertriebsvariante davon.
3. **Filtern auf Fingertipp statt Formulare** → Nähe-Chips (C) und die
   Ein-Feld-Suche (G).

**Meine Empfehlung als Reihenfolge, wenn daraus je Aufträge werden:**
zuerst **A (Kunden-Steckbrief)** – maximaler gefühlter Sprung, null neue Daten;
dann **F + B (ETA & Öffnungszeiten)** – zahlt direkt auf Moment A („07:30 Uhr")
ein; dann **C (Chips)**. D, E und G sind starke Kandidaten fürs Backlog,
Abschnitt 4 läuft als Vereinfachungs-Hygiene nebenher.

Und die Umkehrung gilt weiter: Was Google in Echtzeit kann, kaufen wir per
Übergabe ein statt es nachzubauen. TourFuchs gewinnt nicht, indem es ein
kleineres Google Maps wird – sondern indem es das Google Maps für die eigenen
Kunden**daten** ist.

---

*Dieses Papier ist ein Denk- und Diskussionsstand des Product Owners. Es
beauftragt keine Umsetzung; Priorisierung erfolgt ausschließlich über die
Roadmap ([roadmap-2026-H2.md](./roadmap-2026-H2.md)).*
