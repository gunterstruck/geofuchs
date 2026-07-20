# TourFuchs Vertrieb - Schulungsunterlagen

Stand: 20.07.2026

## 1. Ziel der Schulung

Diese Schulung befähigt Anwenderinnen und Anwender, TourFuchs Vertrieb sicher im Alltag einzusetzen. Nach der Schulung sollen die Teilnehmenden:

- Kundendaten aus Excel importieren und prüfen können
- die Karte, Filter und Suchfunktionen sicher bedienen
- Vertriebsbezirke und Vertriebsgruppen interpretieren können
- das Gebiets-Cockpit für Analyse und Was-wäre-wenn-Simulation nutzen können
- Besuchstouren auf Desktop und Smartphone planen können
- Datenschutz, lokale Speicherung und PWA-Verhalten verstehen
- typische Fehler selbst erkennen und beheben können

TourFuchs ist bewusst als lokale PWA gebaut: keine Anmeldung, keine Cloud-Datenbank, keine zentrale Speicherung der Kundendaten. Die Daten bleiben im Browser des jeweiligen Geräts.

## 2. Zielgruppen und Rollen

### Außendienst

Der Außendienst nutzt TourFuchs vor allem mobil:

- Kundenkarte öffnen
- Bezirk auswählen
- Kunden in der Nähe finden
- Tagesroute planen
- Route an Google Maps übergeben
- Kundeninformationen unterwegs ansehen

Auf Smartphones ist die App bewusst reduziert. Komplexe Gebietsplanung steht dort nicht im Mittelpunkt.

### Vertriebsleitung / Gebietsplanung

Die Gebietsplanung arbeitet primär am Desktop:

- Excel-Daten prüfen und importieren
- Gebiete auf der Karte analysieren
- Vertriebsbezirke vergleichen
- Vertriebsgruppen betrachten
- Kunden und Gebiete testweise umverteilen
- Simulation übernehmen oder verwerfen

### Datenverantwortliche

Diese Rolle achtet besonders auf:

- saubere Excel-Struktur
- Pflichtfelder
- Dubletten
- Datenschutz
- Berechtigung zur Verarbeitung der hochgeladenen Daten
- regelmäßige Exporte oder Löschung lokaler Daten, falls erforderlich

## 3. Grundprinzipien von TourFuchs

### Lokale PWA

TourFuchs läuft im Browser und kann als App installiert werden. Die App nutzt lokale Browser-Speicher:

- IndexedDB für Kundendaten, Gebietszuordnungen und Touren
- localStorage für Einstellungen
- Service Worker für App-Shell, Offline-Fähigkeit und Updates

Wichtig: Ein Browserwechsel, Gerätewechsel oder das Löschen der Browserdaten kann lokale Daten entfernen. Vor größeren Änderungen sollte ein Excel-Export erstellt werden.

### Desktop und Smartphone haben unterschiedliche Aufgaben

Desktop:

- Datenimport
- Gebietsplanung
- Cockpit
- Simulation
- Auswertung

Smartphone:

- Karte
- Tour
- Kundeninformationen
- Navigation

Das ist kein Nachteil, sondern eine Produktentscheidung: Analyse gehört an den großen Bildschirm, Navigation in die mobile Ansicht.

### Vertriebsbezirk ist führend

Der Vertriebsbezirk ist die zentrale operative Ebene. Er steuert:

- Gebietsfärbung
- Gebiets-Cockpit
- Tourfilter
- Zuständigkeit
- Simulation

Die Vertriebsgruppe ist eine sinnvolle übergeordnete Ebene. Sie dient dazu, Bezirke innerhalb einer Gruppe zu vergleichen und umzuverteilen. Persönliche Vertriebsnamen sind nicht leitend für die Gebietssteuerung.

## 4. Erste Orientierung in der Oberfläche

### Topbar

Oben befinden sich:

- Menü-Schalter
- TourFuchs-Logo
- Suche nach Kunde, Ort, PLZ oder Kundennummer
- Mobile-Vorschau
- Info und Rechtliches

### Moduswechsel

Links oben im Bedienpanel stehen zwei Hauptmodi:

- Außendienst
- Gebietsplanung

Der Modus bestimmt, welche Tabs sichtbar sind.

### Außendienst-Modus

Typische Tabs:

- Daten
- Filter
- Tour

Der Außendienst-Modus ist für Kundenkarte und Besuchsplanung optimiert.

### Gebietsplanung-Modus

Typische Tabs:

- Daten
- Filter
- Gebiete

Der Gebietsplanung-Modus ist für Analyse, Flächen, Cockpit und Simulation gedacht.

## 5. Installation als PWA

### Desktop

1. TourFuchs im Browser öffnen.
2. Browser-Menü öffnen.
3. App installieren wählen.
4. TourFuchs startet danach wie eine normale Anwendung.

### Smartphone

Android/Chrome:

1. TourFuchs im Browser öffnen.
2. Menü öffnen.
3. Zum Startbildschirm hinzufügen oder App installieren wählen.
4. App über das Homescreen-Symbol starten.

iPhone/Safari:

1. TourFuchs in Safari öffnen.
2. Teilen-Menü öffnen.
3. Zum Home-Bildschirm wählen.
4. App über das neue Symbol starten.

Hinweis: Wenn nach einer Umbenennung noch ein alter App-Name angezeigt wird, die alte PWA vom Homescreen entfernen und neu installieren.

## 6. Datenimport vorbereiten

### Pflichtfelder

Für eine sinnvolle Karte werden mindestens benötigt:

- Kundenname
- PLZ
- Vertriebsbezirk

Empfohlen sind zusätzlich:

- Straße und Hausnummer
- Ort
- Kundennummer
- Umsatz
- Vertriebsgruppe
- Ansprechpartner
- Telefon
- E-Mail
- Besuchsrhythmus
- letzter Besuch

### Spaltenlogik

TourFuchs erkennt viele Spaltennamen automatisch. Trotzdem sollten die Zuordnungen im Importdialog geprüft werden.

Beispiele:

| Bedeutung | Typische Spaltennamen |
|---|---|
| Kundenname | Firma, Kunde, Kundenname |
| PLZ | PLZ, Postleitzahl |
| Vertriebsbezirk | Vertriebsbezirk, Bezirk, Betriebsbezirk |
| Vertriebsgruppe | Gruppe, Vertriebsgruppe |
| Umsatz | Umsatz, Jahresumsatz |
| Ansprechpartner | Kontakt, Ansprechpartner |

### Compliance-Hinweis

Beim Upload muss bestätigt werden, dass die Daten verarbeitet werden dürfen. Das ist wichtig, weil TourFuchs lokal mit realen Kundendaten arbeitet.

## 7. Daten importieren

1. Tab Daten öffnen.
2. Excel-Liste hochladen wählen.
3. Datei auswählen oder per Drag and Drop ablegen.
4. Spaltenzuordnung prüfen.
5. Importieren wählen.
6. Import-Ergebnis kontrollieren.

Nach dem Import zeigt TourFuchs:

- importierte Kunden
- erkannte Ansprechpartner/Kontakte
- importierte Flächenzeilen
- übersprungene oder fehlerhafte Zeilen

Wenn Fehler erkannt werden, können diese als Fehlerliste heruntergeladen und in Excel korrigiert werden.

## 8. Demo-Daten nutzen

Für Schulungen empfiehlt sich der Demo-Modus:

1. App öffnen.
2. App in 60 Sekunden erleben wählen.
3. Demo-Daten laden.
4. Danach Übungen durchführen.

Vorteil: Alle Teilnehmenden sehen dieselbe Datenbasis, ohne echte Kundendaten verwenden zu müssen.

## 9. Karte verstehen

### Kundenpunkte

Kunden erscheinen als Marker auf der Karte. Je nach Ansicht können Marker clustern, also als Zahl zusammengefasst werden.

Klick auf einen Kunden zeigt:

- Kundenname
- Adresse
- Bezirk/Gruppe
- Umsatz
- Kontaktoptionen, sofern vorhanden
- Besuchsstatus
- Aktionen wie zur Tour hinzufügen

### Gebietsflächen

In der Gebietsplanung können Flächen eingeblendet werden:

- Landkreise
- PLZ 1-stellig
- PLZ 2-stellig
- PLZ 3-stellig
- PLZ 5-stellig

Die automatische Ansicht entscheidet abhängig vom Zoom, welche Ebene sinnvoll ist.

### Kartenstil

Der Kartenstil kann gewechselt werden:

- Hell
- Standard
- Satellit

Hell ist am besten für Datenanalyse. Standard und Satellit helfen bei realer Orientierung.

## 10. Filter und Ebenen

TourFuchs arbeitet mit einer Gebietshierarchie:

- Vertriebschannel optional
- Vertriebsgruppe empfohlen
- Vertriebsbezirk Pflicht

Für den Alltag ist besonders wichtig:

- Vertriebsbezirk ist die führende operative Ebene.
- Vertriebsgruppe dient als Gruppierung für Vergleich und Umverteilung.
- Weitere Ebenen sollten nur eingeblendet werden, wenn sie fachlich gebraucht werden.

## 11. Gebietsplanung am Desktop

### Gebietsebene wählen

Im Tab Gebiete:

1. Ebene wählen, zum Beispiel Landkreise.
2. Ansicht und Farbe wählen.
3. Karte betrachten.
4. Gebiet anklicken, um Details zu sehen.

Typische Fragestellungen:

- Welche Bezirke sind räumlich zusammenhängend?
- Wo gibt es weiße Flecken?
- Wo liegen viele Kunden eines anderen Bezirks?
- Welche Gebiete haben hohen Umsatz?

### Automatische Ansicht

Die automatische Ansicht reduziert visuelle Überladung:

- weit herausgezoomt: grobe Gruppenansicht
- mittlerer Zoom: Vertriebsbezirke
- naher Zoom: einzelne Kunden

## 12. Gebiets-Cockpit

Das Gebiets-Cockpit ist das Analysezentrum für die Gebietsplanung.

### KPI-Karten

Oben stehen drei Kacheln:

- Status
- Top-Bezirk
- Schwächster Bezirk

Die Zahl steht im Vordergrund. Der Bezirk ist die Subline. Dadurch erkennt man sofort, wo Handlungsbedarf besteht.

### Tabelle Top & Flop 3

Standardmäßig zeigt die Tabelle:

- die drei stärksten Bezirke
- die drei schwächsten Bezirke

Zwischen Top und Flop gibt es eine visuelle Trennung. Über Alle anzeigen kann die komplette Liste geöffnet werden.

### Sortierung

Die Tabelle startet mit Umsatz, weil Umsatzunterschiede sofort sichtbar werden. Mögliche Sortierungen:

- Kunden
- Umsatz
- Name A-Z

Die Balken zeigen relative Stärke zum stärksten sichtbaren Wert. Bei Umsatzsortierung bekommt der höchste Umsatz 100 Prozent, die anderen Bezirke werden relativ dazu skaliert.

## 13. Arbeiten innerhalb einer Vertriebsgruppe

In der Praxis wird meistens innerhalb einer Vertriebsgruppe verglichen und umverteilt.

Beispiel:

- Vertriebsgruppe Nord auswählen
- nur Vertriebsbezirke dieser Gruppe betrachten
- Kunden und Umsatz innerhalb dieser Gruppe vergleichen
- Gebiete innerhalb dieser Gruppe neu zuordnen

Fachliches Ziel:

- kein unnötiger Vergleich über ganz Deutschland
- bessere lokale Fairness
- weniger visuelle Überladung
- klare Verantwortung pro Vertriebsgruppe

Empfohlener Schulungssatz:

> Wir planen nicht abstrakt alles gegen alles. Wir optimieren zuerst innerhalb der Vertriebsgruppe, weil dort die operative Verantwortung liegt.

## 14. Was-wäre-wenn-Simulation

Die Simulation erlaubt testweise Umverteilungen, ohne sofort echte Daten zu verändern.

### Ablauf

1. Gebiets-Cockpit öffnen.
2. Ebene wählen, zum Beispiel Landkreise.
3. Optional Suche oder PLZ-Präfix eingeben.
4. Gebiete auswählen.
5. Ziel-Bezirk wählen.
6. Auswahl zuweisen.
7. KPI-Karten und Tabelle prüfen.
8. Bei gutem Ergebnis Zuweisung übernehmen.
9. Bei schlechtem Ergebnis Simulation zurücksetzen.

### Button-Hierarchie

- Auswahl zuweisen: Zwischenschritt innerhalb der Simulation
- Simulation zurücksetzen: leise Abbruchaktion
- Zuweisung übernehmen: finale dauerhafte Aktion

Die finale Übernahme ist bewusst deutlich hervorgehoben.

### Wichtige Regel

Erst Zuweisung übernehmen schreibt die Änderung dauerhaft in die Daten. Vorher ist es nur Simulation.

## 15. Flächenzeilen

Flächenzeilen sind Zeilen ohne Kundenname, aber mit Gebiet und Vertriebsbezirk.

Beispiele:

- Landkreis Oberhausen soll Bezirk Rheinland zugeordnet werden
- PLZ 46 soll Bezirk West zugeordnet werden
- PLZ 46045 soll exakt einem Bezirk zugeordnet werden

Nutzen:

- Gebiete können geplant werden, auch wenn noch keine Kunden vorhanden sind.
- Weiße Flecken können bewusst reserviert werden.
- Neue Kunden fallen später in eine vorbereitete Struktur.

## 16. Außendienst: Besuchsplanung

### Bezirk wählen

Im Tour-Tab wird ein Vertriebsbezirk gewählt. TourFuchs schlägt dann nur Kunden aus diesem Bezirk vor.

Vorteile:

- keine fremden Kunden in der Vorschlagsliste
- klare Verantwortung
- weniger Suchaufwand

### Startpunkt

Mögliche Startpunkte:

- eigener Standort
- Kunde
- Karten-Popup

Wenn der Startpunkt fehlt, können keine sinnvollen Vorschläge berechnet werden.

### Vorschläge

TourFuchs kann Kunden vorschlagen:

- im Umkreis um den Start
- entlang einer geplanten Route

Der Umkreis kann eingestellt werden. Überfällige Kunden können priorisiert werden.

### Meine Tour

Kunden werden der Tour hinzugefügt. Danach kann die Reihenfolge optimiert werden.

Funktionen:

- Reihenfolge optimieren
- Karte auf Tour fokussieren
- Route anzeigen
- Google Maps Navigation öffnen
- Tour speichern
- Tagesplan drucken
- Kalenderdatei exportieren
- Tour als Text kopieren

## 17. Rundreise und Ziel

Wenn Rundreise aktiviert ist, wird der Startpunkt auch als Ziel behandelt.

Ohne Rundreise gilt:

- wenn ein Ziel gewählt wurde, endet die Tour dort
- ohne Ziel ist der letzte Stopp automatisch das Ziel

Das verhindert unklare Tourenden.

## 18. Mobile Bedienung

Auf Smartphones ist TourFuchs bewusst reduziert:

- Karte
- Tour

Komplexe Gebietsplanung wird ausgeblendet. Stattdessen informiert ein Hinweis, dass komplexe Gebietsplanung am Desktop erfolgt.

### Bottom Sheet

Das mobile Tour-Panel kann in Stufen bewegt werden:

- minimiert
- halb offen
- voll geöffnet

Damit bleibt die Karte sichtbar, während Tourdaten zugänglich sind.

### Hochformat

TourFuchs ist für Smartphone-Hochformat optimiert. Im Querformat erscheint ein Hinweis.

## 19. Updates der PWA

TourFuchs prüft regelmäßig auf Updates:

- beim Start
- in Intervallen
- wenn die App wieder in den Fokus kommt

Wenn ein Update verfügbar ist, erscheint ein dezenter Hinweis. Lokale Daten in IndexedDB und localStorage bleiben erhalten.

## 20. Datenschutz und Sicherheit

### Lokale Speicherung

Kundendaten bleiben lokal im Browser. Es gibt keinen TourFuchs-Server, der Kundendaten empfängt.

### OpenStreetMap/Nominatim

Bei optionaler adressgenauer Verortung werden nur neutrale Adressdaten gesendet:

- Straße
- PLZ
- Ort

Nicht gesendet werden:

- Kundenname
- Umsatz
- Ansprechpartner
- Telefonnummer
- E-Mail

### Google Maps

Bei Übergabe an Google Maps verlassen Routendaten die App. Ab diesem Moment gelten die Datenschutzbedingungen von Google.

## 21. Daten löschen und neu beginnen

Wenn neu gestartet werden soll:

1. Daten-Tab öffnen.
2. Daten löschen wählen.
3. Bestätigung sorgfältig prüfen.
4. Neue Excel-Datei importieren.

Vorher empfiehlt sich ein Excel-Export, wenn die Daten noch gebraucht werden.

## 22. Typische Fehler und Lösungen

### Kunden erscheinen nicht auf der Karte

Mögliche Ursachen:

- PLZ fehlt
- PLZ ist ungültig
- Spalte wurde falsch zugeordnet
- Kunde wurde durch Filter ausgeblendet
- falscher Modus aktiv

### Gebiet ist nicht eingefärbt

Mögliche Ursachen:

- keine Vertriebsbezirk-Spalte
- Ebene auf Keine Gebiete
- Ansicht und Farbe unpassend eingestellt
- Gebiet ohne Kunden nicht zugeordnet

### Tourvorschläge fehlen

Mögliche Ursachen:

- kein Startpunkt
- falscher Bezirk gewählt
- Radius zu klein
- alle passenden Kunden bereits in der Tour
- Filter zu eng

### PWA zeigt alten Namen

Lösung:

1. Alte PWA vom Homescreen entfernen.
2. Browser neu laden.
3. App neu installieren.

### Update erscheint nicht

Lösung:

- App schließen und neu öffnen
- Browser-Tab neu laden
- Update-Hinweis abwarten
- bei Bedarf alte PWA neu installieren

## 23. Schulungsablauf für Trainer

### Empfohlene Dauer

Gesamtdauer: 2,5 bis 3,5 Stunden

### Modul 1: Einführung (15 Minuten)

Inhalte:

- Was ist TourFuchs?
- Desktop vs. Mobile
- lokale Speicherung
- Vertriebsbezirk als führende Ebene

### Modul 2: Datenimport (30 Minuten)

Inhalte:

- Excel-Struktur
- Pflichtfelder
- Importdialog
- Plausibilitätsprüfung
- Fehlerliste

Übung:

- Demo-Daten laden
- Spaltenzuordnung erklären
- Import-Ergebnis interpretieren

### Modul 3: Karte und Filter (30 Minuten)

Inhalte:

- Kundenmarker
- Suche
- Kartenstil
- Filter
- Bezirksauswahl

Übung:

- Kunden suchen
- Bezirk auswählen
- Karte zoomen
- Kartenstil wechseln

### Modul 4: Gebietsplanung (45 Minuten)

Inhalte:

- Gebietsebene
- Vertriebsgruppe
- Vertriebsbezirk
- Flächen
- Gebiets-Popup

Übung:

- Landkreise anzeigen
- Vertriebsbezirke einfärben
- Gebiet anklicken
- Umsatzsumme interpretieren

### Modul 5: Gebiets-Cockpit und Simulation (45 Minuten)

Inhalte:

- KPI-Karten
- Top & Flop 3
- Umsatzsortierung
- dynamische Balken
- Simulation
- Übernehmen vs. Zurücksetzen

Übung:

- Cockpit öffnen
- Top-Bezirk und schwächsten Bezirk benennen
- ein Gebiet testweise zuweisen
- Ergebnis prüfen
- Simulation zurücksetzen

### Modul 6: Tourplanung (45 Minuten)

Inhalte:

- Bezirk wählen
- Startpunkt
- Vorschläge
- Tour zusammenstellen
- Reihenfolge optimieren
- Navigation

Übung:

- Startpunkt setzen
- Kunden im Umkreis finden
- drei Kunden zur Tour hinzufügen
- optimieren
- Route auf Karte ansehen
- Google Maps Übergabe erklären

### Modul 7: Mobile PWA (20 Minuten)

Inhalte:

- Installation
- Bottom Sheet
- Karte und Tour
- warum Gebietsplanung mobil reduziert ist

Übung:

- App installieren oder mobile Vorschau nutzen
- Tour-Panel bewegen
- Kunden-Popup öffnen

### Modul 8: Datenschutz und Betrieb (15 Minuten)

Inhalte:

- lokale Datenhaltung
- OSM-Geocoding
- Google Maps Übergabe
- Daten löschen
- Updates

## 24. Übungsaufgaben

### Aufgabe 1: Import prüfen

Lade Demo-Daten oder eine Schulungsdatei und prüfe:

- Wie viele Kunden wurden importiert?
- Gibt es Fehler?
- Welche Spalten wurden automatisch erkannt?

### Aufgabe 2: Bezirk analysieren

Wähle einen Vertriebsbezirk und beantworte:

- Wie viele Kunden liegen im Bezirk?
- Wo liegen Cluster?
- Gibt es auffällige Ausreißer?

### Aufgabe 3: Cockpit lesen

Öffne das Gebiets-Cockpit:

- Welcher Bezirk hat den höchsten Umsatz?
- Welcher Bezirk ist schwächster Bezirk?
- Wie stark unterscheidet sich der Balken?

### Aufgabe 4: Simulation durchführen

Wähle ein Gebiet aus und weise es testweise einem anderen Bezirk zu:

- Ändern sich KPI-Karten?
- Ändert sich die Tabelle?
- Würdest du übernehmen oder zurücksetzen?

### Aufgabe 5: Tour planen

Plane eine Tour:

- Bezirk wählen
- Startpunkt setzen
- Kunden im Umkreis finden
- mindestens drei Kunden hinzufügen
- Reihenfolge optimieren
- Route anzeigen

## 25. Prüfungsfragen

1. Welche Ebene ist in TourFuchs führend?
2. Wo werden Kundendaten gespeichert?
3. Wann werden Daten dauerhaft geändert?
4. Warum ist die Gebietsplanung auf dem Smartphone reduziert?
5. Was bedeutet der Balken im Cockpit?
6. Was ist der Unterschied zwischen Auswahl zuweisen und Zuweisung übernehmen?
7. Welche Daten werden bei optionaler OSM-Geocodierung gesendet?
8. Was sollte vor dem Löschen lokaler Daten gemacht werden?

## 26. Antworten zu den Prüfungsfragen

1. Der Vertriebsbezirk.
2. Lokal im Browser, vor allem IndexedDB.
3. Erst nach Zuweisung übernehmen.
4. Weil komplexe Analyse am Desktop sinnvoller ist und mobile Nutzung auf Tour/Karte fokussiert ist.
5. Relative Stärke zum stärksten sichtbaren Wert, abhängig von der Sortierung.
6. Auswahl zuweisen ist Simulation; Zuweisung übernehmen schreibt dauerhaft.
7. Nur neutrale Adressdaten wie Straße, PLZ und Ort.
8. Ein Excel-Export, falls die Daten noch gebraucht werden.

## 27. Trainer-Hinweise

- Nicht mit echten Kundendaten starten, sondern mit Demo-Daten.
- Früh erklären, dass TourFuchs lokal arbeitet.
- Desktop- und Mobile-Nutzung bewusst trennen.
- Beim Cockpit zuerst die KPI-Karten erklären, dann die Tabelle.
- Simulation langsam vorführen: erst testen, dann übernehmen.
- Bei Datenschutzfragen klar zwischen lokaler App, OSM und Google Maps unterscheiden.

## 28. Empfohlene Schulungsbotschaften

- TourFuchs ersetzt keine CRM-Strategie, sondern macht vorhandene Kundendaten räumlich nutzbar.
- Vertriebsbezirk ist die operative Wahrheit.
- Die Vertriebsgruppe ist der sinnvolle Rahmen für Vergleiche.
- Nicht jede Analyse gehört aufs Handy.
- Eine Simulation ist erst dann echt, wenn sie übernommen wird.
- Datenschutz beginnt beim sauberen Import und endet beim bewussten Export oder Löschen.

