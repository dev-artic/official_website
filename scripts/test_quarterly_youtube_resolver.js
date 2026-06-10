const assert = require("assert");
const { resolveYoutubeAlbumTracks } = require("../functions/quarterly_youtube");

async function run() {
  const calls = [];
  const mockYoutubeApi = async (pathname, params) => {
    calls.push({ pathname, params });

    if (pathname === "/search" && params.type === "playlist") {
      return {
        items: [{
          id: { playlistId: "playlist-unofficial" },
          snippet: {
            title: "K-R&B fresh picks",
            channelTitle: "Random Music Playlist",
            description: "A fan playlist with popular tracks.",
          },
        }],
      };
    }

    if (pathname === "/playlistItems") {
      return {
        items: [{
          snippet: {
            title: "DeVita - Amen lyrics",
            channelTitle: "Random Music Playlist",
            resourceId: { videoId: "badLyrics01" },
          },
        }],
      };
    }

    if (pathname === "/search" && params.type === "video") {
      return {
        items: [
          {
            id: { videoId: "badLyrics01" },
            snippet: {
              title: "DeVita - Amen lyrics",
              channelTitle: "Random Music Playlist",
              description: "Unofficial lyrics video.",
            },
          },
          {
            id: { videoId: "official01A" },
            snippet: {
              title: "Amen",
              channelTitle: "DeVita - Topic",
              description: "Provided to YouTube by Genie Music Corporation. Amen · DeVita · The Tree is Burning.",
            },
          },
        ],
      };
    }

    throw new Error(`Unexpected mock YouTube call: ${pathname}`);
  };

  const result = await resolveYoutubeAlbumTracks({
    album: "The Tree is Burning",
    artist: "DeVita",
    tracks: "#3 Amen",
    apiKey: "test-key",
    youtubeApiClient: mockYoutubeApi,
  });

  assert.strictEqual(result.candidates.length, 1, "expected one resolved candidate");
  assert.strictEqual(result.candidates[0].youtubeId, "official01A", "official Topic audio should beat search-rank/playlist result");
  assert.strictEqual(result.candidates[0].source, "official-video-search");
  assert.strictEqual(result.candidates[0].confidence, "high");
  assert.ok(calls.some((call) => call.pathname === "/search" && call.params.type === "video"), "expected direct video search calls");

  console.log("Test Case 1 (DeVita) passed");

  // Test Case 2: Dimo Rex - Too Close (feat. 수엔(SUEN))
  // Resolving Too Close from a playlist containing both an unofficial fan upload and an official Topic upload.
  const dimoRexCalls = [];
  const mockDimoRexYoutubeApi = async (pathname, params) => {
    dimoRexCalls.push({ pathname, params });

    if (pathname === "/search" && params.type === "playlist") {
      return {
        items: [{
          id: { playlistId: "playlist-dimorex-fan" },
          snippet: {
            title: "Korean R&B Chill Vibes",
            channelTitle: "Fan Curator",
            description: "Nice songs.",
          },
        }],
      };
    }

    if (pathname === "/playlistItems") {
      return {
        items: [
          {
            snippet: {
              title: "[HAN/ENG] 03. DIMO REX - TOO CLOSE (feat. 수엔 SUEN)",
              channelTitle: "Fan Curator",
              videoOwnerChannelTitle: "KORBIT",
              resourceId: { videoId: "oYpxE0bXhVI" },
            },
          },
          {
            snippet: {
              title: "TOO CLOSE (feat. Suen)",
              channelTitle: "Fan Curator",
              videoOwnerChannelTitle: "DIMO REX - Topic",
              resourceId: { videoId: "kPVQEPyl78I" },
            },
          },
        ],
      };
    }

    if (pathname === "/search" && params.type === "video") {
      return { items: [] }; // No direct video search results to force matching from playlist items
    }

    throw new Error(`Unexpected mock YouTube call: ${pathname}`);
  };

  const dimoRexResult = await resolveYoutubeAlbumTracks({
    album: "Too Close",
    artist: "Dimo Rex",
    tracks: "#3 Too Close (feat. 수엔(SUEN))",
    apiKey: "test-key",
    youtubeApiClient: mockDimoRexYoutubeApi,
  });

  assert.strictEqual(dimoRexResult.candidates.length, 1, "expected one resolved candidate for Dimo Rex");
  assert.strictEqual(dimoRexResult.candidates[0].youtubeId, "kPVQEPyl78I", "expected the official Topic video kPVQEPyl78I over the fan video oYpxE0bXhVI");
  console.log("Test Case 2 (Dimo Rex) passed");

  console.log("all quarterly YouTube resolver tests passed successfully");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
