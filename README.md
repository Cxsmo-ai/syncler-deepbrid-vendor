# Syncler Deepbrid Static Vendor

Static Syncler Express vendor package for Deepbrid Stremio results.

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

This package is intentionally not included in vendor defaults because Syncler currently documents managed accounts as `json_format` only. Without a bridge or a future Syncler Kosmos account API, a no-host static package cannot safely combine an Althub key with a Deepbrid key and POST NZBs to Deepbrid.

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
https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.2.2/src/manifest.vendor.json
```

Package URLs inside the manifests use absolute raw GitHub URLs so Syncler does not need to resolve relative paths.

## Expected Results

For the same Deepbrid API key, preference suffix, IMDb ID, and season/episode, this package should show the same underlying Deepbrid stream results as the Stremio addon.

Display may differ because Syncler formats sources differently than Stremio.

<a id="support-links"></a>

# 🎁 Support The Project: Deepbrid Referral Guide

This vendor package is **100% free and open-source**. However, maintaining and updating this project takes significant time and effort. 

The **ONLY** way to support this project and ensure its continued development is by using our **Deepbrid Referral Link** when you sign up or renew your account.

### 👉 [CLICK HERE TO SIGN UP FOR DEEPBRID](https://www.deepbrid.com/aff/go/pickymarker4906) 👈

---

## 🛑 How to Properly Use the Referral Link (IMPORTANT)

To ensure the referral tracks correctly and supports the project, please follow these exact steps:

1. **Clear Your Cookies/Cache** (or use an Incognito/Private Browsing window) to ensure no old tracking cookies interfere.
2. **Click this exact link**: **[https://www.deepbrid.com/aff/go/pickymarker4906](https://www.deepbrid.com/aff/go/pickymarker4906)**
3. **Create your account** or **log in** immediately after clicking the link.
4. **Purchase your premium plan** in the same browsing session. 

> [!IMPORTANT]
> If you navigate away and come back later, the referral tracking might drop. **Always click the link right before making your purchase!**

## 📢 Sharing on Reddit & Forums

If you are sharing this vendor package on Reddit or other community forums, **please do not post the raw referral link directly**, as it often gets blocked by spam filters. 

Instead, **link directly to this section of the README** so users can read the instructions and click the link here:

```text
https://github.com/Cxsmo-ai/syncler-deepbrid-vendor#support-links
```

**Thank you for your support! Your contributions keep this project alive.**
