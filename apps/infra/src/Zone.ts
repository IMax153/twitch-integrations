import { adopt } from "alchemy/AdoptPolicy"
import * as Cloudflare from "alchemy/Cloudflare"
import { zoneName } from "./Domain.ts"

/**
 * The zone the deployment lives in, as a stack resource so zone-scoped
 * resources such as rulesets can name it. The zone predates the stack and
 * carries no ownership marker, so it is adopted rather than created, and
 * Alchemy's default for zones retains it on destroy. The stack never
 * creates or deletes the zone; adoption reads it and keeps its type and
 * pause settings at their defaults, which is what they are.
 */
export const BroadcasterZone = Cloudflare.Zone.Zone("Zone", { name: zoneName }).pipe(adopt(true))
