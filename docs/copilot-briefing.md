# Copilot-Kundenbriefing lokal testen

Das Kundenbriefing verwendet die Microsoft 365 Copilot Chat API unter Microsoft Graph. Die API befindet sich im Juli 2026 weiterhin in der Preview und wird über den `/beta`-Endpunkt aufgerufen.

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

1. TourFuchs lokal starten und einen Kunden auf der Karte öffnen.
2. **Briefing** wählen.
3. Client-ID und Tenant-ID beziehungsweise Tenant-Domäne eintragen.
4. Die angezeigte Datenübergabe bestätigen.
5. Mit dem Entra-Arbeitskonto anmelden.

Die Kennungen werden nur lokal im Browser gespeichert. Das Zugriffstoken liegt im Sitzungsspeicher und wird von Microsoft Authentication Library verwaltet.

## 4. Erwartete Zustände

- **Anmeldung erfolgreich:** TourFuchs erstellt die Copilot-Unterhaltung, sendet den kundenspezifischen Prompt und zeigt Antwort sowie verfügbare Quellen im Dialog.
- **Administratorfreigabe erforderlich:** TourFuchs zeigt einen verständlichen Hinweis und lässt den fertigen Prompt alternativ in Corporate Copilot öffnen.
- **API oder Netzwerk nicht erreichbar:** derselbe Fallback bleibt verfügbar.
- **Keine Entra-Konfiguration:** der Prompt kann sofort kopiert und Corporate Copilot geöffnet werden; es werden keine Daten automatisch gesendet.

Die Websuche ist beim API-Aufruf ausgeschaltet. Das Briefing soll ausschließlich aus berechtigtem Microsoft-365-Wissen und dem ausdrücklich übergebenen TourFuchs-Kontext entstehen.
