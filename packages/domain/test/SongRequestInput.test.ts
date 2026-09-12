import { assert, describe, it } from "@effect/vitest"
import { parseSongRequestInput } from "@twitch-integrations/domain/SongRequestInput"

describe("parseSongRequestInput", () => {
  const accepted: ReadonlyArray<[input: string, trackId: string]> = [
    ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "4uLU6hMCjMI75M1A2tKUQC"],
    [
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123&context=spotify%3Aplaylist",
      "4uLU6hMCjMI75M1A2tKUQC",
    ],
    ["http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "4uLU6hMCjMI75M1A2tKUQC"],
    ["open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "4uLU6hMCjMI75M1A2tKUQC"],
    ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC/", "4uLU6hMCjMI75M1A2tKUQC"],
    ["  https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC  ", "4uLU6hMCjMI75M1A2tKUQC"],
    ["https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC", "4uLU6hMCjMI75M1A2tKUQC"],
    ["spotify:track:4uLU6hMCjMI75M1A2tKUQC", "4uLU6hMCjMI75M1A2tKUQC"],
  ]

  for (const [input, trackId] of accepted) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      assert.deepStrictEqual(parseSongRequestInput(input), { _tag: "TrackLink", trackId })
    })
  }

  const refused: ReadonlyArray<string> = [
    "",
    "play something good",
    "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3",
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ",
    "https://open.spotify.com/track/",
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC/extra",
    "https://example.com/track/4uLU6hMCjMI75M1A2tKUQC",
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "spotify:album:1DFixLWuPkv3KT3TnV35m3",
    "spotify:track:",
    "spotify:track:not a track id",
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC and this one too",
  ]

  for (const input of refused) {
    it(`refuses ${JSON.stringify(input)}`, () => {
      assert.deepStrictEqual(parseSongRequestInput(input), { _tag: "NotATrackLink" })
    })
  }
})
