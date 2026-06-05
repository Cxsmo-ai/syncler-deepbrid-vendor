import assert from "node:assert/strict";

const [, , mode, id, season, episode] = process.argv;
const apiKey = process.env.DEEPBRID_API_KEY;

if (!apiKey) {
  console.error("Set DEEPBRID_API_KEY before running live checks.");
  process.exit(1);
}

if (!mode || !id) {
  console.error("Usage: node test/live-deepbrid-check.mjs movie <imdbId>");
  console.error("Usage: node test/live-deepbrid-check.mjs episode <showImdbId> <season> <episode>");
  process.exit(1);
}

const base = `https://www.deepbrid.com/stremio/${encodeURIComponent(apiKey)}~qall.s0.rar1`;
const route = mode === "movie"
  ? `/stream/movie/${id}.json`
  : `/stream/series/${id}:${season}:${episode}.json`;

if (mode !== "movie" && (!season || !episode)) {
  console.error("Episode mode requires <showImdbId> <season> <episode>.");
  process.exit(1);
}

const response = await fetch(`${base}${route}`, {
  headers: {
    Accept: "application/json",
    "User-Agent": "SynclerDeepbridStaticVendor/0.1"
  }
});

const json = await response.json();
assert.equal(response.status, 200, `expected HTTP 200, got ${response.status}`);
assert.ok(Array.isArray(json.streams), "expected streams array");
assert.ok(json.streams.length > 0, "expected at least one stream");
assert.ok(json.streams.every((stream) => typeof stream.url === "string" && stream.url.startsWith("http")), "expected direct stream URLs");

console.log(JSON.stringify({
  mode,
  route,
  streamCount: json.streams.length,
  first: {
    name: json.streams[0].name,
    hasUrl: Boolean(json.streams[0].url),
    title: json.streams[0].title
  }
}, null, 2));
