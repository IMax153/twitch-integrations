# 02: Prefactor the fake HttpClient into per-hostname fake APIs

**What to build:** The test harness's fake HttpClient grows from "one token endpoint per Provider" into a router that sends each request to a fake API chosen by hostname: Twitch's token host, Twitch Helix, Spotify's accounts host, and Spotify's Web API. Each fake API takes its scenario from a control service the test sets, records every request it receives with method, URL, headers, and decoded body, and any unknown origin is refused. The existing OAuth tests keep passing over the new shape with no production code touched. This is the prefactor that lets every later ticket add Helix and Spotify endpoints without reshaping the harness again.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Requests are dispatched by hostname to a fake API, and an unknown hostname fails the request rather than reaching the network
- [x] Each fake API exposes a control service to set its scenario and a way to read the requests it received, oldest first
- [x] Recorded requests include a decoded JSON body as well as a decoded form body, since Helix and Spotify take JSON
- [x] The existing OAuth test suite passes without changes to its assertions
- [x] No production module changes
