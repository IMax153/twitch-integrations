# Twitch Integrations

A single-broadcaster Cloudflare deployment that connects one shared Spotify account and one shared Twitch account and acts on their behalf during a stream. Viewers never authorize their own accounts.

## Language

### People and access

**Broadcaster**:
The single human who streams on the connected Twitch channel and is allowed through Cloudflare Access to manage the deployment.
_Avoid_: Operator, admin, user, owner

**Broadcaster Page**:
A browser page behind Cloudflare Access where the Broadcaster views and manages Connections.
_Avoid_: Setup page, admin panel, dashboard

### Providers and connections

**Provider**:
An external platform the deployment connects to. Currently Spotify or Twitch.
_Avoid_: Service, integration, platform

**Credentials**:
A Provider's client ID and client secret, issued to the Broadcaster's developer application and supplied as configuration.
_Avoid_: App keys, API keys, tokens

**Connection**:
The one stored account authorization per Provider, holding the access token, refresh token, granted scopes, and expiry. Its status is Not Configured, Authorized, or Reauthorization Required.
_Avoid_: Token state, session, account link

**Authorization Attempt**:
A one-use record created when the Broadcaster starts a Provider authorization. It is keyed by a random state value, bound to the Broadcaster's Access identity, and expires after ten minutes.
_Avoid_: OAuth state, login attempt, session

**Connected Account**:
The Provider-side identity (account ID and display name) that a Connection was authorized for, as reported by the Provider after authorization. Twitch's API calls its channel account the "broadcaster"; in this context that account is the Twitch Connected Account, and Broadcaster means the human.
_Avoid_: Owner, profile

**Reauthorization Required**:
The Connection status meaning the Provider rejected the refresh token and the Broadcaster must authorize again.
_Avoid_: Expired, revoked, broken
