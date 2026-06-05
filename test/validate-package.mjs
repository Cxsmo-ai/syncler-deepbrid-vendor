import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function getPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

function mapFixtureSource(stream, jsonFormat) {
  const hostMatch = getPath(stream, jsonFormat.host).match(/^https?:\/\/([^/:]+)/);
  const sizeMatch = getPath(stream, jsonFormat.size).match(/([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|TB))/);

  return {
    url: getPath(stream, jsonFormat.url),
    title: getPath(stream, jsonFormat.title),
    host: hostMatch?.[1] ?? null,
    size: sizeMatch?.[1] ?? null,
    playbackFileName: getPath(stream, jsonFormat.playbackFileName),
    playbackFileSize: getPath(stream, jsonFormat.playbackFileSize)
  };
}

const vendor = readJson("src/manifest.vendor.json");
const manifest = readJson("src/manifest.json");
const express = readJson("src/express.json");
const movieFixture = readJson("test/fixtures/stream_movie_inception.json");
const episodeFixture = readJson("test/fixtures/stream_series_breaking_bad_s01e01.json");

assert.equal(vendor.name, "Deepbrid Static Vendor");
assert.ok(Array.isArray(vendor.packages), "vendor packages must be an array");
assert.match(vendor.packages[0].manifest, /^https:\/\/raw\.githubusercontent\.com\/Cxsmo-ai\/syncler-deepbrid-vendor\/v0\.1\.1\/src\/manifest\.json$/);
assert.ok(Array.isArray(vendor.defaults.packages), "vendor defaults packages must be an array");
assert.equal(vendor.defaults.packages[0], vendor.packages[0].manifest);

assert.equal(manifest.id, "com.deepbrid.syncler.static");
assert.equal(manifest.type, "express");
assert.match(manifest.url, /^https:\/\/raw\.githubusercontent\.com\/Cxsmo-ai\/syncler-deepbrid-vendor\/v0\.1\.1\/src\/express\.json$/);
assert.ok(Array.isArray(manifest.accounts), "manifest accounts must be an array");
assert.equal(manifest.accounts[0].alias, "deepbrid");
assert.equal(manifest.accounts[0].auth.inject.query.apikey, "{managedAccounts.deepbrid.token}");
assert.equal(manifest.accounts[0].verification.url, "https://www.deepbrid.com/stremio/api/account");
assert.equal(manifest.accounts[0].verification.extract.username.value, "$.username");

assert.ok(express.deepbrid, "express provider must include deepbrid");
assert.equal(express.deepbrid.base_url, "https://www.deepbrid.com/stremio/");
assert.equal(express.deepbrid.response_type, "json");
assert.match(express.deepbrid.movie.query, /\{managedAccounts\.deepbrid\.token\}/);
assert.match(express.deepbrid.movie.query, /\{imdbId\}/);
assert.match(express.deepbrid.episode.query, /\{showImdbId\}:\{season\}:\{episode\}/);

assert.equal(express.deepbrid.json_format.results, "streams");
assert.equal(express.deepbrid.json_format.url, "url");
assert.equal(express.deepbrid.json_format.title, "title");
assert.equal(express.deepbrid.json_format.playbackFileName, "behaviorHints.filename");
assert.equal(express.deepbrid.json_format.playbackFileSize, "behaviorHints.videoSize");

for (const [label, fixture] of [
  ["movie", movieFixture],
  ["episode", episodeFixture]
]) {
  assert.ok(Array.isArray(fixture.streams), `${label} fixture streams must be an array`);
  assert.ok(fixture.streams.length > 0, `${label} fixture must include at least one stream`);
  const mapped = mapFixtureSource(fixture.streams[0], express.deepbrid.json_format);
  assert.match(mapped.url, /^https?:\/\//, `${label} mapped url must be absolute`);
  assert.ok(mapped.title, `${label} mapped title must exist`);
  assert.ok(mapped.host, `${label} mapped host must exist`);
  assert.ok(mapped.size, `${label} mapped size must exist`);
  assert.ok(mapped.playbackFileName, `${label} mapped filename must exist`);
  assert.ok(Number.isFinite(mapped.playbackFileSize), `${label} mapped file size must be numeric`);
}

console.log("Syncler Deepbrid package validation passed.");
