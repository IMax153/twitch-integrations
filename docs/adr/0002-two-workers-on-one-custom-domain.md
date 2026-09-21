---
status: accepted
---

# Two Workers share one custom domain, split by path, and both enroll in Access

ADR 0001 served the Broadcaster Page as the API Worker's static assets because, on a workers.dev hostname, a second Worker would have meant a second origin. With `minbadblue.com` on Cloudflare Registrar, the deployment moved to `twitch-integrations.minbadblue.com`: the API Worker owns the hostname as its custom domain, and the Broadcaster Page is its own Worker deployed with Alchemy's Foldkit integration on the `/setup*` route, with the API Worker keeping the more specific `/setup/api*` route. Same origin, one Access session, no build step inside the API Worker, and no hand-written asset mapping.

Access is applied by enrolling both Workers in one Access application rather than by hostname. A hostname-scoped application admits the request but leaves the Worker's `ctx.access` empty, which is the failure seen on the first deployment; enrolling the Worker is what populates it.

## Consequences

- Access now covers each enrolled Worker entirely, not only the `/setup` and `/oauth` prefixes. Nothing public lives on either Worker today. A future public path, such as an EventSub webhook, goes on a separate Worker or hostname, or is carved out with a hostname-scoped Access application that carries a bypass policy, since hostname-level policies take precedence over Worker-level ones.
- Both Workers have workers.dev URLs disabled so the custom domain is the only origin and the OAuth callback URL is stable.
- Under `alchemy dev` the Workers run on separate local ports; the web dev server proxies `/setup/api` and `/oauth` to the API Worker on port 1337.

## Amendment, 2026-09-11

The hostname moved from `twitch-integrations.minbadblue.com` to `stream.minbadblue.com`. Chrome's Safe Browsing flagged the Spotify authorize route on the old name as a lookalike site, and both Twitch and Spotify discourage their names in developer domains. Nothing else in this decision changes: the API Worker still owns the hostname as its custom domain, the Broadcaster Page keeps the `/setup*` route, and Access stays Worker-scoped, so the rename replaces only the custom domain and the two routes. The Provider callback URIs are re-registered under the new name.

## Amendment, 2026-09-12

The public EventSub path this record anticipated now exists as a third Worker, the receiver, on the route `stream.minbadblue.com/eventsub*`. It does not enroll in the Access application, so Access never sees its requests; Cloudflare routes take precedence over a custom domain on the same hostname, which is the same mechanism that already sends `/setup*` to the web Worker. The considered alternatives, a separate hostname or a hostname-scoped Access application with a bypass policy, were rejected because the first adds DNS and a certificate for one path and the second reintroduces the hostname-level application that left `ctx.access` empty. The receiver compensates for having no Access gate by answering one path and method, verifying Twitch's HMAC signature before reading anything else, refusing stale timestamps and oversized bodies, holding no Provider Credentials, and disabling its workers.dev URL. The consequence above that "nothing public lives on either Worker" still holds for the API and web Workers.

Twitch publishes no source IP ranges, so the route cannot be allowlisted; a zone rate-limiting rule stands in for the allowlist. Alchemy declares it as a `Cloudflare.Ruleset.Ruleset` owning the zone's `http_ratelimit` phase, over the zone adopted as a `Cloudflare.Zone.Zone` resource. The zone's Free plan allows one rule, matching on the path alone and counting by source IP per colocation (Cloudflare requires `cf.colo.id` among the characteristics) over a fixed ten-second period with a ten-second block, so the rule blocks any address that sends a hundred requests to `/eventsub*` in ten seconds, on any hostname in the zone, a rate no single channel's deliveries approach. It stops a flood from one address at the edge, before the Worker runs, and nothing else; the receiver's cheap refusals remain the answer to a distributed one. The rule needs the `zone-waf.write` scope on the Alchemy Cloudflare profile.

## Amendment, 2026-09-12: Broadcaster Page at the root

The Broadcaster Page now lives at `https://stream.minbadblue.com/`. Its web Worker takes the `/*` route and Vite builds assets with `/` as the base. The API Worker retains the custom domain and `/setup/api*`, and gains an explicit `/oauth*` route. Both API routes outrank the web catch-all; the explicit OAuth route is necessary because the custom domain alone no longer receives those requests. The public receiver's `/eventsub*` route also outranks the web catch-all.

Worker-scoped Access enrollment continues to protect the API and web Workers. The receiver remains unenrolled. Provider callback URLs remain under `/oauth/:provider/callback`, so no Provider configuration changes are needed. After an authorization attempt, the API redirects to `/?result=…`.

The web assets include exact 302 redirects from `/setup` and `/setup/` to `/`, preserving the query string. Using exact paths keeps `/setup/api/*` available; using temporary redirects permits a routing rollback without a cached permanent redirect. Local Vite continues to proxy `/setup/api` and `/oauth` to the API Worker.

## Amendment, 2026-09-21: the Overlay on a second public Worker

The Overlay is a fourth Worker on the route `stream.minbadblue.com/overlay*`, unenrolled from the Access application for the same reason the receiver is: OBS loads it as a browser source, which can send no headers and cannot hold an Access session across a stream, so neither an Access login nor a service token can gate it. In place of Access it is gated by the Overlay Key, a thirty-two byte secret in the URL that the Broadcaster issues from the Broadcaster Page and pastes into OBS. The Channel object keeps only the key's SHA-256 digest, compares it in constant time, and answers a wrong key with an empty 404 exactly as it answers an unknown path, so a scan learns nothing. The key is shown once, at issue, and rotating it from the page revokes the last.

The Worker compensates for having no Access gate the way the receiver does: it answers two GET paths and nothing else, binds the Channel object's namespace and no secret or Credential, disables its workers.dev URL, and never logs a request URL. What it serves holds no token and nothing about the Broadcaster: the track playing, its progress, and the next four queued, which is the whole exposure of a leaked key until it is rotated. Its page carries a Content Security Policy naming only its own inline style and script by nonce and Spotify's image host, and a no-referrer policy so the key never reaches that host in a Referer header; every answer is `no-store`, so a rotated key stops working at once.

The zone rate-limiting rule from the 2026-09-12 amendment now matches the Overlay's path prefix beside the receiver's. The Free plan allows one rule and the rule counts by source address, so the two public routes share one budget; the Overlay's only caller is the Broadcaster's own OBS polling every few seconds, well under it. The rule keeps its logical id so the deployed rule is updated rather than replaced.

Considered and rejected: a hostname-scoped Access application with a bypass policy for `/overlay*`, which is the configuration that left `ctx.access` empty on the first deployment; and a local proxy injecting an Access service token, which works but adds a daemon on the streaming machine for a page that exposes only track names.
