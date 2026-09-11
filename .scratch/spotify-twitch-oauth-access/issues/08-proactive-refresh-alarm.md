# 08: Proactive refresh alarm and retry policy

**What to build:** Once a Connection is Authorized the Durable Object keeps it fresh on its own. A refresh runs five minutes before expiry, transient failures retry on a schedule, a rejected refresh token marks the Connection Reauthorization Required, and the Broadcaster Page shows the next refresh time and the last refresh error.

**Blocked by:** 07 (Token request with on-demand refresh)

**Status:** done

- [x] Accepting a token stores the next refresh time on the Connection and then sets the raw DO alarm for five minutes before expiry, with a minimum delay of one second
- [x] The alarm handler re-reads the stored next refresh time and runs the same refresh as ticket 07
- [x] Network failure or rate limit schedules retries after one, two, then four minutes, incrementing the retry count
- [x] After the short retries are exhausted, or on any other nonterminal error, a ten-minute retry is scheduled and the count reset
- [x] A non-rate-limit 4xx marks Reauthorization Required, clears the next refresh time, and deletes the alarm
- [x] A successful refresh resets the retry count, clears the last error, and schedules the next alarm
- [x] A new authorization replaces any pending schedule
- [x] The Connection records the last refresh error message and time; the Broadcaster Page shows next refresh time and last error
- [x] Alarm scheduling goes through a small alarm service so tests can observe scheduled times without workerd
- [x] Tests drive the alarm handler under `TestClock` through success, each retry tier, and the reauthorization transition

## Comments

Implemented on 2026-09-11. `RefreshAlarm` is a small service over the object's one alarm, with `schedule(at)` and `cancel`; production builds it from the raw workerd storage handle the `DurableObjectState` exposes, so the lifecycle can arm it from a token request or from the alarm itself without Alchemy's runtime context, and tests substitute `FakeRefreshAlarm`, which only remembers what it was armed for.

`ConnectionLifecycle` now installs every new token through one function: an Authorized Connection is written with `nextRefreshAt` at five minutes before expiry, never sooner than one second from now, and then the alarm is armed for that time, in that order so an evicted object resumes from what it stored; a Connection that cannot be refreshed is written with no `nextRefreshAt` and the alarm is disarmed. `accept` and both refresh paths use it, so a reconnect replaces any pending retry schedule and an on-demand refresh moves the alarm along with the expiry. A rejected refresh token now also clears `nextRefreshAt`, records the error, and disarms the alarm, on either path.

The alarm handler is `runScheduledRefresh`, exposed on the object as `alarm`, which Alchemy calls when the alarm rings. Under the lifecycle's lock it reads the Connection and does nothing when none is stored or none is scheduled, clears a stale schedule on a Connection that needs reauthorization, re-arms for the stored time when it rang early, and otherwise runs the same `refreshConnection` as ticket 07. A failure the Provider did not reject the token for is recorded on the Connection as a `RefreshError`, a message and a time, and retried: a network failure or rate limit after one, two, then four minutes, counting up; anything else, or a fourth momentary failure, after ten minutes with the count reset. The handler never fails, so the platform's own alarm retry never competes with this schedule.

`Connection.lastRefreshError` became the `RefreshError` struct; a stored document with `null` there still decodes, and nothing had written a string. `ConnectionSummary` carries `nextRefreshAt` and `lastRefreshError`, and the Broadcaster Page shows them under the expiry as "Next refresh at …" and "Last refresh error at …: …". `Provider` gained `isMomentary` next to `isClientRejection`, and `describeFailure` for the message.

Tests: `apps/api/test/ConnectionObject.test.ts` drives `completeAuthorization` and `alarm` directly under `TestClock`: the first schedule at expiry minus five minutes, the one-second floor, a reconnect replacing a retry schedule, no schedule without a refresh token, a ringing alarm refreshing and re-scheduling, a retry succeeding and resetting count and error, no Connection, an early ring, a stale schedule on a Reauthorization Required Connection, the full retry ladder for a network failure and a rate limit through one, two, four, ten, and back to one minute, the ten-minute retry for an outage and a malformed body, the recorded message, and the reauthorization transition disarming the alarm with a later ring left idle. The on-demand refresh test now checks the alarm moved, and the rejection test checks it was disarmed. Web scene tests cover the two new lines and their absence while Not Configured.

Review follow-up: the Provider display names moved to `providerLabels` beside `ProviderName` in the domain package, shared by `describeFailure` and the Broadcaster Page; `strugglingConnection` moved to the shared api fixtures; the failure table in the object tests now carries each failure's recorded message and whether it is momentary, so the retry-tier tests assert the concrete message rather than re-deriving `isMomentary`; `failedAt` became `refreshErrorOf`; the alarm handler's unschedule branch for a Connection with no usable refresh token now also writes Reauthorization Required, so the page can explain it; the handler's doc no longer claims it never fails, since a storage or alarm defect still reaches the platform. Not changed, by decision: the object does not re-arm the alarm from a stored `nextRefreshAt` when it is constructed, since the write-then-arm order is the spec's chosen guard and an object that dies between the two is left for ticket 09's live verification; an on-demand refresh that fails transiently still leaves the Connection as ticket 07 specified, so only the alarm path records `lastRefreshError`; the early-ring and stale-schedule branches stay as defensive handling of the spec's "re-reads the stored time" rule. Gap for `/domain-modeling`: the glossary's Connection entry does not yet mention the refresh schedule or the Refresh Error.
