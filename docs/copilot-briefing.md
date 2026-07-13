# Copilot-Kundenbriefing lokal testen

Das Kundenbriefing verwendet die Microsoft 365 Copilot Chat API unter Microsoft Graph. Die API befindet sich im Juli 2026 weiterhin in der Preview und wird über den `/beta`-Endpunkt aufgerufen.

## Nutzung in Basis und Profi

- **Basis:** Der Briefing-Knopf ist ohne Einrichtung verfügbar. TourFuchs zeigt den vollständigen kundenspezifischen Prompt, kopiert ihn auf Wunsch und öffnet Corporate Copilot. Der Nutzer fügt den Prompt dort selbst ein und sendet ihn bewusst ab.
- **Profi:** Die optionale Entra-Verbindung kann das Briefing automatisch anfordern und die Antwort direkt in TourFuchs anzeigen. Client-ID, Tenant-ID und Freigabehinweise erscheinen ausschließlich in diesem Modus.

Eine vorhandene API-Konfiguration ändert den Basisweg nicht. Basis bleibt immer beim transparenten manuellen Transfer.

## 1. Entra-Anwendung vorbereiten

In Microsoft Entra ID eine neue App-Registrierung für TourFuchs anlegen:

1. Kontotyp: nur Konten dieses Organisationsverzeichnisses.
2. Plattform: **Single-page application (SPA)**.
3. Redirect-URI: exakt die URI eintragen, die TourFuchs im Briefing-Dialog anzeigt, zum Beispiel `http://localhost:4183/`.
4. Kein Client Secret anlegen. Eine SPA darf kein Secret im Browser enthalten.

## 2. Delegierte Microsoft-Graph-Berechtigungen

Die Copilot Chat API verlangt derzeit alle folgenden delegierten Berechtigungen:

- `Sites.Read.All`
- `Mail.Read`
- `People.Read.All`
- `OnlineMeetingTranscript.Read.All`
- `Chat.Read`
- `ChannelMessage.Read.All`
- `ExternalItem.Read.All`

Diese Berechtigungen müssen in der Organisation voraussichtlich durch einen Administrator genehmigt werden. TourFuchs arbeitet immer im Namen des angemeldeten Nutzers. Copilot kann nur Inhalte berücksichtigen, auf die dieser Nutzer selbst zugreifen darf.

## 3. Lokaler Test

1. TourFuchs lokal starten und in die Ansicht **Profi** wechseln.
2. Einen Kunden auf der Karte öffnen und **Briefing** wählen.
3. Client-ID und Tenant-ID beziehungsweise Tenant-Domäne eintragen.
4. Die angezeigte Datenübergabe bestätigen.
5. Mit dem Entra-Arbeitskonto anmelden.

Die Kennungen werden nur lokal im Browser gespeichert. Das Zugriffstoken liegt im Sitzungsspeicher und wird von Microsoft Authentication Library verwaltet.

## 4. Erwartete Zustände

- **Anmeldung erfolgreich:** TourFuchs erstellt die Copilot-Unterhaltung, sendet den kundenspezifischen Prompt und zeigt Antwort sowie verfügbare Quellen im Dialog.
- **Administratorfreigabe erforderlich:** TourFuchs zeigt einen verständlichen Hinweis und lässt den fertigen Prompt alternativ in Corporate Copilot öffnen.
- **API oder Netzwerk nicht erreichbar:** derselbe Fallback bleibt verfügbar.
- **Basis:** der Prompt kann unabhängig von einer Entra-Konfiguration sofort kopiert und Corporate Copilot geöffnet werden; TourFuchs sendet dabei keine Daten automatisch.
- **Profi ohne Entra-Konfiguration:** TourFuchs bietet die technische Einrichtung und parallel den manuellen Fallback an.

Die Websuche ist beim API-Aufruf ausgeschaltet. Das Briefing soll ausschließlich aus berechtigtem Microsoft-365-Wissen und dem ausdrücklich übergebenen TourFuchs-Kontext entstehen.
