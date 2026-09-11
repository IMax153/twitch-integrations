import type { ConnectionStatus } from "@twitch-integrations/domain/ConnectionStatus"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import { describeOperatorResult, type OperatorResult } from "./OperatorResult.ts"

export interface ProviderSection {
  readonly provider: ProviderName
  readonly status: ConnectionStatus
}

export interface OperatorPageInput {
  readonly sections: ReadonlyArray<ProviderSection>
  readonly result: OperatorResult | undefined
}

const providerLabels: Record<ProviderName, string> = {
  spotify: "Spotify",
  twitch: "Twitch",
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const renderResult = (result: OperatorResult | undefined): string => {
  if (result === undefined) {
    return ""
  }
  const message = describeOperatorResult(result)
  return `<p class="result ${message.kind}">${escapeHtml(message.text)}</p>`
}

const renderSection = ({ provider, status }: ProviderSection): string => {
  const action = status === "Not Configured" ? "Connect" : "Reconnect"
  return `<section data-provider="${provider}">
  <h2>${escapeHtml(providerLabels[provider])}</h2>
  <p class="status">${escapeHtml(status)}</p>
  <form method="post" action="/oauth/${provider}/authorize">
    <button type="submit">${action}</button>
  </form>
</section>`
}

export const renderOperatorPage = ({ sections, result }: OperatorPageInput): string =>
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Twitch Integrations</title>
</head>
<body>
  <h1>Connections</h1>
${renderResult(result)}
${sections.map(renderSection).join("\n")}
</body>
</html>
`
