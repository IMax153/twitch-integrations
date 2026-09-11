# 08: Proactive refresh alarm and retry policy

**What to build:** Once a Connection is Authorized the Durable Object keeps it fresh on its own. A refresh runs five minutes before expiry, transient failures retry on a schedule, a rejected refresh token marks the Connection Reauthorization Required, and the Operator Page shows the next refresh time and the last refresh error.

**Blocked by:** 07 (Token request with on-demand refresh)

**Status:** ready-for-agent

- [ ] Accepting a token stores the next refresh time on the Connection and then sets the raw DO alarm for five minutes before expiry, with a minimum delay of one second
- [ ] The alarm handler re-reads the stored next refresh time and runs the same refresh as ticket 07
- [ ] Network failure or rate limit schedules retries after one, two, then four minutes, incrementing the retry count
- [ ] After the short retries are exhausted, or on any other nonterminal error, a ten-minute retry is scheduled and the count reset
- [ ] A non-rate-limit 4xx marks Reauthorization Required, clears the next refresh time, and deletes the alarm
- [ ] A successful refresh resets the retry count, clears the last error, and schedules the next alarm
- [ ] A new authorization replaces any pending schedule
- [ ] The Connection records the last refresh error message and time; the Operator Page shows next refresh time and last error
- [ ] Alarm scheduling goes through a small alarm service so tests can observe scheduled times without workerd
- [ ] Tests drive the alarm handler under `TestClock` through success, each retry tier, and the reauthorization transition
