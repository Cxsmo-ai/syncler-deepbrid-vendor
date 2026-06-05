# Syncler Deepbrid Static Vendor

Static Syncler Express vendor package for Deepbrid Stremio results.

Deepbrid referral/signup link:

```text
https://www.deepbrid.com/aff/go/pickymarker4906
```

This package does not host an API. Syncler provides the media IDs, then this package calls Deepbrid's Stremio stream routes directly:

```text
GET https://www.deepbrid.com/stremio/{deepbridApiKey}~qall.s0.rar1/stream/movie/{imdbId}.json
GET https://www.deepbrid.com/stremio/{deepbridApiKey}~qall.s0.rar1/stream/series/{showImdbId}:{season}:{episode}.json
```

## What It Does

- Uses Syncler-supplied IMDb IDs.
- Calls the same Deepbrid Stremio routes as the Deepbrid Stremio addon.
- Maps `streams[]` into direct playable sources.
- Uses a managed Deepbrid account token in Syncler.
- Shows the Deepbrid referral/signup link in the package/account branding where Syncler exposes provider websites.
- Verifies the account through Deepbrid's `/stremio/api/account?apikey=...` endpoint.
- Requires no bridge, proxy, server, or hosted API.

## Packages

### Deepbrid

Stable Express package that calls Deepbrid's official Stremio stream routes directly.

### Deepbrid Althub Cache

Experimental Kosmos package for Althub/Newznab NZB results through Deepbrid Usenet.

It searches Althub, submits NZB URLs to Deepbrid, uses local Syncler storage to avoid repeated indexer hits, and returns a small placeholder video while Deepbrid is caching:

```text
assets/deepbrid-caching.mp4
```

Because Syncler managed-account support is officially documented for `json_format` providers, the Althub Kosmos package also includes code fallbacks for package settings if account tokens are not exposed to Kosmos at runtime.

## What It Does Not Do

- It does not search Cinemeta.
- It does not scrape sites.
- It does not resolve torrents manually.
- It does not store or publish a Deepbrid API key.

## Files

```text
src/manifest.vendor.json
src/manifest.json
src/express.json
src/althub-kosmos-manifest.json
src/althub-kosmos.ts
src/althub-kosmos.js
assets/deepbrid-caching.mp4
```

Use `manifest.vendor.json` as the vendor entry point when installing in Syncler.

## Local Validation

```powershell
npm test
```

Optional live checks:

```powershell
$env:DEEPBRID_API_KEY="your-deepbrid-api-key"
npm run live:movie
npm run live:episode
```

The live checks only verify route shape and stream counts. They do not write your key to disk.

## Publishing

Publish this repo to GitHub and use raw URLs or GitHub Pages.

Raw vendor URL example:

```text
https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.2.1/src/manifest.vendor.json
```

Package URLs inside the manifests use absolute raw GitHub URLs so Syncler does not need to resolve relative paths.

## Expected Results

For the same Deepbrid API key, preference suffix, IMDb ID, and season/episode, this package should show the same underlying Deepbrid stream results as the Stremio addon.

Display may differ because Syncler formats sources differently than Stremio.
