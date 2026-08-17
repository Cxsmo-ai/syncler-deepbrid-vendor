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
 
 const vendor = readJson("src/manifest.vendor.json");
 const manifest = readJson("src/finder-kosmos-manifest.json");
 const source = read("src/finder-kosmos.ts");
 const builtSource = read("src/finder-kosmos.js");
 const movieSearchFixture = readJson("test/finder-fixtures/search-movie-inception.json");
 const movieContentFixture = readJson("test/finder-fixtures/content-inception-2160p.json");
 const episodeSearchFixture = readJson("test/finder-fixtures/search-episode-breaking-bad.json");
 const episodeContentFixture = readJson("test/finder-fixtures/content-breaking-bad-pack.json");
 
 const forbiddenDeepbridKey = ["86a9618a6d0ce3610df6ccb7b4c77fb", "927eb1d98f81e5de0704c4afdb7ee75dc"].join("");
 
 assert.ok(vendor.packages.some((pkg) => pkg.name === "Deepbrid Usenet Finder"), "vendor must list Deepbrid Usenet Finder package");
 assert.equal(manifest.id, "com.deepbrid.syncler.finder");
 assert.equal(manifest.type, "kosmos");
 assert.match(manifest.url, /finder-kosmos.js$/);
 assert.ok(!manifest.url.endsWith(".ts"), "Kosmos manifest must point to built JavaScript, not TypeScript");
 assert.ok(Array.isArray(manifest.accounts), "Kosmos manifest must declare accounts");
 assert.equal(manifest.accounts[0].alias, "deepbrid");
 assert.equal(vendor.defaults.packages.length, 2, "vendor defaults must include both packages");
 
 assert.ok(source.includes("DEEPBRID_BASE_URL"));
 assert.ok(source.includes("FINDER_USER_AGENT"));
 assert.ok(source.includes("/usenet/finder/search"));
 assert.ok(source.includes("/usenet/finder/content"));
 assert.ok(source.includes("archives=1"));
 assert.ok(source.includes("DeepbridFinderProvider"));
 assert.ok(source.includes("providerPackage"));
 
 assert.ok(builtSource.includes('root["provider-package"]'));
 assert.ok(builtSource.includes("DeepbridFinderProvider"));
 assert.ok(builtSource.includes("providerPackage"));
 
 assert.ok(!source.includes(forbiddenDeepbridKey), "Deepbrid key must not be hardcoded in TS");
 assert.ok(!builtSource.includes(forbiddenDeepbridKey), "Deepbrid key must not be hardcoded in JS build");
 
 // Validate movie search & content fixture data
 assert.ok(Array.isArray(movieSearchFixture.items), "movie search fixture must have items");
 assert.equal(movieSearchFixture.items.length, 2);
 assert.ok(movieSearchFixture.items[0].token);
 assert.ok(movieSearchFixture.items[0].title.includes("Inception"));
 assert.ok(Array.isArray(movieContentFixture.files), "movie content fixture must have files");
 const movieVideoFile = movieContentFixture.files.find((f) => f.name.endsWith(".mkv"));
 assert.ok(movieVideoFile, "movie video file must exist");
 assert.ok(movieVideoFile.link.startsWith("https://"));
 
 // Validate episode search & content fixture data
 assert.ok(Array.isArray(episodeSearchFixture.items), "episode search fixture must have items");
 assert.ok(Array.isArray(episodeContentFixture.files), "episode content fixture must have files");
 const s01e01File = episodeContentFixture.files.find((f) => f.name.includes("S01E01"));
 assert.ok(s01e01File, "S01E01 file must exist in pack content fixture");
 assert.ok(s01e01File.link.startsWith("https://"));
 
 console.log("Deepbrid Usenet Finder Kosmos package validation passed.");
 import vm from "node:vm";
 
 // Test evaluation in a standalone sandbox without package-sdk
 const sandbox = {};
 vm.runInNewContext(builtSource, sandbox);
 const pkg = sandbox.providerPackage || sandbox["provider-package"]?.providerPackage || sandbox.default;
 assert.ok(pkg, "exported package must exist on sandbox root");
 assert.equal(typeof pkg.createProviderMetadata, "function", "createProviderMetadata must be a function");
 const metadataList = await pkg.createProviderMetadata();
 assert.ok(Array.isArray(metadataList) && metadataList.length > 0, "metadata list must be non-empty");
 assert.equal(metadataList[0].name, "Deepbrid Usenet Finder");
 const provider = await pkg.createProvider(metadataList[0]);
 assert.ok(provider, "createProvider must return provider instance");
 assert.equal(typeof provider.searchMovie, "function", "searchMovie must be a function");
 assert.equal(typeof provider.searchEpisode, "function", "searchEpisode must be a function");
 
