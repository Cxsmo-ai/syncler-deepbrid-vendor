# Publishing

## Raw GitHub

1. Push this repo to GitHub.
2. Use the raw URL for `src/manifest.vendor.json`.

```text
https://raw.githubusercontent.com/YOUR_USER/syncler-deepbrid-vendor/main/src/manifest.vendor.json
```

If Syncler does not resolve relative manifest URLs, edit:

```json
"url": "./manifest.json"
```

to:

```json
"url": "https://raw.githubusercontent.com/YOUR_USER/syncler-deepbrid-vendor/main/src/manifest.json"
```

and edit package `url` to:

```json
"url": "https://raw.githubusercontent.com/YOUR_USER/syncler-deepbrid-vendor/main/src/express.json"
```

## GitHub Pages

If using GitHub Pages, publish the `src` folder contents or copy the JSON files to the Pages root.

Expected URLs:

```text
https://YOUR_USER.github.io/syncler-deepbrid-vendor/manifest.vendor.json
https://YOUR_USER.github.io/syncler-deepbrid-vendor/manifest.json
https://YOUR_USER.github.io/syncler-deepbrid-vendor/express.json
```
