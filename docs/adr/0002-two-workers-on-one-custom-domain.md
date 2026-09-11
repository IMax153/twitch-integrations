---
status: accepted
---

# Two Workers share one custom domain, split by path, and both enroll in Access

ADR 0001 served the Operator Page as the API Worker's static assets because, on a workers.dev hostname, a second Worker would have meant a second origin. With `minbadblue.com` on Cloudflare Registrar, the deployment moved to `twitch-integrations.minbadblue.com`: the API Worker owns the hostname as its custom domain, and the Operator Page is its own Worker deployed with Alchemy's Foldkit integration on the `/setup*` route, with the API Worker keeping the more specific `/setup/api*` route. Same origin, one Access session, no build step inside the API Worker, and no hand-written asset mapping.

Access is applied by enrolling both Workers in one Access application rather than by hostname. A hostname-scoped application admits the request but leaves the Worker's `ctx.access` empty, which is the failure seen on the first deployment; enrolling the Worker is what populates it.

## Consequences

- Access now covers each enrolled Worker entirely, not only the `/setup` and `/oauth` prefixes. Nothing public lives on either Worker today. A future public path, such as an EventSub webhook, goes on a separate Worker or hostname, or is carved out with a hostname-scoped Access application that carries a bypass policy, since hostname-level policies take precedence over Worker-level ones.
- Both Workers have workers.dev URLs disabled so the custom domain is the only origin and the OAuth callback URL is stable.
- Under `alchemy dev` the Workers run on separate local ports; the web dev server proxies `/setup/api` and `/oauth` to the API Worker on port 1337.
