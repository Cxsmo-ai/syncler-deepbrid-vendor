import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function getAttr(attrs, name) {
  const list = Array.isArray(attrs) ? attrs : attrs ? [attrs] : [];
  for (const item of list) {
    if (item?.["@attributes"]?.name === name) return item["@attributes"].value;
  }
  return undefined;
}

function parseItems(json) {
  const rawItems = json?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return items.map((item) => ({
    title: item.title,
    nzbUrl: item.enclosure?.["@attributes"]?.url || item.link,
    guid: getAttr(item.attr, "guid"),
    size: Number(getAttr(item.attr, "size")),
    category: item.category
  }));
}

const vendor = readJson("src/manifest.vendor.json");
const manifest = readJson("src/althub-kosmos-manifest.json");
const source = read("src/althub-kosmos.ts");
const movieFixture = readJson("test/althub-fixtures/movie-inception.json");
const episodeFixture = readJson("test/althub-fixtures/episode-breaking-bad-s01e01.json");
const videoPath = path.join(root, "assets/deepbrid-caching.mp4");
const forbiddenAlthubKey = ["e69d65df51004a5b", "cedec16d493e3b97"].join("");
const forbiddenDeepbridKey = ["86a9618a6d0ce3610df6ccb7b4c77fb", "927eb1d98f81e5de0704c4afdb7ee75dc"].join("");

assert.ok(vendor.packages.some((pkg) => pkg.name === "Deepbrid Althub Cache"), "vendor must list Althub package");
assert.equal(manifest.type, "kosmos");
assert.equal(manifest.url, "https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.2.0/src/althub-kosmos.ts");
assert.ok(manifest.accounts.some((account) => account.alias === "deepbrid"));
assert.ok(manifest.accounts.some((account) => account.alias === "althub"));

assert.ok(source.includes("PLACEHOLDER_VIDEO_URL"));
assert.ok(source.includes("deepbrid-caching.mp4"));
assert.ok(source.includes("env.storage"));
assert.ok(source.includes("/usenet/add"));
assert.ok(source.includes('url.searchParams.delete("apikey")'));
assert.ok(source.includes('url.searchParams.delete("r")'));
assert.ok(source.includes('url.searchParams.set("r", key)'));
assert.ok(source.includes("t: \"movie\""));
assert.ok(source.includes("t: \"tvsearch\""));
assert.ok(source.includes("placeholderSource"));
assert.ok(!source.includes(forbiddenAlthubKey), "Althub key must not be committed");
assert.ok(!source.includes(forbiddenDeepbridKey), "Deepbrid key must not be committed");

for (const [label, fixture] of [["movie", movieFixture], ["episode", episodeFixture]]) {
  const items = parseItems(fixture);
  assert.equal(items.length, 1, `${label} fixture should have one item`);
  assert.ok(items[0].title, `${label} title should exist`);
  assert.ok(items[0].nzbUrl.includes(".nzb"), `${label} NZB URL should exist`);
  assert.ok(items[0].guid, `${label} guid should exist`);
  assert.ok(Number.isFinite(items[0].size), `${label} size should be numeric`);
}

assert.ok(fs.existsSync(videoPath), "placeholder video must exist");
const videoSize = fs.statSync(videoPath).size;
assert.ok(videoSize > 10_000, "placeholder video should not be empty");
assert.ok(videoSize < 5_000_000, "placeholder video should stay lightweight");

const allText = fs
  .readdirSync(root, { recursive: true })
  .filter((file) => typeof file === "string")
  .filter((file) => !file.startsWith(".git"))
  .filter((file) => fs.statSync(path.join(root, file)).isFile())
  .filter((file) => !file.endsWith(".mp4"))
  .map((file) => read(file))
  .join("\n");

assert.ok(!allText.includes(forbiddenAlthubKey), "Althub key leak found");
assert.ok(!allText.includes(forbiddenDeepbridKey), "Deepbrid key leak found");

console.log("Althub Kosmos package validation passed.");
