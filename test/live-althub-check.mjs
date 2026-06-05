const [, , mode, ...args] = process.argv;
const key = process.env.ALTHUB_API_KEY;

if (!key) {
  console.error("Set ALTHUB_API_KEY before running live Althub checks.");
  process.exit(1);
}

const url = new URL("https://api.althub.co.za/api");
url.searchParams.set("apikey", key);
url.searchParams.set("o", "json");

if (mode === "caps") {
  url.searchParams.set("t", "caps");
} else if (mode === "movie") {
  const imdb = String(args[0] || "").replace(/^tt/i, "");
  url.searchParams.set("t", "movie");
  url.searchParams.set("imdbid", imdb);
  url.searchParams.set("limit", "5");
} else if (mode === "episode") {
  const [title, season, episode] = args;
  url.searchParams.set("t", "tvsearch");
  url.searchParams.set("q", title || "");
  url.searchParams.set("season", season || "");
  url.searchParams.set("ep", episode || "");
  url.searchParams.set("limit", "5");
} else {
  console.error("Usage: node test/live-althub-check.mjs caps");
  console.error("Usage: node test/live-althub-check.mjs movie tt1375666");
  console.error("Usage: node test/live-althub-check.mjs episode \"Breaking Bad\" 1 1");
  process.exit(1);
}

const response = await fetch(url);
const json = await response.json();
const rawItems = json?.channel?.item;
const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

console.log(JSON.stringify({
  mode,
  status: response.status,
  server: json?.server?.["@attributes"]?.title || json?.channel?.title,
  total: json?.channel?.response?.["@attributes"]?.total,
  itemCount: items.length,
  firstTitle: items[0]?.title
}, null, 2));
