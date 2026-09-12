# 10: Refuse any stage other than production or a dev stage

**What to build:** The stack refuses to plan, deploy, or run under a stage name it does not expect, so a mistyped `--stage`, a missing flag, or a dev run against the wrong stage cannot create a second set of resources or touch production's by name.

**Blocked by:** 09 (End-to-end verification)

**Status:** done

- [x] The stack program reads the stage and refuses every name except `production` and, under `alchemy dev`, names starting with `dev_`
- [x] The refusal names the stage and says which names are allowed
- [x] `alchemy plan --stage production` and `alchemy dev` are unaffected; a plan under another name fails before any resource is touched
- [x] The README's deploy section mentions the guard

## Comments

Raised on 2026-09-11 after ticket 09: the first `alchemy dev` run declared the same Access resources as production in a dev stage, and Alchemy's Access Policy adopted the production policy by name and rewrote it. The dev stage no longer declares Access resources, but nothing yet stops a stray stage name from reaching Cloudflare.

Implemented on 2026-09-11. `guardStage` in `apps/infra/src/Stage.ts` runs first in the stack program: it reads Alchemy's `Stage` and `ALCHEMY_DEV` and dies with the stage name and the allowed names otherwise. Verified with `alchemy plan`: `production` plans with no changes, `staging` is refused, `dev_maxwellbrown` is refused without the dev flag and plans with it. No test: the guard has no seam below Alchemy's stack runtime, and the plan runs are the check.

Amended on 2026-09-12 by channel-points ticket 10: the guard also admits Alchemy's built-in `placeholder` stage, which `alchemy state ls` and `state read` open the stack under with no `--stage` to give; refusing it had made those commands unusable. Alchemy never defaults a deploy, plan, or dev run to that name, but a typed `--stage placeholder` would now pass, so the first box's "every name except" is one name weaker than written. `apps/infra/test/Stage.test.ts` pins the admitted set.
