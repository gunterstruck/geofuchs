# TourFuchs Vertrieb - Wissensbasis für den KI-Guide

**Version 2.2 · Stand: 17.07.2026 · App-Version: 3.0.0**

**Zweck:** Verbindliche Produkt-, Bedien-, Schulungs- und Supportgrundlage für
einen angepassten TourFuchs-Guide. Die Markdown-Datei ist die primäre
Wissensquelle für KI-Systeme. Die PDF-Fassung dient der menschlichen Prüfung und
Weitergabe.

**Quellenpriorität:** aktueller App-Code und sichtbare Beschriftungen vor älteren
Screenshots, Präsentationen oder Schulungsunterlagen. Bei einem Widerspruch gilt
dieses Dokument nur für den oben genannten Stand.

**Klickpfad-Konvention:** `Modus -> Tab -> Bereich -> Aktion`. Sichtbare
Beschriftungen stehen in Anführungszeichen. Beispiel:
`"Gebietsplanung" -> Tab "Gebiete" -> "Gebiets-Cockpit öffnen"`.

**Begriffsregel:** Die aktuelle App verwendet sichtbar **Vertriebsbezirk**. Der
Import akzeptiert **Betriebsbezirk** als Synonym. Der Guide soll in Antworten den
aktuellen UI-Begriff **Vertriebsbezirk** verwenden und den alten Begriff nur bei
der Einordnung fremder Dateien erwähnen.

---

## Das große Bild in 30 Sekunden

**Was ist TourFuchs Vertrieb?** Eine **einzige installierbare Web-App (PWA)**,
die Kundenlisten aus Excel auf die Deutschlandkarte bringt: Vertriebsgebiete
sehen und planen, Besuche und Touren organisieren, Serviceverträge und
Einsätze im Blick behalten. Alle Daten bleiben **lokal im Browser des
jeweiligen Geräts** - es gibt keinen Server und kein Benutzerkonto.

**Es gibt keine zwei Anwendungen.** Dieselbe App läuft auf Desktop und
Smartphone; sie zeigt je nach Bildschirmgröße unterschiedlich viel. Die
Arbeitsteilung ist eine bewusste Rollenverteilung, keine Technikgrenze:

| Am Desktop (planen) | Am Smartphone (durchführen) |
|---|---|
| Excel-Listen importieren und pflegen | Kundenkarte und Suche unterwegs |
| Gebiete schneiden, Cockpit, Simulation | Kunden in der Nähe finden |
| Touren zusammenstellen und optimieren | Tour abfahren, in Google Maps navigieren |
| Service-Vorplanung und Vertragsradar | Besuche abhaken, Kundenbriefing |
| Tour als QR-Code anzeigen | Tour mit der Kamera übernehmen |

**Wichtig - keine Synchronisation:** Desktop und Smartphone gleichen sich
nicht automatisch ab. Die Übergabe zwischen Geräten geschieht bewusst ohne
Cloud: die **geplante Tour per QR-Code** (Bildschirm zu Kamera) und der
**komplette Datenbestand verschlüsselt per `.tfsafe`-Datei** mit getrennt
reisendem Schlüssel-QR. Spricht ein Nutzer von "Synchronisation", stellt der
Guide dieses Modell richtig.

---

## Inhaltsübersicht

1. Auftrag und Antwortverhalten des Guides
2. Produktkonzept und Product-Owner-Highlights
3. Zielgruppen, Geräte und Funktionsmatrix
4. Oberfläche und Panel-Bedienung
5. Onboarding beim ersten Start
6. Live-Demos
7. Daten laden, importieren und aktualisieren
8. Karte, Suche und Kunden-Popup
9. Kundenbriefing mit Microsoft 365 Copilot
10. Tourplanung im Außendienst
11. Tour vom Desktop aufs Smartphone übergeben
12. Mobile Bedienung
13. Gebietsplanung, Cockpit und Simulation
14. Datentresor und sicherer Geräteumzug
15. PWA-Installation und Updates
16. Datenschutz und Datenflüsse
17. Klickpfad-Bibliothek
18. Diagnosebäume und Fehlerbilder
19. Häufige Fragen mit Musterantworten
20. Mini-Schulungen
21. Geführte Dialoge für den Guide
22. Agentenregeln und Wissensgrenzen
23. Empfohlener Systemprompt
24. Prüfungsfragen mit Soll-Antworten
25. Glossar
26. Pflege und Änderungsprotokoll
27. Schnellreferenz

---

## 1. Auftrag und Antwortverhalten des Guides

Der TourFuchs-Guide hilft Anwenderinnen und Anwendern, TourFuchs zu verstehen,
sicher zu bedienen und den nächsten sinnvollen Schritt zu finden. Er ist kein
allgemeiner Vertriebsberater und kein Ersatz für CRM-, Datenschutz-, Rechts- oder
IT-Sicherheitsberatung.

Der Guide soll:

- Nutzen und Bedienkonzept verständlich erklären.
- sichtbare Bedienelemente mit ihren aktuellen Namen nennen.
- kurze, eindeutige Klickpfade ausgeben.
- Desktop und Smartphone sowie Basis und Profi unterscheiden.
- Screenshots anhand tatsächlich sichtbarer Elemente einordnen.
- typische Bedienfehler systematisch diagnostizieren.
- lokale Verarbeitung und bewusst ausgelöste externe Datenflüsse trennen.
- vor dauerhaften oder löschenden Aktionen warnen.
- beim Kundenbriefing den manuellen Basisweg und den optionalen Profiweg korrekt
  auseinanderhalten.
- bei Bedarf eine kurze, rollenbezogene Mini-Schulung anbieten.

Der Guide soll nicht:

- behaupten, reale Kundendaten oder den aktuellen Bildschirm zu sehen, wenn diese
  Informationen nicht bereitgestellt wurden.
- erfundene Funktionen, Menüpunkte, Kundeninformationen oder Fahrzeiten nennen.
- behaupten, TourFuchs synchronisiere Daten automatisch zwischen Geräten.
- eine Live-Demo mit einem Video verwechseln; sie bedient die echte App.
- eine Simulation als bereits gespeicherte Änderung darstellen.
- eine Straßenroute oder Microsoft-Copilot-Antwort als garantiert verfügbar
  darstellen.
- Nutzende zum Löschen anleiten, ohne vorher einen Export zu empfehlen.
- für eine Diagnose komplette sensible Kundendatensätze im Chat anfordern.

### 1.1 Empfohlenes Antwortformat

1. Direkte Antwort in ein bis zwei Sätzen.
2. `Klickpfad:` mit den sichtbaren Beschriftungen.
3. `Ergebnis:` Was danach auf dem Bildschirm zu sehen ist.
4. Nur wenn relevant: `Wichtig:` Voraussetzung, Speicherwirkung oder
   Datenschutzfolge.

Beispiel:

> Das spontane Kundenbriefing ist bereits im Basis-Modus verfügbar.
>
> **Klickpfad:** Kundenmarker -> "Briefing" -> "Prompt kopieren & Copilot
> öffnen".
>
> **Ergebnis:** TourFuchs kopiert den vorbereiteten Prompt und öffnet Microsoft
> 365 Copilot. Der Nutzer fügt ihn dort ein und sendet ihn selbst ab.
>
> **Wichtig:** Erst beim Absenden in Copilot werden die im Prompt sichtbaren Daten
> an Microsoft übergeben.

### 1.2 Sinnvolle Rückfragen

Nur fragen, wenn die Antwort davon abhängt:

- Desktop/Laptop oder Smartphone?
- Basis oder Profi?
- Außendienst oder Gebietsplanung?
- Demo-Daten oder eigene Daten?
- Nur prüfen oder dauerhaft übernehmen?
- Luftlinie oder Straßenroute?
- Manuelles Briefing oder direkte Entra-Verbindung?

Nicht rückfragen, wenn ein Screenshot oder die Nutzerbeschreibung den Kontext
eindeutig zeigt.

---

## 2. Produktkonzept und Product-Owner-Highlights

### 2.1 Produkt in einem Satz

TourFuchs macht eigene Kunden- und Vertriebsdaten räumlich und unmittelbar
handlungsfähig: Kundenkarte, Gebietsplanung, Tour und aktuelles internes
Microsoft-365-Wissen kommen in einer installierbaren, lokal-first PWA zusammen.

### 2.2 Die zwei Kernfragen

1. **"Welcher Vertriebsbezirk betreut welche Kunden?"**
   Eine Excel-/CSV-Liste wird zur Kunden- und Gebietskarte mit Filtern, Kennzahlen
   und sicherer Was-wäre-wenn-Simulation.
2. **"Wen besuche ich als Nächstes und was muss ich vorher wissen?"**
   TourFuchs findet passende Kunden, baut eine Besuchstour und bereitet aus
   berechtigtem Microsoft-365-Wissen ein kompaktes Kundenbriefing vor.

### 2.3 Die wichtigsten Wow-Effekte

**1. Spontaner Termin, sofort gebrieft**

Der Nutzer steht unterwegs vor einer freien Stunde, findet einen passenden Kunden
auf der Karte und tippt im Kunden-Popup auf **"Briefing"**. TourFuchs verbindet die
lokale Kundenidentität und den Tourkontext mit dem aktuellen internen Wissen aus
E-Mails, Outlook, Teams, Besprechungen, Transkripten und Dateien. Das Ergebnis ist
eine kompakte Gesprächsvorbereitung statt einer langen manuellen Recherche.

**2. Aus der eigenen Liste wird eine Vertriebslandkarte**

Die Stärke gegenüber einer allgemeinen Kartenanwendung ist die Verknüpfung aus
eigenen geschützten Kundendaten, Ort, Zuständigkeit, Umsatz, Besuchsstatus und
Tourentscheidung.

**3. Tour vom Desktop aufs Smartphone, Bildschirm zu Kamera**

Eine vorbereitete Tour wird als QR-Code gezeigt und am Smartphone übernommen.
Die Kundendatenbank wird dabei nicht übertragen.

**4. Gebiete umbauen, ohne reale Daten sofort zu verändern**

Landkreise oder PLZ-Gebiete lassen sich simuliert verschieben. Kunden- und
Umsatzwirkung werden sichtbar, bevor **"Zuweisung übernehmen"** dauerhaft schreibt.

**5. Lokale Daten mit Tresor und sicherem Umzug**

Kundendaten können im Browser AES-256-verschlüsselt werden. Für den
Gerätewechsel reisen verschlüsselte Datei und Schlüssel getrennt.

**6. Geführtes Onboarding statt Funktionswand**

Ein ruhiger Begrüßungszustand, eine verzögerte Demo-Auswahl und kurze
Live-Geschichten zeigen den Nutzen, bevor technische Details erscheinen.

### 2.4 Bewusste Produktgrenzen

TourFuchs:

- ist kein zentrales CRM und besitzt kein allgemeines TourFuchs-Nutzerkonto.
- synchronisiert Kundendaten nicht automatisch zwischen Geräten.
- baut keine komplette Tour ungefragt; der Nutzer wählt Start, Kunden und Ziel.
- liefert Vorschläge und optimiert die gewählte Reihenfolge, aber keine
  verbindliche Verkehrs- oder Fahrzeitprognose.
- ist keine allgemeine Ortssuche. Die Topbar findet Kunden, deren Datensatz zum
  eingegebenen Ort passt.
- besitzt aktuell kein eigenes KI-Importschema für Priorität, Besuchsgrund oder
  Empfehlung. Solche Dateien müssen weiterhin auf das Kunden-Importschema
  abgebildet werden.
- ersetzt keine organisatorische Freigabe für Microsoft 365 Copilot oder
  Microsoft Graph.

---

## 3. Zielgruppen, Geräte und Funktionsmatrix

### 3.1 Typische Rollen

| Rolle | Primäres Gerät | Typische Aufgaben |
|---|---|---|
| Außendienst | Smartphone, Tablet, Laptop | Kunden finden, Tour planen, Besuch abhaken, Briefing, Navigation |
| Vertriebsleitung | Desktop/Laptop | Bezirke vergleichen, Cockpit, Simulation, Export |
| Datenverantwortliche | Desktop/Laptop | Import, Spaltenzuordnung, Vollersatz, Kontakte, Fehlerliste, Tresor |
| Trainer/Guide | Desktop plus Mobile-Vorschau | Live-Demos, Klickpfade, Mini-Schulungen |

### 3.2 Desktop gegen Smartphone

| Funktion | Desktop/Laptop | Smartphone |
|---|---:|---:|
| Daten importieren und exportieren | Ja | Ja, bei Bedarf |
| Kundenkarte und Suche | Ja | Ja |
| Kundenbriefing | Ja | Ja |
| Tour planen und navigieren | Ja | Ja |
| Tour per QR an Smartphone senden | Ja | Nein, bewusst ausgeblendet |
| Tour vom Desktop scannen | Ja | Ja, mobil besonders sinnvoll |
| Gebietsplanung/Cockpit/Simulation | Ja | Nein, bewusst Desktop-fokussiert |
| Mobile Außendienst & Tour als Vorschau | Ja, mit einmaligem ruhigem Hinweis | Nein |
| Verschlüsselte Daten empfangen | Ja | Ja, mobil besonders sinnvoll |

**Tablets:** Es gibt bewusst keine eigene Tablet-Ansicht und keine
Tablet-Vorschau am Desktop. Tablets nutzen die vorhandenen responsiven
Layouts: Ab etwa 800 Pixel Fensterbreite (praktisch alle Tablets, hochkant wie
quer) erscheint das **vollständige Desktop-Layout** inklusive Gebietsplanung
und Service-Fokus; nur sehr schmale Ansichten (768 Pixel und weniger, z. B.
Smartphones oder geteilte Bildschirme) verhalten sich wie das Smartphone mit
Karte, Tour und Bottom Sheet.

### 3.3 Basis gegen Profi

**"Basis"** ist der ruhige Standard. Es zeigt die Kernaufgaben ohne technische
Feinsteuerung.

**"Profi"** blendet zusätzlich Analyse-, Ziel-, Export- und
Automatisierungswerkzeuge ein.

| Bereich | Basis | Profi zusätzlich |
|---|---|---|
| Kunden-Popup | Name, Adresse, Ort, Umsatz, Kontakt, "Heute besucht", "Als Start", "Zur Tour", "Briefing" | Kundennummer, Hierarchie, Besuchsstatus/Rhythmus, "Als Ziel" |
| Tour | Bezirk, Start, Datum/Zeit/Dauer, Umkreis, Vorschläge, Optimierung, Kartenroute, Google Maps, QR/Scan | Kartenansicht Kunden/Status/Chancen, Ziel, Entlang der Tour, Rundreise, Druck, ICS, Text, gespeicherte Touren |
| Gebiets-Popup | Kennzahlen und Verteilung | zusätzliche namentliche Kundenliste |
| Kundenbriefing | transparenter manueller Copilot-Weg | einfacher Weg bleibt oben; optional darunter direkte Entra-/Graph-Verbindung |

Wichtig: **"Briefing" ist in beiden Ansichtstiefen sichtbar.** Eine vorhandene
Profi-Konfiguration verändert den Basisweg nicht.

Live-Demos schalten bei Bedarf vorübergehend auf Profi und stellen die vorherige
Ansicht danach wieder her.

---

## 4. Oberfläche und Panel-Bedienung

### 4.1 Topbar

Die Topbar enthält:

- **"Menü umschalten"** (`☰`)
- Marke **TourFuchs Vertrieb**
- Suchfeld **"Kunde, Ort, PLZ suchen..."**
- **"Mobile Außendienst & Tour"** (`Smartphone-Symbol`, nur Desktop)
- dynamisches Tresor-Symbol: einrichten, sperren oder Status anzeigen
- **"Info & Impressum"** (`i`)

### 4.2 Zwei globale Schalter im Desktop-Panel

1. **"Basis" / "Profi"** steuert die Ansichtstiefe.
2. **"Außendienst" / "Gebietsplanung" / "Service"** steuert den Arbeitsfokus.
   Der Fokus **"Service"** erscheint nur in der Ansichtstiefe **"Profi"**.

Tabs im Außendienst: **"Daten"**, **"Filter"**, **"Tour"**.

Tabs in der Gebietsplanung: **"Daten"**, **"Filter"**, **"Gebiete"**.

Tabs im Service-Fokus: **"Einsätze"**, **"Verträge"**, **"Tour"**.

Wenn eine Funktion fehlt, prüft der Guide zuerst Ansichtstiefe, Fokus und Tab.

### 4.3 Desktop-Panel scrollen und verschieben

Der Inhalt des aktiven Tabs kann auf drei gleichwertige Arten vertikal bewegt
werden:

1. Mausrad über dem Panel.
2. sichtbare Bildlaufleiste am rechten Panelrand.
3. linke Maustaste auf einer funktionslosen Freifläche halten und den Inhalt mit
   der Hand nach oben oder unten ziehen.

Über Buttons, Eingaben, Links, Auswahllisten und inneren Scrolllisten bleibt deren
eigene Funktion aktiv; dort startet kein Flächenziehen. Auf ziehbaren Freiflächen
zeigt der Cursor eine Hand. Text wird dabei nicht versehentlich markiert.

**Wichtig:** Das Mausrad ändert im Panel nicht die Inhaltsgröße. Die Größe
wird ausschließlich mit **Plus/Minus** unten rechts eingestellt.

### 4.4 Panelgröße und Position

- **Plus/Minus unten rechts am Desktop:** gesamter Panelinhalt von 80 % bis
  150 % in 10-Prozent-Schritten. Mobil ist diese zusätzliche Steuerung
  ausgeblendet.
- **Doppelklick auf die Prozentanzeige:** zurück auf 100 %.
- **rechter Panelrand:** Panelbreite am Desktop zwischen etwa 340 und 400 Pixeln
  ziehen.
- **oberer grauer Griff, senkrecht ziehen:** Panelhöhe ändern.
- **oberer Griff, am Desktop waagerecht ziehen:** Panel frei verschieben.
- nahe an den linken Rand ziehen: wieder andocken.
- **Doppelklick auf den Griff am Desktop:** Position zurücksetzen.
- kurzer Klick auf den Griff am Desktop: zwischen angepasster und voller Höhe
  wechseln.

### 4.5 Karte bedienen

- Mausrad über der Karte zoomt die Karte weich in Viertelstufen.
- Am Desktop zoomt Plus/Minus unten rechts auf der Karte ebenfalls.
- Mobil sind diese redundanten Kartentasten ausgeblendet; dort mit zwei Fingern
  stufenlos zoomen.
- Ziehen auf der freien Karte verschiebt den Kartenausschnitt.
- Viele Kunden werden als Clusterzahl zusammengefasst; Klick auf einen Cluster
  zoomt hinein.
- Kunden- und Gebietspopups können auf Freiflächen gezogen werden, um die Karte
  darunter zu schwenken. Interaktive Elemente im Popup bleiben bedienbar.

---

## 5. Onboarding beim ersten Start

### 5.1 Ruhiger Einstieg ohne Daten

Beim ersten Start oder nach dem Löschen aller Daten zeigt die Sidebar zunächst:

- **"Willkommen bei TourFuchs!"**
- **"Schön, dass du da bist."**
- **"App in 60 Sekunden erleben"**
- **"Eigene Daten laden"**
- **"Lieber zuschauen? Geführte Vorführung starten"** (dezenter Link darunter)

Die beiden großen Aktionen sind bewusst gleichwertig:

1. Demo-Daten nutzen und den Wert der App erleben.
2. Direkt mit einer eigenen Datei beginnen.

Der dritte, dezente Link öffnet die Live-Demo-Auswahl für alle, die sich die App
erst einmal vorführen lassen möchten. Technische Unteroptionen erscheinen erst
nach **"Eigene Daten laden"**.

Auf dem Smartphone wird das leere Panel nach etwa 2,5 Sekunden eingeblendet, falls
es noch geschlossen ist. Auf dem Desktop ist der Begrüßungszustand direkt in der
Sidebar sichtbar. Das ist die einzige automatische Bewegung beim Start: **Die
Live-Demo-Auswahl öffnet sich nicht mehr von selbst**, sondern ausschließlich auf
Klick (Willkommens-Panel oder Info-Dialog).

### 5.2 Live-Demo-Auswahl nur auf Klick

Die Demo-Auswahl öffnet ausschließlich über zwei bewusste Einstiege:

1. `Willkommens-Panel -> "Lieber zuschauen? Geführte Vorführung starten"`
2. `"Info & Impressum" -> "Funktionen entdecken (Live-Demos)"`

Ein früherer 5-Sekunden-Automatismus und das Kontrollkästchen **"Nicht mehr
automatisch zeigen"** wurden bewusst entfernt, damit in den ersten Sekunden
keine konkurrierenden Dialoge erscheinen. **"Später"** schließt die Auswahl;
bereits angesehene Demos bleiben mit einem Haken markiert.

### 5.3 Verhalten nach "Daten löschen"

Das Löschen setzt den Demo-Fortschritt (gesehene Demos, Import-Markierung)
und die **"Erste Schritte"-Checkliste** vollständig zurück - inklusive einer
früheren Abwahl über "Nicht mehr zeigen". Nach dem nächsten Datenbestand
beginnt die Checkliste also wieder von vorn. Es öffnet sich nach dem Löschen
kein automatischer Dialog; die Demos bleiben über Willkommens-Panel und Info
erreichbar.

### 5.4 Demos später manuell öffnen

**Klickpfad:** `"Info & Impressum" -> "Funktionen entdecken (Live-Demos)"`.

### 5.5 "Erste Schritte"-Checkliste

Nach dem ersten Datenbestand (Demo oder eigene Liste) erscheint oben in der
Sidebar die Karte **"Erste Schritte"** mit vier Punkten:

1. **Kunden auf der Karte sehen** (durch das Laden bereits erledigt)
2. **Erste Tour planen**
3. **Tour aufs Handy holen** (QR-Übergabe)
4. **Eigene Excel-Liste laden** (hakt sich nur bei Nicht-Demo-Daten ab)

Der Fortschritt wird ausschließlich lokal gespeichert und bleibt dauerhaft
abgehakt, auch wenn z. B. die Tour später wieder geleert wird.

Die Karte kennt **drei Zustände**:

- **Ausgeklappt:** volle Karte, gehört der Kennenlernphase.
- **Eingeklappt:** schmale Fortschrittszeile **"🦊 Erste Schritte 2/4 ▸"**;
  Klick klappt wieder auf. Die Karte klappt **von selbst** ein, sobald der
  Nutzer erkennbar arbeitet (ein weiterer Schritt über das Datenladen hinaus ist
  erledigt oder die Tour hat Stopps); ein frisch abgehakter Schritt bleibt zuvor
  etwa 4 Sekunden als Feedback sichtbar. Auf dem Smartphone startet die Karte
  direkt eingeklappt. **"Später"** klappt manuell ein.
- **Abgewählt:** nur über den ausdrücklichen Link **"Nicht mehr zeigen"**.
  Die Abwahl ist jederzeit umkehrbar:
  `"Info & Impressum" -> "Erste Schritte anzeigen"`.

Sind alle vier Punkte erledigt, verabschiedet sich die Karte mit einer kurzen
Erfolgsmeldung und erscheint nicht erneut. Ein bewusstes **"Daten löschen"**
setzt Fortschritt und Abwahl zurück; mit dem nächsten Datenbestand startet die
Checkliste wieder von vorn.

---

## 6. Live-Demos

### 6.1 Was eine Live-Demo ist

Eine Live-Demo ist kein Video. Ein sichtbarer Vorführ-Cursor bedient die echte
App und zeigt echte Reaktionen. Währen der Vorführung fängt ein Schutz-Overlay
versehentliche Nutzereingaben ab.

Die Vorführung:

- bereitet einen reproduzierbaren Zustand vor.
- passt Panel und Kartenausschnitt an den gezeigten Schritt an.
- sichert veränderte Tour-, Ansichts- oder Tresorzustände.
- stellt den vorherigen Zustand danach wieder her.
- kann mit **"Beenden"** oder `Esc` abgebrochen werden.
- zeigt danach einen ruhigen Abschlussdialog.
- fragt aktiv, ob die nächste ungesehene Demo gestartet werden soll.
- bietet bei einem Fehler **"Erneut versuchen"** und **"Demo-Auswahl"** an.

### 6.2 Verfügbare Geschichten

| Live-Demo | Desktop | Smartphone | Kernaussage |
|---|---:|---:|---|
| **"Aus Excel wird eine Landkarte"** | Ja | Ja | Demo-Liste laden, Kunden deutschlandweit sehen, Kunden öffnen |
| **"Deine Tour in 30 Sekunden"** | Ja | Ja | ins Ruhrgebiet zoomen, Start und Kunden wählen, optimieren, Luftlinie und Straßenroute |
| **"Aufs Handy - ohne Kabel, ohne Cloud"** | Ja | Nein | Desktop-Tour per QR ans Smartphone übergeben |
| **"Was wäre wenn? Gebiete umbauen - ohne Risiko"** | Ja | Nein | Simulation ohne dauerhafte Änderung |
| **"Dein Service-Tag in 20 Sekunden"** | Ja | Nein | Service-Fokus öffnen und einen erklärbaren Tagesvorschlag erleben |
| **"Spontaner Termin? Sofort gebrieft"** | Ja | Ja | passenden Kunden finden und eine sichere Briefing-Ergebnisvorschau erleben |
| **"Deine Daten im Tresor"** | Ja | Ja | PIN setzen und sichtbaren Wiederherstellungscode erklären |
| **"Verschlüsselte Daten aufs Handy holen"** | Nein | Ja | `.tfsafe`-Datei wählen und getrennten Schlüssel scannen |

### 6.3 Besondere Regeln der Tour-Demo

- Die Demo zoomt zuerst in den Raum Oberhausen/Essen/West-Dortmund, damit Kunden
  und Route erkennbar bleiben.
- Sie zeigt zuerst die Luftlinie und danach die Straßenroute.
- Nur am Desktop folgt der QR-Schritt.
- Auf dem Smartphone wird **kein** QR-Code zum Teilen an dasselbe Smartphone
  gezeigt; diese Funktion ist dort bewusst ausgeblendet.

### 6.4 Besondere Regeln der Briefing-Demo

Die Geschichte **"Spontaner Termin? Sofort gebrieft"** führt von den Chancen zum
Kunden und öffnet eine realistische Ergebnisvorschau. Weil die Geschichte mit
erfundenen Kunden läuft, erzeugt TourFuchs dabei bewusst keinen externen Prompt,
öffnet keinen Copilot und startet keine Suche. Die Demo erklärt, dass bei echten
Kundendaten weiterhin der direkt nutzbare manuelle Weg beziehungsweise optional
die Entra-Automatisierung bereitsteht.

### 6.5 Besondere Regeln der Tresor-Demo

Die Demo gibt eine Beispiel-PIN ein und zeigt danach sichtbar einen
Wiederherstellungscode. Ein bereits vorhandener echter Tresor wird nicht
überschrieben. Nach der Demo wird ein nur für die Demo erzeugter Tresor wieder
entfernt.

---

## 7. Daten laden, importieren und aktualisieren

### 7.1 Eigene Daten laden

**Klickpfad:** `"Daten" -> "Eigene Daten laden"`.

Danach wählt der Nutzer zwischen:

1. **"Excel- oder CSV-Liste"** -> Berechtigung bestätigen ->
   **"Excel-/CSV-Datei auswählen"**.
2. **"Verschlüsselte TourFuchs-Datei"** ->
   **"Verschlüsselte Datei öffnen"**.

Die zweite Option ist nur für eine `.tfsafe`-Datei aus dem sicheren
Geräteumzug. Danach wird der getrennte Schlüssel-QR benötigt.

### 7.2 Demo-Daten

**Klickpfad:** `"Daten" -> "App in 60 Sekunden erleben"`.

Die Demo erzeugt 2.250 fiktive Kunden in 15 Vertriebsbezirken und drei
Vertriebsgruppen. Ortsnamen sind lokal aus der PLZ-Tabelle ergänzt. Demo-Daten
sind unverbindlich, lokal und jederzeit löschbar. Sie werden nicht automatisch
in einen aktiven Tresor übernommen.

Demo-Kunden sind technisch mit der Herkunft `tourfuchs-demo` markiert. Diese
Markierung bleibt beim lokalen Speichern, beim verschlüsselten Geräteumzug und
bei der QR-Tourübergabe erhalten. Ältere gespeicherte Demo-Datensätze werden beim
nächsten Laden automatisch migriert.

Sicherheitsregeln für Beispielkunden:

- Firmen heißen eindeutig `TourFuchs Demo · ...`; zufällige reale Firmennamen
  oder Personennamen werden nicht verwendet.
- E-Mail-Adressen verwenden ausschließlich die reservierte Domain `example.com`.
- Angezeigte Telefonnummern stammen aus den von der Bundesnetzagentur für
  Medienproduktionen bereitgestellten Drama-Rufnummernblöcken.
- Es gibt keine erfundene Straßenadresse. Die Position wird aus der lokal
  gebündelten PLZ-Tabelle berechnet; die externe Adress-Geocodierung ist gesperrt.
- **"Anrufen"** und **"E-Mail"** bleiben als erlernbare Aktionen sichtbar,
  werden aber nur simuliert. Dialer und Mailprogramm öffnen sich nicht.
- **"Briefing"** zeigt eine lokale Ergebnisvorschau. Copilot wird für
  Beispielkunden weder geöffnet noch automatisch angesprochen.
- Excel-, Text-, Druck- und Kalenderexporte werden mit
  `DEMO - NICHT PRODUKTIV` gekennzeichnet.

### 7.3 Unterstützte Dateiformate

- `.xlsx`
- `.xls`
- `.csv`
- `.ods`

CSV wird mit üblichen Trennzeichen und Zeichensätzen verarbeitet, darunter
Semikolon, Komma, Tab, UTF-8 und Windows-1252.

### 7.4 Importfelder

| Feld | Pflicht | Zweck |
|---|---:|---|
| Kundenname | Ja für Kundenzeilen | sichtbarer Kundenname |
| PLZ oder Lat/Lng | Ja für Kartenposition | lokale PLZ-Verortung oder vorhandene Koordinaten |
| Vertriebsbezirk | empfohlen, keine Pflicht | führende operative Ebene |
| Kundennummer | dringend empfohlen | eindeutiger Kontakt- und QR-Schlüssel |
| Straße & Hausnummer | optional | Adresse, Navigation, exakte Verortung |
| Ort | optional, sehr empfohlen | Anzeige im Popup und Stadtsuche |
| Vertriebsbeauftragter | optional | zusätzliche Personenzuordnung |
| Vertriebschannel | optional | zusätzliche Hierarchieebene |
| Vertriebsgruppe | optional, empfohlen | Vergleichsrahmen im Cockpit |
| Hauptansprechpartner | optional | sichtbarer leitender Kontakt |
| Telefon, E-Mail | optional | direkte Kontaktaktionen |
| Umsatz | optional | Priorisierung und Gebietskennzahlen |
| Besuchsrhythmus, Letzter Besuch | optional | Status ok/bald fällig/überfällig |
| Gebiet (LK/PLZ) | nur Flächenzeilen | Gebiet ohne Kunden zuordnen |

Spaltensynonyme werden automatisch erkannt. Beispiele: `Firma`, `Stadt`,
`Betriebsbezirk`, `Kundenkreis`, `Betreuer`, `Jahresumsatz`.

**Import ohne Vertriebsbezirk:** Eine einfache Liste (nur Kundenname + PLZ)
wird vollständig importiert. Kunden ohne Bezirk erscheinen unter
**"Ohne Zuordnung"**; das Importergebnis weist mit einem Hinweis darauf hin.
Bezirke können jederzeit per erneutem Import ergänzt werden. Ohne aktive
Bezirks-Ebene plant die Tour automatisch über **"Alle Bezirke"**. Nur
Flächenzeilen (Gebietszuordnung ohne Kunde) verlangen weiterhin einen Bezirk.

### 7.5 Import-Schrittfolge

1. **"Eigene Daten laden"** öffnen.
2. Im Bereich **"Excel- oder CSV-Liste"** bestätigen:
   **"Ich bin berechtigt, diese Daten zu verarbeiten und in TourFuchs lokal zu
   verwenden."**
3. **"Excel-/CSV-Datei auswählen"** oder Datei per Drag & Drop auf die Karte
   ziehen.
4. Im Dialog **"Spalten zuordnen"** automatische Zuordnung und Beispielwerte
   prüfen.
5. **"Importieren"**. Ist bereits ein Kundenbestand geladen, Wirkung und Anzahl
   in der Ersetzungswarnung prüfen und erst dann bestätigen.
6. Erfolgsmeldung beziehungsweise Dialog **"Import abgeschlossen"** prüfen.
7. Bei Problemen **"Fehlerliste (.xlsx)"** herunterladen.
8. Nach eigenen Kundendaten dem geführten Tresor-Angebot folgen.

**Merksatz:** Automatisch erkannt bedeutet nicht automatisch geprüft.

### 7.6 Erneuter Import und vollständige Ersetzung

Eine Excel-/CSV-Datei mit Kundenzeilen ist eine **neue vollständige Kundenbasis**,
kein Delta und kein Upsert. TourFuchs liest und prüft die Datei zuerst. Sind
bereits Daten vorhanden, erscheint vor jeder Änderung eine Warnung mit bisheriger
und neuer Kundenanzahl.

Nach Bestätigung werden gemeinsam ersetzt:

- bisherige Kunden und ihre lokal ergänzten Besuchs-/Kontaktdaten
- aktuelle Tour, Start, Ziel und Stopps
- bisherige Gebietszuordnungen; Flächenzeilen der neuen Datei werden anschließend
  neu aufgebaut

Abbrechen lässt den gesamten Altbestand unverändert. Vor einem Vollimport bei
Bedarf **"Als Excel exportieren"**, weil nicht in der neuen Datei enthaltene
Informationen danach nur aus einer Sicherung wiederherstellbar sind.

Zwei Spezialfälle bleiben bewusst ergänzend:

- eine reine Kontaktdatei verknüpft Kontakte über die Kundennummer
- eine reine Gebietsdatei ergänzt Gebietszuordnungen

Auch Beispieldaten und eine empfangene `.tfsafe`-Datei sind vollständige
Datensätze. Sie ersetzen vorhandene Daten ebenfalls erst nach Bestätigung.

### 7.7 Getrennte Kontaktdatei

Stammdaten und Kontakte können getrennt importiert werden. Eine reine
Kontaktdatei braucht:

- Kundennummer
- mindestens Ansprechpartner, Telefon oder E-Mail

Kontakte werden ausschließlich über die Kundennummer mit vorhandenen Kunden
verknüpft. Ein Feld **"Primärkontakt?"** kann den Hauptansprechpartner markieren.
Ohne Treffer erscheint die Zeile in der Fehlerliste.

### 7.8 Flächenzeilen

Eine Zeile ohne Kundenname, aber mit **"Gebiet (LK/PLZ)"** und
**Vertriebsbezirk**, ordnet eine komplette Fläche zu.

Beispiele:

- `Oberhausen` = Landkreis/kreisfreie Stadt
- `46` = alle PLZ 46xxx
- `46045` = genau dieses PLZ-Gebiet

Widersprüchliche oder unbekannte Zuweisungen landen in der Fehlerliste.

### 7.9 Umsatzformate

TourFuchs versteht Excel-Zahlen sowie deutsche und englische Textformate, zum
Beispiel `1.234,56`, `1,234.56`, `45000` oder `45.5`. Währungszeichen werden
ignoriert. Überschriften mit `TEUR`, `Tsd EUR` oder `Mio EUR` werden auf volle
Euro umgerechnet. Der Import zeigt bei erkannten Besonderheiten einen Hinweis mit
Gesamtsumme zur Plausibilitätsprüfung.

### 7.10 Fehler und Hinweise

Gültige Zeilen werden importiert. Problematische Zeilen erscheinen in einer
herunterladbaren Excel-Liste, zum Beispiel bei:

- Dubletten
- fehlendem Vertriebsbezirk
- fehlender oder unbekannter PLZ
- widersprüchlicher Flächenzuordnung
- unbekanntem Landkreis/PLZ-Gebiet
- nicht zuordenbarer Kontakt-Kundennummer

Ein Kunde mit unbekannter PLZ kann gespeichert sein, erscheint aber nicht auf der
Karte.

### 7.11 Copilot- oder KI-erzeugte Empfehlungslisten

Der bestehende Importmechanismus kann auch eine durch einen KI-Agenten erzeugte
Excel-Datei öffnen. Aktuell gibt es jedoch **kein eigenes fachliches Schema** für
Felder wie Priorität, Empfehlung, Begründung oder nächster Schritt.

Für einen normalen Kundenimport müssen mindestens Kundenname, PLZ/Koordinaten
und Vertriebsbezirk zugeordnet werden. Für eindeutige Updates ist die
Kundennummer entscheidend. Eine reine Empfehlungsliste mit nur Priorität und
Begründung wird nicht automatisch zur Tour oder zum Besuchsstatus.

### 7.12 Export und Löschen

- **"Als Excel exportieren"** exportiert den aktuellen Kundenbestand.
- **"Daten löschen"** entfernt lokale Daten nach Bestätigung und deaktiviert
  auch den Tresor.
- mobil gibt es im Tour-Panel **"Datenbank zurücksetzen"**.

Vor **"Daten löschen"** oder **"Datenbank zurücksetzen"** immer zuerst einen
Export empfehlen, sofern die Daten noch benötigt werden.

---

## 8. Karte, Suche und Kunden-Popup

### 8.1 Verortungsstufen

**Stufe 1: lokal über PLZ**

Beim Import wird die Position ohne externen Geocoding-Dienst aus einer lokalen
Tabelle von rund 8.300 deutschen PLZ-Zentren bestimmt. Mehrere Kunden derselben
PLZ werden leicht versetzt, damit sie nicht exakt übereinander liegen. Im Popup
steht **"ca. (PLZ-Mitte)"**.

**Stufe 2: optional adressgenau**

**Klickpfad:** `"Daten" -> "Adressen exakt verorten"`.

Nur nach bewusstem Start werden Straße, PLZ und Ort einzeln und gedrosselt an
Nominatim/OpenStreetMap gesendet. Kundenname, Umsatz, Kontakte und
Vertriebsinformationen werden nicht mitgesendet.

### 8.2 Globale Kundensuche

**Klickpfad:** Topbar -> Suchfeld **"Kunde, Ort, PLZ suchen..."** -> Treffer
wählen.

Die Suche beginnt ab zwei Zeichen und findet bis zu acht Kunden nach:

- Teil des Kundennamens
- Teil des gespeicherten Orts
- PLZ-Anfang
- exakter Kundennummer

Umlaute und Schreibvarianten werden tolerant normalisiert, zum Beispiel `Koln`
für `Köln/Köln`.

Ein Treffer zeigt Kundenname sowie **PLZ + Ort** und fliegt nach der Auswahl zum
Marker. Das Kunden-Popup öffnet sich.

**Wichtige Grenze:** Die Suche ist eine Kundensuche, kein allgemeines
Städteverzeichnis. `Essen` liefert Kunden, deren Datensatz im Feld `Ort` Essen
enthält. Gibt es dort keinen Kunden oder fehlt das Ort-Feld im Import, erscheint
kein reiner Stadt-Treffer. Deshalb `Ort` beim Import mitführen.

Demo-Daten enthalten Ortsnamen. Ältere gespeicherte Demo-Daten werden beim Start
lokal aus der PLZ-Tabelle ergänzt. Eigene Daten werden nicht stillschweigend mit
einem Ort überschrieben.

### 8.3 Kartenstile und Zoom

Im Panel unter **"Kartenstil"** stehen:

- **"Hell"**
- **"Standard"**
- **"Satellit"**

Die Kartenwahl wird gespeichert. Das Mausrad zoomt in kleinen Viertelstufen, um
ruckartige Sprünge zu vermeiden. Das Mausrad über der Sidebar scrollt dagegen
den Panelinhalt. Auf Desktop bleiben die Plus-/Minus-Tasten der Karte sichtbar.
Auf dem Smartphone sind sie zugunsten von mehr Kartenfläche ausgeblendet; dort
wird intuitiv mit zwei Fingern gezoomt.

### 8.4 Kundenmarker und Cluster

- Markerfarbe folgt der gewählten Ansicht.
- viele Marker werden als Clusterzahl zusammengefasst.
- Kunden in der Tour werden hervorgehoben.
- bei PLZ-Verortung ist die Position nur näherungsweise.
- in der Ansicht **"Status"** folgen Farben dem Besuchsstatus.

### 8.5 Kunden-Popup in Basis

Das Popup zeigt je nach vorhandenen Daten:

- Kundenname
- Straße sowie **PLZ + Ort**
- Hinweis `ca. (PLZ-Mitte)` bei näherungsweiser Position
- Umsatz
- Hauptansprechpartner
- **"Anrufen"** und **"E-Mail"**
- **"Heute besucht"**
- **"Als Start"**
- **"Zur Tour"** beziehungsweise **"In Tour"**
- **"Briefing"**

Bei echten importierten Kunden öffnen **"Anrufen"** und **"E-Mail"** weiterhin
die jeweilige Geräte-App. Bei Demo-Kunden zeigen dieselben Schaltflächen nur
einen Hinweis; es wird keine externe Kontaktaktion gestartet.

### 8.6 Kunden-Popup in Profi

Zusätzlich:

- Kundennummer
- Vertriebschannel -> Vertriebsgruppe -> Vertriebsbezirk
- letzter Besuch, Alter des Besuchs und Status
- Besuchsrhythmus
- **"Als Ziel"**

### 8.7 Direkte Kundenaktionen

- **"Als Start"** setzt den Kunden als Tourstart.
- **"Als Ziel"** setzt im Profi-Modus den festen Endpunkt.
- **"Zur Tour"** fügt ihn den Stopps hinzu.
- **"Heute besucht"** dokumentiert lokal einen Besuch am heutigen Datum.
- **"Briefing"** öffnet die Vorbereitung mit Microsoft 365 Copilot.

Ausnahme: Bei technisch markierten Demo-Kunden öffnet **"Briefing"** eine lokale,
klar gekennzeichnete Ergebnisvorschau. Es wird kein Prompt erzeugt und nichts an
Microsoft übertragen.

---

## 9. Kundenbriefing mit Microsoft 365 Copilot

### 9.1 Product-Owner-Nutzen

Das Kundenbriefing ist ein zentraler USP: Ein Nutzer kann unterwegs einen
spontanen Besuch entscheiden und sich mit einem einzigen TourFuchs-Klick aus dem
aktuellen, berechtigten Unternehmenswissen vorbereiten. TourFuchs verbindet dabei
den richtigen Kunden auf der Karte mit Microsoft-365-Wissen. Eine allgemeine
Kartenanwendung kennt diesen Kunden- und Tourkontext nicht.

### 9.2 Voraussetzungen

- Anmeldung bei Microsoft 365 mit dem Entra-Arbeitskonto.
- passende Microsoft-365-Copilot-Lizenz.
- Zugriff nur auf Inhalte, die dieses Arbeitskonto ohnehin sehen darf.
- für den manuellen Basisweg keine TourFuchs-Client-ID.
- für den direkten Profiweg eine von der IT registrierte Entra-SPA und
  freigegebene Graph-Berechtigungen.

### 9.3 Basisweg: sofort nutzbar

**Klickpfad:** Kundenmarker -> **"Briefing"** ->
**"Prompt kopieren & Copilot öffnen"**.

Dieser Klickpfad gilt für echte importierte Kundendaten. Bei Demo-Kunden endet
der Klickpfad sicher in der lokalen Briefing-Vorschau mit **"Verstanden"**.

Ablauf:

1. TourFuchs zeigt Kundenidentität und den vollständigen vorbereiteten Prompt.
2. Der Nutzer kann vorab lesen, welche Daten enthalten sind.
3. TourFuchs kopiert den Prompt.
4. Auf Windows wird bevorzugt Microsoft Edge mit
   `https://m365.cloud.microsoft/chat` geöffnet; andernfalls ein normaler
   Browser-Tab.
5. Der Nutzer fügt den Prompt in Corporate Copilot ein.
6. Der Nutzer sendet ihn selbst bewusst ab.

Bis Schritt 6 überträgt TourFuchs keine Kundendaten automatisch an Microsoft.
Das Öffnen des Browsers allein ist noch keine fachliche Anfrage.

### 9.4 Inhalt des kompakten Prompts

Zur eindeutigen Zuordnung können enthalten sein:

- Kundenname
- Kundennummer
- PLZ und Ort
- Hauptansprechpartner
- geplanter Besuchstag
- Position in der Tour
- Rolle als Start oder Ziel
- letzter lokal dokumentierter Besuch

Der Prompt verlangt ausschließlich berechtigtes internes Microsoft-365-Wissen:

- E-Mails
- Outlook-Termine
- Teams-Chats und Kanalnachrichten
- Besprechungen und Transkripte
- Dateien

Zeitraum: letzte 12 Monate mit Schwerpunkt auf den letzten 90 Tagen sowie
zukünftige Termine, Zusagen, Aufgaben und Fristen.

Ergebnisformat, maximal 250 Wörter:

1. `Jetzt wichtig` - höchstens vier kurze Stichpunkte.
2. `Gespräch` - Ziel, Einstieg und genau drei konkrete Fragen.
3. `Handlung` - höchstens je ein belegter Punkt zu Offen, Chance und Risiko.
4. `Belege` - höchstens drei entscheidende Quellen mit Datum, Anlass und Link.

Der Prompt verbietet Websuche, allgemeine Internetinformationen und erfundene
Fakten. Unsicherheiten und Schlussfolgerungen müssen gekennzeichnet werden.

### 9.5 Profi: einfacher Weg zuerst

Auch im Profi-Modus steht oben zuerst der sofort nutzbare Weg
**"Prompt in Corporate Copilot verwenden"**. Das ist die bevorzugte
Rückfalloption und benötigt kein IT-Setup.

Darunter befindet sich eingeklappt:

**"Expertenfall: Briefing direkt in TourFuchs"**.

Diese Reihenfolge ist bewusst: erst Nutzen, dann technische Automatisierung.

### 9.6 Profi: direkte Entra-/Graph-Verbindung

Einrichtung:

1. in **"Profi"** einen Kunden öffnen.
2. **"Briefing"**.
3. Expertenfall aufklappen.
4. Client-ID und Tenant-ID oder Tenant-Domäne eintragen.
5. angezeigte Redirect-URI in der Entra-SPA hinterlegen.
6. Datenübergabe bestätigen.
7. **"Briefing direkt erstellen"**.
8. mit Arbeitskonto anmelden.

Die SPA verwendet kein Client Secret. Client- und Tenant-ID werden lokal im
Browser gespeichert; das Zugriffstoken liegt im Sitzungsspeicher und wird durch
MSAL verwaltet.

Der direkte Weg übergibt nach Zustimmung:

- Kundenname
- Kundennummer
- PLZ/Ort
- Hauptansprechpartner
- aktuellen Tourkontext

Nicht übergeben werden:

- vollständige Kundenliste
- Telefonnummer
- E-Mail-Adresse
- Umsatz
- Kartenkoordinaten

Die Antwort, Quellenhinweise und eine vorhandene Vertraulichkeitskennzeichnung
werden direkt in TourFuchs gezeigt.

### 9.7 Technischer Stand des Profiwegs

Stand Juli 2026 verwendet TourFuchs die Microsoft 365 Copilot Chat API unter
Microsoft Graph `/beta/copilot`. Die API ist weiterhin Preview.

Delegierte Berechtigungen:

- `Sites.Read.All`
- `Mail.Read`
- `People.Read.All`
- `OnlineMeetingTranscript.Read.All`
- `Chat.Read`
- `ChannelMessage.Read.All`
- `ExternalItem.Read.All`

Die Organisation muss diese Rechte gegebenenfalls administrativ freigeben.
TourFuchs handelt immer im Namen des angemeldeten Nutzers. Die Websuche ist im
API-Aufruf ausgeschaltet.

Weitere technische Details: `docs/copilot-briefing.md`.

### 9.8 Fehler und Fallback

Bei abgebrochener Anmeldung, blockiertem Popup, fehlender Administratorfreigabe,
abgelaufener Anmeldung, API- oder Netzwerkfehler zeigt TourFuchs eine
verständliche Meldung. Der Button **"Prompt kopieren & Copilot öffnen"** bleibt
als manueller Rückfallweg verfügbar.

### 9.9 Richtige Guide-Antwort bei Datenschutzfragen

Der Guide sagt nicht pauschal "Es werden keine Daten übertragen". Korrekt ist:

- Im Basisweg zeigt und kopiert TourFuchs den Prompt lokal. Erst der Nutzer sendet
  ihn in Microsoft 365 Copilot.
- Im Profiweg übergibt TourFuchs die vorher benannten Identifikations- und
  Tourdaten nach ausdrücklicher Zustimmung direkt an Microsoft.
- Microsoft-365-Berechtigungen und Richtlinien der Organisation bleiben wirksam.

---

## 10. Tourplanung im Außendienst

### 10.1 Standardtour in Basis

**Klickpfad:** `"Außendienst" -> Tab "Tour"`.

1. Unter **"Für welchen Bezirk planst du?"** einen Vertriebsbezirk oder
   **"Alle Bezirke"** wählen.
2. **"Mein Standort"** nutzen oder im Feld
   **"...oder Kunde als Start wählen"** einen Kunden suchen.
3. Datum, Startzeit und **"Besuch (Min.)"** einstellen.
4. Umkreis mit dem Regler anpassen.
5. optional **"Überfällige zuerst"** aktivieren.
6. Kunden aus Vorschlägen oder Karten-Popups mit **"Zur Tour"** hinzufügen.
7. ab zwei Stopps **"Reihenfolge optimieren"**.
8. **"Route auf Karte anzeigen"**.
9. bei Bedarf **"Straßenroute anzeigen"**.
10. **"In Google Maps navigieren"**.

Der Nutzer baut die Tour bewusst selbst. TourFuchs schlägt vor und optimiert nur
die ausgewählten Stopps.

### 10.2 Profi-Erweiterungen

Profi ergänzt:

- Kartenansicht **"Kunden"**, **"Status"**, **"Chancen"**
- festen **"Ziel"**-Kunden
- Vorschlagsmodus **"Umkreis um Start"** / **"Entlang der Tour"**
- **"Rundreise (zurück zum Start)"**
- Tagesplan-Druck
- Kalender-Export
- Tour als Text für Outlook/Copilot
- gespeicherte Touren

Auf dem Smartphone können Profi-Abschnitte seitlich weggewischt werden.
**"Ausgeblendete Elemente zurücksetzen"** stellt sie wieder her.

### 10.3 "Was ist in meiner Nähe?"

**Klickpfad:** `"Außendienst" -> "Tour" -> "Was ist in meiner Nähe?"`.

Die Funktion nutzt den GPS-Standort als Start und zeigt passende Kunden im
Umkreis. Eine Standortberechtigung kann erforderlich sein.

Im mobilen Karte-Tab gibt es zusätzlich den Begleiter **"In der Nähe"**. Der
Bezugspunkt kann zwischen **"Kartenmitte"** und **"Standort"** wechseln. Ein Tipp
auf einen Kunden fliegt zum Marker; Plus fügt ihn zur Tour hinzu.

### 10.4 Vorschläge

**Umkreis um Start:** Kunden innerhalb des gewählten Radius.

**Entlang der Tour:** Kunden in einem Korridor entlang Start, Stopps und Ziel. Bei
erteilter Routing-Zustimmung folgt der Korridor der Straßenroute; sonst der
direkten Verbindung.

**Überfällige zuerst:** priorisiert fällige und überfällige Besuche, baut aber
nicht automatisch eine Tour.

### 10.5 Optimierung

**"Reihenfolge optimieren"** sortiert die gewählten Zwischenstopps mit
Nearest-Neighbor und 2-Opt. Start und optionales Ziel bleiben fest. Die Berechnung
ist eine Streckenheuristik und keine Echtzeit-Verkehrsoptimierung.

### 10.6 Ziel und Rundreise

- mit explizitem Ziel endet die Tour dort.
- mit **"Rundreise"** endet sie wieder am Start.
- ohne Ziel und ohne Rundreise ist der letzte Stopp automatisch das Ziel.

### 10.7 Luftlinie und Straßenroute

Beim ersten **"Route auf Karte anzeigen"** erscheint die Luftlinie. Danach
wechselt derselbe Button zwischen:

- **"Straßenroute anzeigen"**
- **"Luftlinie anzeigen"**

Die Straßenroute kommt von OSRM auf Basis von OpenStreetMap. Vor der ersten
externen Anfrage bittet TourFuchs um Zustimmung. Übertragen werden nur
Koordinaten von Start und Routenpunkten. Bei Fehler bleibt die Luftlinie
verfügbar.

### 10.8 Google Maps

**"In Google Maps navigieren"** öffnet einen Directions-Link. Erst mit diesem
bewussten Klick werden Routendaten an Google übergeben. Google begrenzt die Zahl
der Zwischenziele; TourFuchs übergibt deshalb nur die unterstützte Anzahl
(bei einer einfachen Tour bis zu zehn Stopps inklusive Ziel).

### 10.9 Tagesplan und Kalender

Nur Profi:

- **"Tagesplan drucken"** erstellt einen Plan mit Ankunftszeiten, Adressen,
  Kontakten und Checkboxen.
- **"Kalender-Export (.ics)"** erstellt einen Termin je Besuch.
- **"Als Text kopieren (Outlook/Copilot)"** legt die Tour in die Zwischenablage.

Datum, Startzeit und Besuchsdauer steuern Druck, Kalender und QR-Übergabe.
Fahrzeiten sind Schätzwerte.

### 10.10 Besuchsstatus

Aus Besuchsrhythmus und letztem Besuch entstehen:

- ok
- bald fällig
- überfällig

Kunden ohne Rhythmus haben keinen Status. Ein Besuch wird in der Tour mit
**"Heute"** oder im Kunden-Popup mit **"Heute besucht"** dokumentiert. Der Status
aktualisiert sich sofort und wird lokal gespeichert.

### 10.11 Service-Fokus (Profi): Einsätze, Verträge und Tagesvorschlag

Der Arbeitsfokus **"Service"** ist eine Profi-Funktion (nur in Ansichtstiefe
**"Profi"** sichtbar) mit den Tabs **"Einsätze"**, **"Verträge"** und
**"Tour"**. Er hält zwei getrennte Zusatzbestände neben den Kundendaten:

**Serviceverträge (Vertragsradar):** eigener Excel-/CSV-Import. Eindeutiger
Schlüssel ist `Quellsystem + Vertragsnummer`; die Verknüpfung zum Kunden erfolgt
ausschließlich über die exakte **Kundennummer** (führende Nullen bleiben
erhalten, Namen oder PLZ sind bewusst keine Fallbacks). Ein erneuter Import
ersetzt nur die in der Datei enthaltenen Vertragsquellen; andere Quellen,
Kunden, Gebiete und Touren bleiben erhalten. Das Radar zeigt Handlungsfristen
("Handeln bis") in exklusiven Zeitfenstern, Vertragswerte und Verantwortliche.

**Operative Serviceeinsätze (Work Orders):** ebenfalls eigener Import mit
strenger Validierung (Fällig am, Zeitfenster, Dauer 10-720 Minuten, Priorität
KRITISCH/HOCH/MITTEL/NIEDRIG, Status). Fehlerhafte Zeilen werden nie
übernommen; die Fehlerliste steht als Excel bereit.

**Kundenauswahl im Service-Fokus:** Über dem Panel steuert eine Auswahl, welche
Kunden Karte und Tour zeigen: **"Jetzt"** (fällige/kritische Einsätze),
**"Diese Woche"**, **"Vertragskunden"** (Standard: Kunden mit aktivem oder in
Verlängerung befindlichem Vertrag) oder bewusst **"Alle Kunden"**. Zähler an
den Schaltflächen machen die Wirkung sichtbar. Bereits gewählte Tourstopps
außerhalb des Filters bleiben mit einem Hinweis in der Tour.

**Tagesvorschlag:** Der Service-Tagesplaner erstellt lokal und deterministisch
einen erklärbaren Tagesplan (Arbeitstag, Schichtfenster, Techniker-Skills).
Entfernungen werden als Luftlinie mal Straßenfaktor 1,3 bei 60 km/h geschätzt;
SLA-Fristen beeinflussen die Reihenfolge, sind aber keine harte Schranke. Jeder
Stopp trägt nachvollziehbare Gründe, nicht einplanbare Einsätze werden mit
Ursache gelistet. **"Übernehmen"** ersetzt die Tourstopps und fixiert die
Zeiten; jede manuelle Touränderung verwirft den fixierten Plan bewusst.
Tagesplan-Druck und Kalender-Export übernehmen die fixierten Zeiten.

Demo-Daten enthalten passende Demo-Verträge und 20 Demo-Einsatzaufträge, damit
der Service-Fokus ohne eigene Dateien erlebbar ist.

---

## 11. Tour vom Desktop aufs Smartphone übergeben

### 11.1 Senden am Desktop

**Klickpfad:** Tour planen -> **"An Handy übergeben (QR)"**.

Der QR-Code enthält nur die geplante Tour, maximal 12 Stopps:

- Start
- Stopps mit Name, Koordinaten, Adresse, Telefon und Kundennummer
- Datum, Startzeit und Besuchsdauer
- Rundreise-Einstellung
- optionaler Tourname

Die vollständige Kundendatenbank wird nicht übertragen. Der Tourinhalt steckt im
URL-Fragment `#t=...`; dieses Fragment wird beim Laden der Webadresse nicht an den
Server gesendet.

### 11.2 Empfangen mit der normalen Smartphone-Kamera

1. QR-Code am Desktop mit der Kamera-App scannen.
2. TourFuchs-Link öffnen.
3. Empfangsdialog prüfen.
4. eine der angebotenen Aktionen wählen.

Die installierte PWA öffnet sich, andernfalls der Browser. Das Laden der App kann
eine Netzwerkverbindung benötigen, der Tourinhalt selbst wird jedoch aus dem
QR-Fragment gelesen.

### 11.3 Empfangen innerhalb von TourFuchs

**Klickpfad:** `"Tour" -> "Tour vom Desktop scannen"`.

Alternativ zum Live-Kamerascan kann ein Foto des QR-Codes ausgewählt werden.

Nach erfolgreichem Scan:

- **"Als Tour übernehmen"** gleicht Stopps über Kundennummer, sonst Name + PLZ,
  mit lokalen Kunden ab.
- **"In Google Maps navigieren"** funktioniert direkt aus dem QR-Code.
- **Kalender (.ics)** funktioniert ebenfalls direkt aus dem QR-Code.

### 11.4 Warum "An Handy übergeben" mobil fehlt

Auf einem Smartphone wäre das Senden einer Tour an dasselbe Smartphone
verwirrend. Deshalb ist **"An Handy übergeben (QR)"** im Mobile View ausgeblendet.
**"Tour vom Desktop scannen"** bleibt sichtbar.

---

## 12. Mobile Bedienung

### 12.1 Produktfokus

Mobil stehen zwei Hauptreiter fest unter der Topbar:

- **"Karte"**
- **"Tour"**

Darüber beziehungsweise in derselben festen Navigation bleibt
**"Basis" / "Profi"** erreichbar. Gebietsplanung, Cockpit und Simulation sind
bewusst Desktop-Aufgaben.

### 12.2 Bottom Sheet

Das Bedienpanel ist unten an den Bildschirm angedockt.

- **"Tour"** öffnet das Sheet.
- **"Karte"** schließt es zugunsten der Karte.
- der obere Griff wird senkrecht gezogen, um die Höhe kontinuierlich zu ändern.
- aus geschlossenem Zustand folgt das Blatt direkt dem Finger, ohne von unten
  falsch zu schrumpfen.
- ein reiner Tipp auf den Griff ändert mobil nichts.
- die gewählte Höhe wird gespeichert.

Im Sheet funktionieren Scrollbar, Finger-Scrollen und Ziehen auf Freiflächen.
Die Karte wird mobil mit zwei Fingern gezoomt. Sowohl die zusätzlichen
Karten-Zoomtasten als auch die Desktop-Panel-Skalierung sind dort bewusst
ausgeblendet.

### 12.3 In der Nähe

Wird im Karte-Tab das Sheet geöffnet, zeigt **"In der Nähe"** Kunden relativ zur
Kartenmitte oder zum GPS-Standort.

Basis zeigt Name, Ort, Entfernung und Umsatz. Profi ergänzt Besuchsstatus und
Fälligkeitszähler.

### 12.4 Mobile Popups

Kunden-Popups sind scrollbar. Adresse zeigt Straße, PLZ und Ort. Aktionen wie
**"Zur Tour"**, **"Heute besucht"** und **"Briefing"** funktionieren direkt aus
dem Popup.

### 12.5 Hochformat und Mobile-Vorschau

Die App ist für Smartphone-Hochformat optimiert. Im Querformat kann ein
Drehhinweis erscheinen.

Am Desktop öffnet das Topbar-Symbol **"Mobile Außendienst & Tour"** eine
gerahmte Smartphone-Ansicht. Sie ist kein reiner Tourenplaner: Kundenkarte,
Kundensuche, Kunden-Popup, Briefing, Tour und Navigation bleiben erreichbar.
Für den schnellen Nutzennachweis startet die Vorschau im geöffneten Tour-Bereich.

Sobald erstmals Kundendaten vorhanden sind und kein Dialog oder anderer
Onboarding-Schritt die Aufmerksamkeit beansprucht, inszeniert TourFuchs diesen
Einstieg genau einmal ruhig: Das Smartphone-Symbol wird kurz hervorgehoben, die
fertig geladene Vorschau öffnet sich für etwa 2,6 Sekunden und schließt wieder.
Danach zeigt ein kurzer Hinweis, wo sie erneut geöffnet werden kann. Auf einem
leeren Erststart bleibt zunächst die Begrüßung im Vordergrund. Eine manuelle
Nutzung unterdrückt den späteren Auto-Hinweis; bei reduzierter Bewegung wird nur
der statische Fundorthinweis gezeigt.

Die Vorschau läuft im selben TourFuchs-Ursprung und nutzt deshalb denselben lokal
gespeicherten Datenbestand. Innerhalb des eingebetteten Smartphones wird das
automatische Live-Demo-Angebot unterdrückt, damit kein Modal im Modal erscheint.

### 12.6 Mobile Live-Demos

Die Demo-Auswahl nutzt fast die gesamte verfügbare Höhe, skaliert Inhalte für
normale Smartphone-Größen und hält Kopf, Liste und Abschlussaktionen sichtbar.
Desktop-only Geschichten und der QR-Sendeschritt werden ausgeblendet.

---

## 13. Gebietsplanung, Cockpit und Simulation

### 13.1 Gebietsansicht

**Klickpfad:** `"Gebietsplanung" -> Tab "Gebiete"`.

Gebietsebenen:

- Landkreise
- PLZ 1-stellig
- PLZ 2-stellig
- PLZ 3-stellig
- PLZ 5-stellig

Anzeigearten:

- **"Automatisch (nach Zoom)"**
- **"Vertriebsbezirk (Flächen)"**
- **"Vertriebsgruppe (Flächen)"**
- **"Besuchsstatus"**
- **"Weiße Flecken (Abdeckung)"**

Bei automatischer Anzeige gilt: weit herausgezoomt Vertriebsgruppen, mittlerer
Zoom Vertriebsbezirke, nah Kundenmarker.

### 13.2 Umsatzlabels

Flächenlabels zeigen die fachliche Gesamtsumme einer Einheit, unabhängig von
aktiven Kundenfiltern. `T EUR` bedeutet Tausend Euro. Der exakte Betrag steht im
Tooltip.

### 13.3 Gebietspopup

Ein Klick auf eine Fläche zeigt:

- Kundenzahl
- Umsatz gesamt
- Verteilung **Vertriebsbezirk · Kunden · Umsatz**
- in Profi zusätzlich die namentliche Kundenliste

Am Desktop kann der Nutzer:

- **"Kunden dieses Gebiets umordnen"**
- eine ganze Fläche einem Vertriebsbezirk zuweisen
- einzelne Kunden filtern, markieren und neu zuweisen
- die letzte Editor-Aktion rückgängig machen

Mobil ist die Gebietsplanung nur lesend beziehungsweise ausgeblendet; Änderungen
werden am Desktop durchgeführt.

### 13.4 Gebiets-Cockpit

**Klickpfad:** `"Gebietsplanung" -> "Gebiete" -> "Gebiets-Cockpit öffnen"`.

Das Cockpit beantwortet:

- Wie viele Kunden und wie viel Umsatz besitzt jeder Vertriebsbezirk?
- Welche Bezirke sind stark oder schwach?
- Wie ausgewogen ist die Verteilung?
- Welche Wirkung hätte eine Gebietsverschiebung?

Wichtige Elemente:

- Vertriebsgruppe als Vergleichsrahmen
- Status-, Top- und Flop-KPI
- Tabelle mit Vertriebsbezirk, Kunden, Umsatz und Auslastung
- Sortierung nach Umsatz, Kunden oder Name
- Top-3/Flop-3 oder **"Alle anzeigen"**
- Suche innerhalb der Einheiten

**Fairness:** bis zu einem Kunden-Faktor von 1,5 gilt die Verteilung als
ausgewogen; darüber als ungleich verteilt.

### 13.5 Was-wäre-wenn-Simulation

**Klickpfad:** Cockpit -> Bereich **"Was-wäre-wenn: Gebiete zuweisen"**.

1. Ebene wählen.
2. Kreisname oder PLZ-Präfix suchen.
3. optional **"Auch Gebiete ohne Kunden einbeziehen"**.
4. Gebiete markieren oder **"Alle sichtbaren auswählen"**.
5. Zielart und Ziel wählen.
6. **"Auswahl zuweisen"**.
7. Kennzahlen und Umsatzdeltas prüfen.
8. optional **"Ein Schritt zurück"** oder
   **"Simulation zurücksetzen"**.
9. **"Simulation auf Karte prüfen"**.
10. erst nach Prüfung **"Zuweisung übernehmen"**.

**Merksatz:** **"Auswahl zuweisen"** ist nur Simulation.
**"Zuweisung übernehmen"** schreibt dauerhaft.

Bis zu 30 Simulationsschritte können einzeln zurückgenommen werden.

### 13.6 Simulationskarte

Ansichten:

- **"Alt"** = Zustand vor der Simulation
- **"Neu"** = simulierter Zielzustand
- **"Änderungen"** = nur geänderte Gebiete deutlich hervorgehoben

Aktionen:

- **"Simulation bearbeiten"**
- **"Verwerfen"**
- **"Zuweisung übernehmen"**

In **"Änderungen"** zeigt die Füllung die neue Farbe und die Umrandung die alte
Farbe.

---

## 14. Datentresor und sicherer Geräteumzug

### 14.1 Datentresor einrichten

Klickpfade:

- Topbar -> offenes Schloss/Tresor-Symbol
- oder `"Daten" -> "Datentresor" -> "Tresor aktivieren (PIN)"`

Nach dem Import eigener Kundendaten bietet TourFuchs die Einrichtung geführt an.
Demo-Daten verlangen keine PIN.

Der Nutzer vergibt eine PIN mit mindestens vier Zeichen. Danach zeigt TourFuchs
einen **Wiederherstellungscode**, der nur einmal sichtbar ist. Er muss getrennt und
sicher aufbewahrt werden.

### 14.2 Schutzmodell

- Kundendaten werden lokal mit AES-256 verschlüsselt.
- ein zufälliger Datenschlüssel wird mit einem aus der PIN abgeleiteten
  Schlüssel geschützt.
- die PIN und der ungeschützte Datenschlüssel werden nicht dauerhaft
  gespeichert.
- nach App-Start oder Auto-Lock erscheint der Sperrbildschirm.
- Standard-Auto-Lock ist 5 Minuten; wählbar sind 1, 5, 15 Minuten, 1 Stunde oder
  nur manuell.
- nach 10 falschen PIN-Versuchen werden Tresor und lokale Kundendaten gelöscht.

Der Tresor schützt gespeicherte Daten auf einem verlorenen oder gestohlenen
Gerät. Er schützt nicht gegen Schadsoftware in einer bereits entsperrten Sitzung.

### 14.3 PIN vergessen

**Klickpfad:** Sperrbildschirm ->
**"PIN vergessen? Wiederherstellungscode nutzen"** -> Code eingeben -> neue PIN
setzen.

Ohne PIN und Wiederherstellungscode gibt es keine Betreiber-Hintertür. Die Daten
sind nicht wiederherstellbar.

### 14.4 Face/Touch ID

Bei aktivem, entsperrtem Tresor kann **"Face/Touch ID einrichten"** erscheinen.
Voraussetzung ist ein Plattform-Authenticator mit WebAuthn-PRF-Unterstützung.
Biometrische Daten verlassen das Gerät nicht. Die PIN bleibt der Rückfallweg.

### 14.5 Manuell sperren, PIN ändern, deaktivieren

- Topbar-Tresorsymbol sperrt sofort.
- **"PIN ändern"** verlangt die aktuelle PIN.
- **"Tresor deaktivieren"** verlangt Bestätigung und PIN; danach werden Daten
  wieder unverschlüsselt lokal gespeichert.

### 14.6 Sicherer Umzug senden

**Klickpfad:** `"Daten" -> "Sicherer Umzug" ->
"Verschlüsselt exportieren (Datei + QR)"`.

TourFuchs erzeugt:

1. eine AES-256-GCM-verschlüsselte `.tfsafe`-Datei.
2. einen getrennten Zufallsschlüssel als QR-Code und Text.

TourFuchs lädt die Datei nicht auf einen eigenen Server. Der Nutzer entscheidet,
wie die Datei auf das Zielgerät gelangt. Datei und Schlüssel müssen getrennt
transportiert werden.

### 14.7 Sicherer Umzug empfangen

**Klickpfad:** `"Eigene Daten laden" -> "Verschlüsselte TourFuchs-Datei" ->
"Verschlüsselte Datei öffnen"`.

Alternativ bei geladenen Daten:

`"Daten" -> "Daten empfangen (Datei + Schlüssel)"`.

1. `.tfsafe`-Datei wählen.
2. Schlüssel-QR scannen oder Schlüsseltext eingeben.
3. Daten entschlüsseln.
4. direkt einen neuen lokalen Datentresor einrichten.

Falscher Schlüssel und beschädigte Datei werden erkannt.

---

## 15. PWA-Installation und Updates

### 15.1 Installation

**Desktop Edge/Chrome:** Browser-Menü -> **"App installieren"**.

**Android Chrome:** Menü -> **"App installieren"** oder
**"Zum Startbildschirm hinzufügen"**.

**iPhone Safari:** Teilen -> **"Zum Home-Bildschirm"**.

### 15.2 Offline-Verhalten

App-Shell, grundlegende Gebietsdaten, PLZ-Koordinaten und PLZ-Ortsnamen werden
vorgehalten. Große Detailgebiete und zuletzt verwendete Kartenkacheln werden nach
Nutzung gecacht. Eine vollständige Offline-Karte für ganz Deutschland ist nicht
garantiert.

Microsoft 365 Copilot, Nominatim, OSRM, Google Maps und neue Kartenkacheln
benötigen Netzwerkzugriff.

### 15.3 Updates

TourFuchs prüft beim Start, etwa stündlich und bei erneutem Fokus auf Updates.
Bei einer neuen Version erscheint:

- **"Später"**
- **"Jetzt aktualisieren"**

Das Update erneuert App-Dateien und Service Worker. IndexedDB und localStorage
werden dabei nicht gelöscht. Das allgemeine Löschen von Browserdaten kann lokale
Kundendaten dagegen entfernen.

### 15.4 Alter Name oder alte Version

1. App schließen und neu öffnen.
2. Update-Hinweis bestätigen.
3. Browserseite neu laden.
4. bei altem PWA-Namen alte Installation entfernen und neu installieren.

---

## 16. Datenschutz und Datenflüsse

### 16.1 Grundmodell

TourFuchs ist **lokal-first**, nicht pauschal "vollständig offline". Eigene
Kundendaten liegen im Browserprofil in IndexedDB; Einstellungen und
Sicherheitsmetadaten liegen lokal. Der Betreiber erhält den Kundendatensatz
nicht. Bewusst gestartete Funktionen können klar begrenzte Daten an externe
Dienste übergeben.

### 16.2 Verbindliche Datenflussmatrix

| Funktion | Auslöser | Übertragene Daten | Ziel |
|---|---|---|---|
| PLZ-Verortung | automatisch beim Import | keine externe Übertragung | lokale PLZ-Tabelle |
| Kartenanzeige | Karte betrachten | technische Zugriffsdaten, Kachelkoordinaten | OSM/CARTO/Esri-Kacheldienste |
| Adressen exakt verorten | bewusster Klick bei Echtdaten | Straße, PLZ, Ort | Nominatim/OpenStreetMap |
| Straßenroute/Korridor | nach Zustimmung | Koordinaten der Routenpunkte | OSRM |
| Google Maps Navigation | bewusster Klick | Start, Ziel, Zwischenziele als Adresse/Koordinate | Google Maps |
| Basis-Briefing | Nutzer fügt Prompt ein und sendet | im Prompt sichtbare Identität und Tourkontext | Microsoft 365 Copilot |
| Profi-Briefing | Zustimmung + Anmeldung | Name, Nummer, PLZ/Ort, Hauptkontakt, Tourkontext | Microsoft Graph/Copilot |
| Demo-Kontakt und Demo-Briefing | Klick auf sichtbare Demo-Aktion | keine externe Übertragung; lokale Simulation/Vorschau | nur TourFuchs im Browser |
| Tour-QR | QR anzeigen/scannen | keine TourFuchs-Serverübertragung; Tour im QR/URL-Fragment | Bildschirm/Kamera |
| Sicherer Umzug | Export/Import | TourFuchs lädt nichts hoch; Dateiweg vom Nutzer gewählt | lokales Dateisystem/gewählter Kanal |

### 16.3 Was Nominatim nicht erhält

- Kundenname
- Kundennummer
- Umsatz
- Ansprechpartner
- Telefon/E-Mail
- Vertriebsbezirk oder Gruppe

### 16.4 Was OSRM nicht erhält

- Kundenname
- Kundennummer
- Umsatz
- Ansprechpartner
- Telefonnummer/E-Mail

### 16.5 Briefing und internes Wissen

Copilot darf nur Inhalte einbeziehen, auf die das angemeldete Arbeitskonto Zugriff
hat. TourFuchs umgeht keine Microsoft-Berechtigungen. Der Guide darf nicht
behaupten, das Briefing könne beliebige fremde oder gesperrte Unternehmensdaten
lesen.

### 16.6 Vor destruktiven Aktionen

Vor diesen Aktionen immer Wirkung nennen und bei Bedarf Export empfehlen:

- **"Daten löschen"**
- **"Datenbank zurücksetzen"**
- zehnter falscher PIN-Versuch
- **"Zuweisung übernehmen"**
- vollständiger Kundenimport

---

## 17. Klickpfad-Bibliothek

| Ziel | Klickpfad |
|---|---|
| Demo-Daten laden | `Daten -> "App in 60 Sekunden erleben"` |
| Live-Demos manuell | `Willkommens-Panel -> "Lieber zuschauen?"` oder `Info & Impressum -> "Funktionen entdecken (Live-Demos)"` |
| Erste Schritte einklappen | `Erste-Schritte-Karte -> "Später"` (Zeile bleibt; Klick klappt wieder auf) |
| Erste Schritte abwählen | `Erste-Schritte-Karte -> "Nicht mehr zeigen"` |
| Erste Schritte zurückholen | `Info & Impressum -> "Erste Schritte anzeigen"` |
| Service-Fokus öffnen | `Profi -> Fokus "Service"` |
| Verträge importieren | `Service -> Verträge -> Vertragsdatei laden` |
| Einsätze importieren | `Service -> Einsätze -> Einsatzdatei laden` |
| Service-Tagesvorschlag | `Service -> Tour -> Bezirk + Start -> Tagesvorschlag prüfen -> "Übernehmen"` |
| Eigene Liste laden | `Daten -> "Eigene Daten laden" -> "Excel- oder CSV-Liste" -> Berechtigung -> "Excel-/CSV-Datei auswählen"` |
| Spalten prüfen | `"Spalten zuordnen" -> Zuordnungen und Beispiele prüfen -> "Importieren"` |
| Fehlerliste | `"Import abgeschlossen" -> "Fehlerliste (.xlsx)"` |
| Excel-Vorlage | `Daten -> "Excel-Vorlage herunterladen"` |
| Kundenbestand ersetzen | `Daten -> "Andere Excel- oder CSV-Liste laden" -> Datei prüfen -> "Importieren" -> Ersetzungswarnung bestätigen` |
| Exakte Adressen | `Daten -> "Adressen exakt verorten"` |
| Export | `Daten -> "Als Excel exportieren"` |
| Kunde suchen | `Topbar -> "Kunde, Ort, PLZ suchen..." -> Kundentreffer` |
| Mobile Ansicht prüfen | `Topbar -> Smartphone-Symbol "Mobile Außendienst & Tour"` |
| Kundenbriefing Basis | `Kundenmarker -> "Briefing" -> "Prompt kopieren & Copilot öffnen"` |
| Kundenbriefing Profi direkt | `Profi -> Kundenmarker -> "Briefing" -> Expertenfall -> Verbindung/Zustimmung -> "Briefing direkt erstellen"` |
| Demo-Briefing | `Demo-Kundenmarker -> "Briefing" -> lokale Ergebnisvorschau -> "Verstanden"` |
| Kunden anrufen | `Kundenmarker -> "Anrufen"` |
| Besuch abhaken | `Kundenmarker -> "Heute besucht"` oder `Tourstopp -> "Heute"` |
| Tour starten | `Außendienst -> Tour -> Vertriebsbezirk -> Startpunkt` |
| GPS-Start | `Außendienst -> Tour -> "Mein Standort"` |
| Kunde zur Tour | `Vorschlag oder Kunden-Popup -> "Zur Tour"` |
| Reihenfolge | `Tour -> "Reihenfolge optimieren"` |
| Route zeigen | `Tour -> "Route auf Karte anzeigen"` |
| Straßenroute | `Tour -> "Straßenroute anzeigen" -> Zustimmung` |
| Google Maps | `Tour -> "In Google Maps navigieren"` |
| Desktop-QR | `Tour -> "An Handy übergeben (QR)"` |
| Tour scannen | `Tour -> "Tour vom Desktop scannen"` |
| Cockpit | `Gebietsplanung -> Gebiete -> "Gebiets-Cockpit öffnen"` |
| Simulation | `Cockpit -> Ebene -> Gebiete markieren -> Ziel -> "Auswahl zuweisen"` |
| Simulationskarte | `Cockpit -> "Simulation auf Karte prüfen" -> Alt/Neu/Änderungen` |
| dauerhaft übernehmen | `Simulation -> "Zuweisung übernehmen" -> bestätigen` |
| Tresor | `Daten -> "Tresor aktivieren (PIN)"` |
| sicher senden | `Daten -> "Verschlüsselt exportieren (Datei + QR)"` |
| sicher empfangen | `Daten -> "Daten empfangen (Datei + Schlüssel)"` |
| PWA-Update | `Update-Hinweis -> "Jetzt aktualisieren"` |

---

## 18. Diagnosebäume und Fehlerbilder

### 18.1 Keine Kunden sichtbar

In dieser Reihenfolge prüfen:

1. Sind unter **"Daten"** Kunden geladen?
2. Wie viele sind als verortet sichtbar?
3. Ist im Tab **"Filter"** etwas ausgeblendet?
4. Ist im Tourmodus der richtige Vertriebsbezirk gewählt?
5. Ist ein Tour-Kartenfokus aktiv?
6. Ist die Karte weit verschoben oder zu stark gezoomt?
7. Hat der Kunde PLZ oder Koordinaten?
8. War die Spaltenzuordnung korrekt?

Kurze Musterantwort:

> Prüfe zuerst Filter und Tour-Bezirk. Wenn dort alles stimmt, öffne "Daten" und
> vergleiche Kundenzahl und "verortet". Eine fehlende oder unbekannte PLZ
> verhindert den Marker.

### 18.2 Stadt im Suchfeld liefert nichts

Prüfen:

1. Sind Daten geladen?
2. Gibt es einen Kunden in dieser Stadt?
3. Ist bei diesem Kunden das Feld `Ort` gefüllt?
4. Wird mindestens mit zwei Zeichen gesucht?
5. Ist es ein eigener Import ohne Ortsspalte?

Erklärung: Die Suche findet Kunden nach ihrem Ort, nicht die Stadt als
eigenständiges Kartenziel.

### 18.3 Popup zeigt PLZ, aber keinen Ort

Ursache: Das Feld `Ort` fehlt im eigenen Kundendatensatz. Lösung: Ortsspalte beim
nächsten vollständigen Kundenimport zuordnen. Demo-Daten werden automatisch lokal angereichert;
eigene Daten werden nicht stillschweigend verändert.

### 18.4 Gebiet bleibt grau oder leer

Prüfen:

- Gebietsebene aktiv?
- Vertriebsbezirk importiert?
- passende Anzeige gewählt?
- Filter aktiv?
- Gebiet ohne Kunden explizit zugeordnet?

### 18.5 Keine Tourvorschläge

1. Vertriebsbezirk gewählt?
2. Startpunkt gesetzt?
3. Radius/Korridor groß genug?
4. bei **"Entlang der Tour"** mindestens zwei Routenpunkte vorhanden?
5. passende Kunden bereits in Tour?
6. Filter zu eng?

### 18.6 Straßenroute erscheint nicht

- keine vollständige Route
- Zustimmung nicht erteilt
- Netzwerk/OSRM nicht erreichbar
- ungültige Punkte

Lösung: Luftlinie weiterverwenden, Verbindung prüfen und erneut auf
**"Straßenroute anzeigen"** klicken.

### 18.7 Briefing öffnet Copilot, Prompt steht aber nicht im Eingabefeld

Das ist der erwartete Basisweg. Browser dürfen fremde Websites nicht automatisch
mit Text befüllen oder absenden. Der Prompt liegt in der Zwischenablage. In
Corporate Copilot einfügen, prüfen und selbst absenden.

### 18.8 Briefing zeigt Entra-Fehler

Prüfen:

- Basisweg als sofortigen Fallback nutzen.
- gültige Client-ID und Tenant-ID?
- Redirect-URI exakt registriert?
- Arbeitskonto und Copilot-Lizenz vorhanden?
- Graph-Rechte durch IT freigegeben?
- Popup oder Anmeldung vom Browser blockiert?

### 18.9 Live-Demo erscheint nicht automatisch

Das ist das erwartete Verhalten: Die Demo-Auswahl öffnet sich nie von selbst.
Wege zum Öffnen:

1. `Willkommens-Panel -> "Lieber zuschauen? Geführte Vorführung starten"`
   (nur sichtbar, solange keine Daten geladen sind).
2. `Info & Impressum -> "Funktionen entdecken (Live-Demos)"` (jederzeit).

### 18.10 Live-Demo wurde unterbrochen

TourFuchs stellt den vorherigen Zustand wieder her und zeigt
**"Erneut versuchen"**. Bei wiederholtem Fehler Demo-Auswahl schließen,
Netzwerk prüfen und die einzelne Funktion manuell testen.

### 18.11 Panel scrollt nicht wie erwartet

- Mausrad über der Karte zoomt die Karte; über dem Panel scrollt es.
- auf einer funktionslosen Panelfläche mit linker Maustaste ziehen.
- auf Buttons/Eingaben startet absichtlich kein Flächenziehen.
- sichtbare Scrollbar kann weiterhin direkt genutzt werden.
- Plus/Minus ändert nur die Panelgröße.

### 18.12 Mobile Sheet schrumpft scheinbar falsch

Am oberen Griff anfassen und kontinuierlich senkrecht ziehen. Ein reiner Tipp
ändert mobil nichts. **"Tour"** öffnet, **"Karte"** schließt das Sheet.

### 18.13 QR-Senden fehlt auf dem Smartphone

Kein Fehler. **"An Handy übergeben (QR)"** ist nur am Desktop sichtbar. Mobil
steht **"Tour vom Desktop scannen"** zur Verfügung.

### 18.14 QR-Scan funktioniert nicht

- Kamera-Berechtigung prüfen.
- Foto-Fallback verwenden.
- QR größer und Bildschirm heller anzeigen.
- bei **"Als Tour übernehmen"** müssen lokale Kunden erkannt werden.
- Navigation und Kalender können trotzdem direkt aus dem QR funktionieren.

### 18.15 Kalenderzeiten wirken falsch

Im Tour-Panel **"Datum"**, **"Start"** und **"Besuch (Min.)"** prüfen. Diese
Werte steuern Druck, ICS und QR. Fahrzeit bleibt eine Schätzung.

### 18.16 Kontaktname ist falsch

- Ansprechpartner statt Vertriebsbeauftragter zugeordnet?
- separate Kontaktdatei mit Kundennummer?
- Primärkontakt korrekt markiert?
- getrennte Kontaktdatei hat dieselbe Kundennummer wie der vorhandene Kunde?

### 18.17 Simulation lässt sich nicht übernehmen

- Gebiet ausgewählt?
- Ziel gewählt?
- **"Auswahl zuweisen"** bereits ausgeführt?
- gibt es einen Simulationsentwurf?

### 18.18 Daten fehlen auf einem anderen Gerät

Das ist erwartetes Verhalten. TourFuchs synchronisiert nicht automatisch.
Möglichkeiten:

- kompletter sicherer Umzug mit `.tfsafe` + getrenntem Schlüssel.
- nur geplante Tour per QR.
- Excel-Export und bewusster Neuimport.

### 18.19 PWA aktualisiert sich nicht

App fokussieren oder neu öffnen, Update-Hinweis abwarten, Seite neu laden. Bei
altem Namen alte PWA entfernen und neu installieren.

---

## 19. Häufige Fragen mit Musterantworten

### Ist TourFuchs eine Cloud-Anwendung?

> TourFuchs ist eine lokal-first PWA. Kundendaten liegen im Browser und werden
> nicht auf einen TourFuchs-Kundenserver synchronisiert. Bewusst gestartete
> Funktionen wie exakte Verortung, Straßenroute, Google Maps oder Copilot können
> die jeweils vorher beschriebenen Daten an externe Dienste übergeben.

### Werden meine Daten durch ein App-Update gelöscht?

> Nein. Das Update erneuert App-Dateien und Service Worker. IndexedDB und
> localStorage bleiben erhalten. Das Löschen allgemeiner Browserdaten kann lokale
> TourFuchs-Daten dagegen entfernen.

### Warum sehe ich mobil kein Cockpit?

> Das ist eine bewusste Produktentscheidung. Mobil konzentriert sich TourFuchs auf
> Karte, Kunden, Briefing, Tour und Navigation. Cockpit und Simulation sind für
> den größeren Desktop-Arbeitsraum ausgelegt.

### Kann ich CSV statt Excel verwenden?

> Ja. TourFuchs unterstützt Excel, CSV und ODS. Die Spaltenzuordnung muss auch bei
> automatisch erkannten Feldern geprüft werden.

### Was ist der Unterschied zwischen Vertriebsgruppe und Vertriebsbezirk?

> Die Vertriebsgruppe bündelt mehrere Bezirke und ist der empfohlene
> Vergleichsrahmen. Der Vertriebsbezirk ist die führende operative Ebene
> für Tourfilter, Farben, Cockpit und Zuweisungen. Beim Import ist er
> empfohlen, aber keine Pflicht: Kunden ohne Bezirk laufen unter
> "Ohne Zuordnung" und können später zugeordnet werden.

### Wann wird eine Simulation dauerhaft?

> Erst nach "Zuweisung übernehmen" und Bestätigung. "Auswahl zuweisen" verändert
> nur den temporären Simulationsstand.

### Kann ich nur den letzten Simulationsschritt zurücknehmen?

> Ja. "Ein Schritt zurück" nimmt die letzte Aktion zurück und kann mehrfach
> verwendet werden. "Simulation zurücksetzen" verwirft den gesamten Entwurf.

### Ist die Straßenroute eine Google-Maps-Route?

> Nein. Die Linie in TourFuchs wird von OSRM auf Basis von OpenStreetMap berechnet.
> Google Maps wird erst mit "In Google Maps navigieren" geöffnet.

### Warum weicht die geschätzte Strecke ab?

> Optimierung und Fahrzeit sind Schätzungen. Straßenführung, Verkehr,
> Sperrungen und reale Bedingungen können abweichen.

### Kann ich mehrere Kontakte pro Kunde importieren?

> Ja. Eine getrennte Kontaktdatei verknüpft Kontakte über die Kundennummer. Ein
> Kontakt kann als Primärkontakt markiert werden.

### Kann ich nach einer Stadt suchen?

> Ja, sofern mindestens ein Kundendatensatz diesen Ort enthält. TourFuchs sucht
> Kunden nach ihrem gespeicherten Ort; es springt nicht zu einer Stadt ohne
> passenden Kunden.

### Brauche ich für das Briefing eine Client-ID?

> Nein für den einfachen Basisweg. Dort kopiert TourFuchs den Prompt und öffnet
> Corporate Copilot. Nur die optionale direkte Profi-Verbindung benötigt eine
> Entra-SPA mit Client- und Tenant-ID.

### Sendet TourFuchs den Briefing-Prompt automatisch?

> Im Basisweg nein. Der Nutzer fügt ihn in Copilot ein und sendet selbst. Im
> konfigurierten Profiweg kann TourFuchs nach ausdrücklicher Zustimmung direkt
> senden.

### Kann ich Demo-Kunden wirklich anrufen oder per E-Mail kontaktieren?

> Nein. Die Schaltflächen bleiben zum Kennenlernen sichtbar, werden im
> Demomodus aber lokal abgefangen. Telefon-App und E-Mail-Programm öffnen sich
> nicht. Das Demo-Briefing ist ebenfalls nur eine lokale Ergebnisvorschau und
> löst keine Copilot-Suche aus.

### Warum fehlt der QR-Senden-Button mobil?

> Weil das Senden an das Smartphone nur am Desktop sinnvoll ist. Mobil kann eine
> Desktop-Tour mit "Tour vom Desktop scannen" empfangen werden.

---

## 20. Mini-Schulungen

### 20.1 TourFuchs in 5 Minuten

**Ziel:** Orientierung und erste Tour.

1. Demo-Daten laden.
2. **"Außendienst"** wählen.
3. **"Tour"** öffnen.
4. Vertriebsbezirk wählen.
5. Startpunkt setzen.
6. zwei Kunden hinzufügen.
7. Reihenfolge optimieren.
8. Route anzeigen.

**Abschlussfrage:** Wo wechselst du zwischen Luftlinie und Straßenroute?

### 20.2 Spontanes Kundenbriefing in 5 Minuten

**Ziel:** Unterwegs in weniger als einer Minute gesprächsbereit sein.

1. einen Kunden über Karte, Suche oder Chancen öffnen.
2. **"Briefing"** wählen.
3. Kundenidentität und Prompt kurz prüfen.
4. **"Prompt kopieren & Copilot öffnen"**.
5. im Corporate Copilot einfügen und bewusst senden.
6. `Jetzt wichtig`, `Gespräch`, `Handlung` und `Belege` lesen.

**Merksatz:** TourFuchs findet den richtigen Kundenkontext; Copilot verdichtet das
aktuelle interne Wissen.

### 20.3 Datenimport in 10 Minuten

**Ziel:** eigene Datei sicher importieren.

1. Felder erklären: Pflicht sind nur Kundenname und PLZ (oder Koordinaten);
   Vertriebsbezirk ist empfohlen, ohne ihn gilt "Ohne Zuordnung".
2. **"Eigene Daten laden"**.
3. Berechtigung bestätigen.
4. Datei öffnen.
5. Spaltenzuordnung prüfen.
6. importieren.
7. Ergebnis und Fehlerliste lesen.
8. Tresor-Angebot erklären.

**Merksatz:** Automatisch erkannt bedeutet nicht automatisch geprüft.

### 20.4 Gebiets-Cockpit in 10 Minuten

**Ziel:** einen Vertriebsbezirk bewerten.

1. **"Gebietsplanung"**.
2. **"Gebiete"**.
3. **"Gebiets-Cockpit öffnen"**.
4. Vertriebsgruppe wählen.
5. KPI-Karten lesen.
6. nach Umsatz und Kunden sortieren.
7. Top und Flop vergleichen.

### 20.5 Simulation in 15 Minuten

**Ziel:** eine Gebietsverschiebung sicher testen.

1. Landkreis-Ebene wählen.
2. Gebiet markieren.
3. Ziel wählen.
4. **"Auswahl zuweisen"**.
5. Umsatzwirkung lesen.
6. auf der Karte Alt/Neu/Änderungen vergleichen.
7. zurück ins Cockpit.
8. **"Ein Schritt zurück"** testen.
9. **"Simulation zurücksetzen"**.

**Merksatz:** Erst prüfen, dann übernehmen.

### 20.6 Mobile Tour in 10 Minuten

**Ziel:** unterwegs arbeitsfähig sein.

1. PWA im Hochformat öffnen.
2. **"Tour"** wählen und Sheet hochziehen.
3. Vertriebsbezirk wählen.
4. GPS-Start setzen.
5. Kunden im Umkreis anzeigen.
6. Kunden öffnen und Briefing zeigen.
7. Stopps hinzufügen.
8. Google Maps öffnen.

### 20.7 Datenschutz in 5 Minuten

Vier Ebenen erklären:

1. lokal: Kundendaten im Browser.
2. OSM-Dienste: nur neutrale Adresse oder Koordinaten nach Aktion.
3. Google Maps: bewusste Routenübergabe.
4. Copilot: sichtbare Kundenidentität und Tourkontext nach bewusster Aktion.

**Abschlussfrage:** Wann werden beim Basis-Briefing Daten an Microsoft gesendet?

---

## 21. Geführte Dialoge für den Guide

### 21.1 "Ich sehe meinen Kunden nicht"

> Ich grenze das kurz mit dir ein. Siehst du im Tab "Daten" eine Kundenzahl und
> eine Zahl bei "verortet"?

Danach:

- keine Daten -> Import erklären.
- Daten, aber nicht verortet -> PLZ/Koordinaten und Fehlerliste prüfen.
- verortet -> Filter und Tour-Bezirk prüfen.
- Filter korrekt -> globale Suche nutzen.

### 21.2 "Ich bin unterwegs und habe spontan Zeit"

> Öffne zuerst "Was ist in meiner Nähe?" oder die Kartenansicht "Chancen". Tippe
> einen passenden Kunden an und wähle "Briefing". TourFuchs bereitet den
> kundenspezifischen Prompt vor; in Corporate Copilot sendest du ihn selbst ab.

### 21.3 "Ich möchte mein internes Wissen nutzen"

> Das geht bereits ohne IT-Einrichtung über den Basisweg. Kunden-Popup ->
> "Briefing" -> "Prompt kopieren & Copilot öffnen". Für eine Antwort direkt in
> TourFuchs ist zusätzlich die optionale Entra-Verbindung im Profi-Modus nötig.

### 21.4 "Ich möchte Gebiete fairer verteilen"

> Nutze zuerst den Gruppenfokus im Cockpit. Vergleiche nur die Bezirke derselben
> Vertriebsgruppe und simuliere anschließend eine konkrete Verschiebung.

**Klickpfad:** `Gebietsplanung -> Gebiete -> Gebiets-Cockpit -> Vertriebsgruppe -> Simulation`.

### 21.5 "Ich möchte nichts kaputtmachen"

> Nutze die Simulation. "Auswahl zuweisen" ist nur ein Entwurf. Mit "Ein Schritt
> zurück" kannst du einzelne Aktionen rückgängig machen. Dauerhaft wird es erst
> nach "Zuweisung übernehmen".

### 21.6 "Ich habe eine Copilot-Excel mit Besuchsempfehlungen"

> Der Dateiimport funktioniert technisch, aber TourFuchs besitzt noch kein
> spezielles Empfehlungsschema. Für Kunden-Matching brauchst du vor allem die
> Kundennummer; für einen normalen Kundenimport außerdem Kundenname,
> PLZ/Koordinaten und Vertriebsbezirk. Priorität oder Begründung werden aktuell
> nicht automatisch als Tourentscheidung ausgewertet.

### 21.7 Screenshot-Fragen

Der Guide:

1. benennt zuerst den sichtbaren Bereich.
2. erklärt dessen Zweck.
3. nennt den nächsten sichtbaren Button statt ungenauer Koordinaten.
4. weist auf Modal, Scrollbereich, Basis/Profi oder Gerät hin.
5. fragt nur nach einem weiteren Screenshot, wenn das Ziel nicht erkennbar ist.

---

## 22. Agentenregeln und Wissensgrenzen

### 22.1 Regeln für gute Klickpfade

- mit Modus oder sichtbarem Einstieg beginnen.
- exakte Beschriftungen verwenden.
- höchstens sechs Ebenen pro Pfad.
- Tab, Bereich und Aktion unterscheiden.
- erwartetes Ergebnis nennen.
- bei Desktop/Mobil-Unterschieden Gerät explizit nennen.

Gut:

`Profi -> Kundenmarker -> "Briefing" -> "Expertenfall: Briefing direkt in TourFuchs"`.

Schlecht:

`Geh links irgendwo in die KI-Einstellungen.`

### 22.2 Kritische Aktionen

Vor folgenden Aktionen Wirkung und gegebenenfalls Datenschutz nennen:

- Daten löschen
- Datenbank zurücksetzen
- Zuweisung übernehmen
- Google Maps öffnen
- Adressen exakt verorten
- Straßenroute aktivieren
- Copilot-Prompt absenden
- vollständiger Kundenimport
- Tresor deaktivieren

### 22.3 Sensible Diagnose

Nicht den kompletten Kundendatensatz anfordern. Bevorzugen:

- anonymisierten Screenshot
- Spaltenüberschriften ohne Inhalte
- eine fiktive Beispielzeile
- genaue Fehlermeldung
- Gerät, Browser, Modus und Ansichtstiefe

### 22.4 Offen kommunizieren und eskalieren

Der Guide sagt offen, wenn:

- eine Funktion in diesem Stand nicht existiert.
- ein externer Dienst nicht erreichbar scheint.
- nur Entwicklungszugriff die Ursache klären kann.
- IT-/Administratorfreigabe erforderlich ist.
- Kundendaten für die Diagnose fehlen.
- eine Preview-API sich geändert haben könnte.

### 22.5 Verbindliche Nicht-Behauptungen

Nicht sagen:

- "TourFuchs sieht alle Ihre Microsoft-365-Daten."
- "Das Briefing wird immer automatisch erstellt."
- "Die App ist komplett offline."
- "Alle Daten bleiben immer im Browser", ohne die bewusst gestarteten
  Datenflüsse zu erwähnen.
- "Essen im Suchfeld öffnet die Stadt", wenn kein passender Kunde existiert.
- "Der QR-Sendeknopf muss auf dem Smartphone sichtbar sein."
- "Auswahl zuweisen ist bereits gespeichert."

---

## 23. Empfohlener Systemprompt

```text
Du bist der TourFuchs-Guide. Du erklärst TourFuchs Vertrieb fachlich korrekt,
freundlich, ruhig und handlungsorientiert. Verwende die sichtbaren Begriffe der
App und liefere Klickpfade im Format Modus -> Tab -> Bereich -> Aktion.

Unterscheide Desktop und Smartphone sowie Basis und Profi. Wenn der Kontext nicht
eindeutig ist und die Antwort davon abhängt, frage kurz nach dem Gerät oder der
Ansicht. Ansonsten antworte direkt.

Erkläre den Vertriebsbezirk als führende operative Ebene und die
Vertriebsgruppe als bevorzugten Vergleichsrahmen. Verwende "Betriebsbezirk" nur
als akzeptiertes Import-Synonym.

Behandle das spontane Kundenbriefing als zentralen Nutzen: Der Button "Briefing"
ist in Basis und Profi sichtbar. Im Basisweg zeigt und kopiert TourFuchs den
Prompt und öffnet Corporate Copilot; der Nutzer fügt ihn dort ein und sendet
selbst. Im Profi-Modus bleibt dieser einfache Weg zuerst sichtbar. Darunter kann
optional eine IT-registrierte Entra-SPA das Briefing direkt in TourFuchs
anfordern. Behaupte nie, dass TourFuchs Microsoft-Berechtigungen umgeht.

Erkläre TourFuchs als lokal-first. Kundendaten liegen im Browser, aber bewusst
gestartete Funktionen können begrenzte Daten an Nominatim, OSRM, Google Maps oder
Microsoft 365 Copilot übergeben. Nenne bei Datenschutzfragen den konkreten
Datenfluss statt einer pauschalen Aussage.

Weise klar darauf hin, dass Simulationsschritte erst durch "Zuweisung
übernehmen" dauerhaft werden. Vor Datenlöschung, vollständigem Kundenimport,
Geocodierung, Straßenroute, Google-Maps-Übergabe, Copilot-Absenden oder
dauerhafter Gebietszuweisung nennst du Wirkung und Datenschutzbezug.

Die globale Suche findet Kunden nach Name, gespeichertem Ort, PLZ oder exakter
Kundennummer. Sie ist keine allgemeine Ortssuche. Wenn ein Ort fehlt, empfehle die
Ortsspalte im nächsten vollständigen Kundenimport.

Erfinde keine Kundendaten, Funktionen, Menüpunkte, API-Verfügbarkeit oder
verbindlichen Fahrzeiten. Wenn ein Screenshot vorliegt, identifiziere zuerst den
sichtbaren Bereich und nenne danach den nächsten konkreten Klick. Bitte bei
sensiblen Fehlern um anonymisierte Beispiele statt um vollständige Daten.

Biete auf Wunsch eine Mini-Schulung mit Ziel, Dauer, Schritten, Merksatz und
Abschlussfrage an. Antworte auf Deutsch, wenn die Frage auf Deutsch gestellt wird.
```

---

## 24. Prüfungsfragen mit Soll-Antworten

1. **Welche Ebene ist operativ führend?**
   Vertriebsbezirk.
2. **Wann wird eine Simulation dauerhaft?**
   Nach **"Zuweisung übernehmen"** und Bestätigung.
3. **Was unterscheidet "Ein Schritt zurück" und "Simulation zurücksetzen"?**
   Ersteres nimmt die letzte Aktion zurück, letzteres den gesamten Entwurf.
4. **Welche Daten sendet die exakte Verortung?**
   Straße, PLZ und Ort.
5. **Welche Daten sendet sie nicht?**
   Name, Nummer, Umsatz, Kontakte und Vertriebsinformationen.
6. **Warum ist das Cockpit mobil nicht verfügbar?**
   Bewusster Fokus auf Karte, Kunden, Briefing und Tour.
7. **Wie wird die Straßenroute berechnet?**
   Über OSRM mit Koordinaten und ausdrücklicher Zustimmung.
8. **Was passiert bei OSRM-Ausfall?**
   Luftlinie bleibt als Fallback.
9. **Wozu dient die Kundennummer?**
   Eindeutige Zuordnung für getrennte Kontaktdateien und QR-Touren.
10. **Was vor Datenlöschung tun?**
    Bei Bedarf Excel-Export.
11. **Was bedeutet Alt/Neu/Änderungen?**
    Ausgangszustand, simulierter Zielzustand und hervorgehobene Differenz.
12. **Wann ist der letzte Kunde automatisch Ziel?**
    Wenn weder explizites Ziel noch Rundreise gesetzt ist.
13. **Bleiben lokale Daten beim PWA-Update erhalten?**
    Ja, solange nicht allgemeine Browserdaten gelöscht werden.
14. **Ist "Briefing" nur Profi?**
    Nein, der manuelle Weg ist in Basis und Profi sichtbar.
15. **Wann sendet der Basisweg Daten an Microsoft?**
    Erst wenn der Nutzer den Prompt in Copilot einfügt und absendet.
16. **Welche Daten sendet der direkte Profiweg nicht?**
    Vollständige Liste, Telefon, E-Mail, Umsatz und Koordinaten.
17. **Findet die Suche eine Stadt ohne Kunden?**
    Nein, sie findet Kunden anhand ihres gespeicherten Orts.
18. **Warum fehlt "An Handy übergeben" mobil?**
    Weil das Senden an das Smartphone nur am Desktop sinnvoll ist.
19. **Wann erscheint die Demo-Auswahl automatisch?**
    Gar nicht mehr. Sie öffnet nur auf Klick: im Willkommens-Panel über
    "Lieber zuschauen?" oder über Info -> "Funktionen entdecken".
20. **Welche Scrollwege hat das Desktop-Panel?**
    Mausrad, sichtbare Scrollbar und Ziehen auf funktionslosen Freiflächen.

---

## 25. Glossar

- **TourFuchs Vertrieb:** lokal-first PWA für Kundenkarte, Gebiete, Tour und
  Kundenbriefing.
- **Vertriebsbezirk:** führende operative Ebene; beim Import empfohlen, keine
  Pflicht (ohne Bezirk gilt "Ohne Zuordnung").
- **Betriebsbezirk:** akzeptiertes Import-Synonym für Vertriebsbezirk.
- **Erste Schritte:** lokale Onboarding-Checkliste in der Sidebar mit vier
  Punkten; ausklappbar, als Fortschrittszeile einklappbar, über Info umkehrbar
  abwählbar.
- **Service-Fokus:** Profi-Arbeitsfokus mit Vertragsradar, operativen
  Serviceeinsätzen und erklärbarem Tagesvorschlag.
- **Vertriebsgruppe:** übergeordneter Vergleichsrahmen.
- **Vertriebsbeauftragter:** Personenzuordnung, nicht führende Gebietsebene.
- **Flächenzeile:** Importzeile ohne Kundenname zur Gebietszuordnung.
- **Simulation:** temporäre Gebietsänderung bis zur Übernahme.
- **Bottom Sheet:** am Smartphone unten angedocktes Bedienpanel.
- **PWA:** installierbare Web-App mit Cache- und Offline-Anteilen.
- **PLZ-Mitte:** lokale näherungsweise Kartenposition.
- **Nominatim:** optionaler Dienst für exakte Adressverortung.
- **OSRM:** externer Dienst für Straßenroute auf OSM-Basis.
- **Corporate Copilot:** Microsoft 365 Copilot im Arbeitskonto.
- **Entra-SPA:** von der IT registrierte Browseranwendung ohne Client Secret.
- **Briefing:** kompakte, kundenspezifische Vorbereitung aus lokalem Kontext und
  berechtigtem Microsoft-365-Wissen.
- **Datentresor:** optionale lokale AES-256-Verschlüsselung.
- **`.tfsafe`:** verschlüsselte TourFuchs-Umzugsdatei.
- **T EUR:** Tausend Euro.
- **Korridor:** Abstand zur geplanten Route für Vorschläge.
- **Weißer Fleck:** Gebiet ohne Kunden und ohne Zuordnung.

---

## 26. Pflege und Änderungsprotokoll

### 26.1 Bei jeder Produktveränderung prüfen

- sichtbare Buttonnamen
- Basis-/Profi-Unterschiede
- Desktop-/Mobile-Unterschiede
- Onboarding- und Live-Demo-Regeln
- Importfelder und Matching
- Kunden-Popup und Suche
- Briefing-Prompt, Microsoft-URL, API-Status und Datenübergabe
- Tour-, QR- und Routinggrenzen
- Tresor- und Umzugslogik
- Datenschutzmatrix
- Diagnosebäume und Mini-Schulungen
- Systemprompt und Prüfungsfragen

### 26.2 Versionsregel

- Patch: Textkorrektur ohne geänderten Klickpfad.
- Minor: neuer Klickpfad oder neue Funktion.
- Major: neue Produktstruktur oder geänderte Datenschutzarchitektur.

### 26.3 Änderungen in Version 2.2

- Vertriebsbezirk beim Import von Pflicht auf "empfohlen" umgestellt; Verhalten
  "Ohne Zuordnung" und Hinweis im Importergebnis dokumentiert.
- automatisches 5-Sekunden-Angebot der Live-Demos entfernt; neue Klick-Einstiege
  (Willkommens-Panel "Lieber zuschauen?", Info) dokumentiert.
- neue "Erste Schritte"-Checkliste mit drei Zuständen (ausgeklappt, Zeile,
  umkehrbar abgewählt) inklusive Auto-Einklappen dokumentiert; "Daten löschen"
  setzt Fortschritt und Abwahl der Checkliste zurück.
- Service-Fokus als dritter Profi-Arbeitsfokus ergänzt: Vertragsradar,
  operative Serviceeinsätze, Kundenauswahl (Jetzt/Woche/Vertragskunden/Alle)
  und erklärbarer Tagesvorschlag.
- Klickpfad-Bibliothek, Schnellreferenz, FAQ, Glossar und Prüfungsfragen an das
  neue Onboarding- und Importverhalten angepasst.
- neue Live-Demo "Dein Service-Tag in 20 Sekunden" (Desktop) ergänzt; nach
  jeder Live-Demo kehren Ansichtstiefe und Arbeitsfokus zum vorherigen Stand
  zurück.
- Tablet-Verhalten als bewusste Entscheidung dokumentiert: keine eigene
  Tablet-Ansicht, ab ca. 800 px volles Desktop-Layout, darunter
  Smartphone-Verhalten.
- neuer Einstiegsabschnitt "Das große Bild in 30 Sekunden": eine App auf
  allen Geräten, Rollenverteilung Desktop (planen) gegen Smartphone
  (durchführen), ausdrücklich keine Cloud-Synchronisation (Übergabe per QR
  und `.tfsafe`).
- interne Korrektur der Umsatz-Einheitenerkennung (t€/k€ nur noch als
  eigenständige Einheit) - Nutzerhinweis: Gesamtsumme im Importergebnis prüfen.

### 26.4 Änderungen in Version 2.1

- Desktop-Einstieg **"Mobile Außendienst & Tour"** als Produktnutzen benannt.
- einmaligen, ruhigen Vorschau-Teaser nach vorhandenem Kundenbestand dokumentiert.
- Tour-Fokus beim Öffnen der Vorschau ergänzt, ohne Kundenkarte, Suche, Briefing
  oder Navigation als mobile Funktionen einzuschränken.
- Rückführung zum Smartphone-Symbol und Verhalten bei reduzierter Bewegung
  dokumentiert.
- automatische Live-Demo im eingebetteten Smartphone unterdrückt, damit kein
  Modal im Modal entsteht.
- gemeinsamen lokalen Datenbestand von Desktop und eingebetteter Vorschau
  klargestellt.

### 26.5 Änderungen in Version 2.0

- vollständige Zusammenführung der früheren PDF- und Markdown-Wissensbasis.
- neues Product-Owner-Kapitel mit priorisierten Wow-Effekten.
- Kundenbriefing in Basis und Profi komplett dokumentiert.
- kompakter 250-Wörter-Briefing-Prompt dokumentiert.
- optionaler Entra-/Graph-Profiweg inklusive Preview-Grenzen dokumentiert.
- neue Live-Demo **"Spontaner Termin? Sofort gebrieft"** ergänzt.
- verzögertes Onboarding und Reset-Verhalten nach Datenlöschung ergänzt.
- gerätespezifische Live-Demos und Abschlussdialoge ergänzt.
- Desktop-Panel: Mausrad, Scrollbar, Handziehen, Zoom und Verschieben ergänzt.
- mobile Bottom-Sheet-Bedienung korrigiert.
- Stadtsuche, PLZ-Ortsnamen und Anzeige **PLZ + Ort** dokumentiert.
- QR-Senden als Desktop-only und Mobile-Empfang dokumentiert.
- Datenschutz von pauschal "lokal" auf eine genaue Datenflussmatrix umgestellt.
- Diagnosebäume, Musterantworten, Mini-Schulungen und Systemprompt aktualisiert.

---

## 27. Schnellreferenz

| Thema | Verbindliche Kurzantwort |
|---|---|
| Architektur | eine PWA auf allen Geräten; keine Synchronisation - Übergabe per Tour-QR oder `.tfsafe` |
| Führende Ebene | Vertriebsbezirk (Import: empfohlen, keine Pflicht; sonst "Ohne Zuordnung") |
| Vergleichsrahmen | Vertriebsgruppe |
| Desktop | Daten, Karte, Tour, Gebiete, Cockpit, Simulation, QR-Senden |
| Smartphone | Karte, Kunden, Briefing, Tour, Navigation, QR-Empfang |
| Desktop-Handyvorschau | "Mobile Außendienst & Tour"; startet tourfokussiert, zeigt aber den vollständigen mobilen Außendienstweg |
| Basis | ruhiger Kernweg, Briefing inklusive |
| Profi | Ziel, Chancen, Exporte, Simulation und optionale Copilot-Automatisierung |
| Suche | Kunde nach Name, Ort, PLZ, exakter Nummer; keine allgemeine Ortssuche |
| Briefing Basis | Prompt anzeigen/kopieren, Copilot öffnen, Nutzer sendet selbst |
| Briefing Profi | optional direkt über Entra/Graph nach Zustimmung |
| Import-Matching | Kundennummer, sonst Name + PLZ |
| Ort | für Anzeige und Stadtsuche empfohlen |
| Lokale Daten | IndexedDB; Einstellungen/Sicherheitsmeta lokal |
| Geocoding | PLZ lokal, optional Nominatim mit neutraler Adresse |
| Straßenroute | OSRM mit Koordinaten nach Zustimmung |
| Navigation | bewusste Übergabe an Google Maps |
| Tour-QR | max. 12 Stopps, keine Kundendatenbank |
| Simulation | dauerhaft erst nach "Zuweisung übernehmen" |
| Undo | "Ein Schritt zurück", bis zu 30 Schritte |
| Tresor | AES-256, PIN, Recovery, optional Face/Touch ID |
| Sicherer Umzug | `.tfsafe` + getrennter Schlüssel-QR |
| Live-Demos | nur auf Klick: Willkommens-Panel "Lieber zuschauen?" oder Info |
| Erste Schritte | 4-Punkte-Checkliste; klappt beim Arbeiten zur Zeile ein; Abwahl über Info umkehrbar |
| Service-Fokus | Profi; Verträge + Einsätze getrennt, Join nur über Kundennummer; erklärbarer Tagesvorschlag |
| Tablet | keine eigene Ansicht: ab ca. 800 px volles Desktop-Layout, darunter Smartphone-Verhalten |
| Update | App-Dateien neu, lokale Daten bleiben erhalten |
| Vor Löschen | Export empfehlen |
