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

  console.log("quarterly YouTube resolver test passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
