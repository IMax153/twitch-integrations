# 05: Complete an authorization, happy path

**What to build:** After consent the Provider redirects the Operator back, the Worker exchanges the code, records which account was authorized, and returns the Operator to the Operator Page with a success message. The page now shows Authorized with the Connected Account, granted scopes, and expiry. Reconnecting replaces the previous Connection.

**Blocked by:** 04 (Start a Provider authorization)

**Status:** ready-for-agent

- [ ] A closed fake `HttpClient` test layer routes by hostname to fake Spotify and Twitch token and identity endpoints, refuses unknown origins, and takes its scenario from a control service the test sets
- [ ] `Provider.exchangeCode` submits the authorization code grant with the same callback URI; Spotify uses HTTP Basic client auth, Twitch puts client ID and secret in the form body
- [ ] `Provider.fetchConnectedAccount` calls Spotify's current user profile or Twitch's token validation and returns account ID and display name
- [ ] A `ConnectionLifecycle` service accepts a token response: keeps the previous refresh token if omitted, keeps previous scopes if omitted, computes absolute expiry from the response, sets Authorized, resets retries
- [ ] Accepting with no refresh token and none stored sets Reauthorization Required
- [ ] GET `/oauth/{provider}/callback` consumes the attempt with the current Access identity and request-derived callback URI, exchanges, fetches the Connected Account, accepts, and redirects to `/setup` with a success result
- [ ] The Operator Page shows Authorized, Connected Account, granted scopes, and expiry, and the button reads Reconnect
- [ ] A second successful authorization overwrites the previous Connection entirely
- [ ] No response body or header ever contains an access or refresh token
- [ ] Tests run the full path through the Worker harness for both Providers and assert on redirects, page contents, and what the fake Provider received
