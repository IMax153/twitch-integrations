# Twitch Integrations

## Setup

## Useful Commands

**Create Twitch Custom Song Request Reward**

```sh
twitch-cli api post /channel_points/custom_rewards -q broadcaster_id=50829826 \
    -b '{
    "title":"Song Request",
    "cost":1,"prompt":"Add a song to the Spotify song queue to be played on stream. Please enter a link to a song on Spotify.",
    "is_user_input_required":true
}'
```

**Generate a Twitch Authorization Code**

```sh
twitch-cli token --user-token --scopes "user:write:chat channel:manage:redemptions"
```
