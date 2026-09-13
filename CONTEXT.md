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
The one stored account authorization per Provider, holding the access token, refresh token, granted scopes, expiry, the time of its next scheduled refresh, and its last Refresh Error. Its status is Not Configured, Authorized, or Reauthorization Required.
_Avoid_: Token state, session, account link

**Refresh Error**:
What a Connection remembers of its most recent failed refresh: a message and the time it failed. The next successful refresh clears it.
_Avoid_: Failure, exception, last error

**Authorization Attempt**:
A one-use record created when the Broadcaster starts a Provider authorization. It is keyed by a random state value, bound to the Broadcaster's Access identity, and expires after ten minutes.
_Avoid_: OAuth state, login attempt, session

**Connected Account**:
The Provider-side identity (account ID and display name) that a Connection was authorized for, as reported by the Provider after authorization. Twitch's API calls its channel account the "broadcaster"; in this context that account is the Twitch Connected Account, and Broadcaster means the human.
_Avoid_: Owner, profile

**Reauthorization Required**:
The Connection status meaning the Provider rejected the refresh token and the Broadcaster must authorize again.
_Avoid_: Expired, revoked, broken

### Channel

**Channel**:
The deployment's view of the one connected Twitch channel: its Rewards, its Live or Offline state, and its Event Subscriptions. A Connection is the authorization; the Channel is what the deployment does with it.
_Avoid_: Stream, broadcaster (for the channel), handler

**Event Subscription**:
A registration with Twitch EventSub asking for one kind of notification about the Channel, such as a Redemption of a Reward or the stream going online. Distinct from a viewer subscribing to the channel.
_Avoid_: Subscription, listener, webhook

**Notification**:
One message Twitch delivered through an Event Subscription and the receiver verified: the stream going online or offline, a Redemption, a line of chat, or a revocation of the Event Subscription itself. Twitch may resend one under the same message ID, and the Channel acts on each message ID once.
_Avoid_: Event, webhook, payload, message (for the domain concept)

### Rewards and redemptions

**Reward**:
A custom channel point reward the deployment created and owns on the Twitch channel. Only the deployment can pause it or settle its Redemptions; rewards the Broadcaster made in the Twitch dashboard are not Rewards.
_Avoid_: Channel point, custom reward, incentive

**Redemption**:
One viewer's spend of channel points on a Reward, arriving with the viewer's input. The deployment ends every Redemption by fulfilling it or cancelling it, and cancelling refunds the points.
_Avoid_: Event, request, claim

**Held Redemption**:
A Redemption the Channel should have cancelled while the Twitch Connection had no token to give, kept with the reason it is there until the next reconcile cancels it. The only Redemption state stored after processing.
_Avoid_: Pending refund, retry, deferred

**Processing Queue**:
The Channel's stored, arrival-ordered list of Redemptions of the Reward it has not yet ended. A Redemption is on it from the moment the receiver is acknowledged until the Channel has fulfilled or cancelled it, one at a time. Distinct from the Spotify queue a Song Request adds a track to.
_Avoid_: Backlog, queue (alone), work queue

**Song Request**:
The Reward whose input is a Spotify track link, redeemed to add that track to the Broadcaster's Spotify queue.
_Avoid_: Song reward, track request, queue request

### Stream state

**Live**:
The channel state in which the Twitch Connected Account is streaming, learned from Twitch when the Twitch Connection is authorized and kept current from Twitch's online and offline notifications. Rewards can be redeemed only while Live.
_Avoid_: Online, streaming, on air

**Offline**:
The channel state in which the Twitch Connected Account is not streaming, or the deployment does not yet know. Rewards are paused, and any Redemption that still arrives is cancelled.
_Avoid_: Down, not live, unknown

### Chat

**Chat Command**:
A named reply the Broadcaster defines for the Channel's chat. A viewer invokes it by sending a chat message that, once trimmed, is exactly `!` followed by the name, matched case-sensitively; the deployment then answers that message in chat as the Twitch Connected Account with the Chat Command's fixed response text. A Chat Command is Enabled or Disabled; a Disabled one stays defined but is never answered. The Broadcaster creates, edits, disables, and deletes Chat Commands from the Broadcaster Page, and the name is fixed at creation. Distinct from a Foldkit command in the Broadcaster Page's code.
_Avoid_: Command (alone), bot command, trigger, canned reply, shortcut

**Invocation**:
One chat message that names a Chat Command exactly. An Invocation is answered unless the Chat Command is Disabled, in Cooldown, the message came from another channel in shared chat, or the Twitch Connection cannot send.
_Avoid_: Trigger, call, request

**Cooldown**:
The period after a Chat Command answers during which further invocations of it are ignored without reply. Editing the Chat Command ends any Cooldown in progress.
_Avoid_: Rate limit, throttle, debounce
