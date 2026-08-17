 # Syncler Deepbrid Static Vendor
 
 Static Syncler vendor package providing direct Deepbrid Stremio streams and native **Deepbrid Usenet Finder** search support.
 
 This package requires no bridge, proxy, server, or hosted API.
 
 ## What It Does
 
 - **Deepbrid Stremio Express**: Directly calls Deepbrid's Stremio stream endpoints (`/stream/movie/{imdbId}.json` & `/stream/series/{imdbId}:{season}:{episode}.json`) for instant cached streams.
 - **Deepbrid Usenet Finder Kosmos**: Searches Deepbrid's native Usenet index (`/usenet/finder/search`), automatically extracts multi-part/RAR/7z archives (`/usenet/finder/content?token=...&archives=1`), and returns direct streamable links.
 - **Zero Hosted Infrastructure**: Runs purely static manifests and client-side JavaScript inside Syncler.
 - **Account Integration**: Connects with Deepbrid API keys via Syncler managed accounts or package settings.
 
 ## Packages
 
 ### 1. Deepbrid (Express)
 
 Stable Express package that queries Deepbrid's official Stremio stream routes using Syncler-supplied IMDb IDs:
 
 ```text
 GET https://www.deepbrid.com/stremio/{deepbridApiKey}~qall.s0.rar1/stream/movie/{imdbId}.json
 GET https://www.deepbrid.com/stremio/{deepbridApiKey}~qall.s0.rar1/stream/series/{showImdbId}:{season}:{episode}.json
 ```
 
 ### 2. Deepbrid Usenet Finder (Kosmos)
 
 Native Kosmos provider that searches Deepbrid's internal Usenet Finder index:
 
 1. Queries `https://www.deepbrid.com/api/v1/usenet/finder/search?q={query}` using title, year, and episode tags (`S01E01`).
 2. Ranks and scores results by release quality (2160p/4K, 1080p, Remux, BluRay, WEB-DL).
 3. Calls `https://www.deepbrid.com/api/v1/usenet/finder/content?token={token}&archives=1` to extract RAR/7z archives into direct playable video links on Deepbrid servers.
 4. Uses Syncler storage (`env.storage`) to cache search queries and content tokens, minimizing API latency.
 
 ## What It Does Not Do
 
 - It does not require any 3rd party indexers.
 - It does not search Cinemeta.
 - It does not scrape torrent sites.
 - It does not store or publish a Deepbrid API key.
 
 ## Files
 
 ```text
 src/manifest.vendor.json
 src/manifest.json
 src/express.json
 src/finder-kosmos-manifest.json
 src/finder-kosmos.ts
 src/finder-kosmos.js
 docs/finder-deepbrid-map.md
 docs/route-map.md
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
 npm run live:finder:movie Inception
 npm run live:finder:episode "Breaking Bad" 1 1
 ```
 
 The live checks only verify route shape and stream counts. They do not write your key to disk.
 
 ## Publishing
 
 Publish this repo to GitHub and use raw URLs or GitHub Pages.
 
Raw vendor URL example:

```text
https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.3.5/src/manifest.vendor.json
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
