# Serviceverträge in TourFuchs importieren

Der Service-Vertragsradar ist eine lokale Entscheidungs- und Frühwarnansicht. SAP, SieSales/Salesforce oder ein anderes Quellsystem bleiben führend. TourFuchs verändert keine Verträge und leitet keine rechtlich verbindlichen Fristen aus Freitext ab.

Der Service-Fokus ist ein optionales Modul. Er ist standardmäßig ausgeblendet und wird im Profi-Modus unten in der Gebietsplanung über das Häkchen „🛡️ Service-Modul anzeigen" eingeblendet.

## Grundprinzip

- Eine Zeile beschreibt genau einen aktuellen Vertrag.
- Eindeutiger Schlüssel ist `Quellsystem + Vertrags-ID`.
- Die Verbindung zum Kundenstamm erfolgt ausschließlich über die exakte `Kundennummer`.
- Führende Nullen in IDs müssen erhalten bleiben. In Excel sind ID-Spalten deshalb als Text formatiert.
- Ein Reimport ersetzt atomar nur die in der Datei enthaltenen Quellsysteme. Andere Vertragsquellen, Kunden, Gebiete, Besuche und Touren bleiben erhalten.
- Enthält eine Datei Fehler, bleibt der bisherige Vertragsbestand vollständig unverändert.
- Nicht zuordenbare Kundennummern werden gespeichert und sichtbar ausgewiesen. TourFuchs rät keine Zuordnung anhand von Name oder PLZ.

## Bevorzugtes Format

Excel (`.xlsx`) ist das bevorzugte Austauschformat. Das erste Tabellenblatt muss die Daten enthalten; in der Vorlage heißt es `Serviceverträge`.

- Kopfzeile in Zeile 1
- keine Titelzeilen, verbundenen Zellen oder Zwischensummen
- Datumswerte als echte Excel-Daten mit Anzeige `yyyy-mm-dd`
- IDs als Text
- Jahreswert als Zahl ohne Währungssymbol
- boolesche Werte vorzugsweise `JA` oder `NEIN`
- Quelllink als sichtbare, vollständige `https://`-Adresse im Zellwert
- Nicht zugeordnete Zusatzspalten werden aus Datenschutzgründen ignoriert und nicht lokal gespeichert

CSV wird ebenfalls unterstützt:

- UTF-8, Semikolon als empfohlenes Trennzeichen
- ISO-Daten `YYYY-MM-DD`
- Felder mit Semikolon oder Zeilenumbruch in doppelte Anführungszeichen setzen
- Zahlen innerhalb einer Spalte einheitlich schreiben

## Pflichtfelder

| Spalte | Bedeutung | Beispiel |
|---|---|---|
| `Quellsystem` | Herkunft und Namensraum des Vertrags | `SAP` |
| `Vertrags-ID` | stabile ID innerhalb des Quellsystems | `SC-004781` |
| `Kundennummer` | exakter Schlüssel zum TourFuchs-Kundenstamm | `0000102456` |
| `Status` | aktueller Vertragsstatus | `AKTIV` |
| `Datenstand` | fachlicher Stand des Quelldatensatzes | `2026-07-16` |
| `Unbefristet` | Vertrag besitzt kein festes Ende | `NEIN` |
| `Automatische Verlängerung` | automatische Verlängerung vereinbart | `JA` |

Zulässige Statuswerte sind `AKTIV`, `IN_VERLAENGERUNG`, `GEKUENDIGT`, `ABGELAUFEN`, `ENTWURF` und `PAUSIERT`.

## Bedingt erforderliche Felder

- `Vertragsende`, wenn `Unbefristet = NEIN`
- `Verlängerung (Monate)`, wenn `Automatische Verlängerung = JA`
- `Währung`, wenn ein `Jahreswert` angegeben ist

## Für den Radar besonders wichtig

`Handeln bis` ist die operative, fachlich geprüfte Frist. Sie sollte direkt aus dem verantwortlichen Prozess oder Quellsystem geliefert werden. Fehlt sie, zeigt TourFuchs bewusst „Frist fehlt“ an.

`Kündigungsstichtag` kann zusätzlich gepflegt werden. TourFuchs berechnet daraus aber keine juristische Aussage und interpretiert auch keinen Vertragsfreitext.

Weitere wertvolle Spalten sind:

- `Vertragsbezeichnung` und `Vertragstyp`
- `Vertragsbeginn` und `Vertragsende`
- `Jahreswert` und `Währung`
- `Vertragsmanager` und `Manager E-Mail`
- `Leistungsumfang`
- `SLA Reaktionszeit (Std.)` und `SLA Lösungszeit (Std.)`
- `Wartungsintervall (Monate)`
- `Servicekritikalität`
- `Quelllink`

## Datenqualität

TourFuchs blockiert insbesondere:

- fehlende Pflichtfelder
- ungültige Kalenderdaten
- doppelte Kombinationen aus Quellsystem und Vertrags-ID
- negative Jahreswerte
- befristete Verträge ohne Vertragsende
- automatische Verlängerungen ohne Verlängerungsdauer

Unsichere oder unvollständige, aber technisch nutzbare Angaben erscheinen als Warnung. Dazu gehören unbekannte Kundennummern, fehlende Handlungsfristen oder unplausible Datumsreihenfolgen.

## Datenschutz und Links

Die Vertragsdaten werden zusammen mit den Kundendaten lokal im Browser gespeichert und bei aktiviertem Datentresor mitverschlüsselt. Vollständige Vertragsdokumente gehören zunächst nicht in TourFuchs. Der `Quelllink` sollte auf das berechtigungsgeschützte Original in SAP, SieSales oder einer Dokumentenablage zeigen.

Eingebettete Excel-Hyperlinks mit einem beliebigen Anzeigetext sind nicht zuverlässig austauschbar. Deshalb muss die vollständige `https://`-Adresse als sichtbarer Zellwert in der Spalte `Quelllink` stehen.
