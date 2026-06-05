# Althub + Deepbrid Usenet Map

This package adds a static Kosmos provider that searches Althub/Newznab, submits NZB URLs to Deepbrid Usenet, and returns a visible placeholder video while Deepbrid is caching.

## Althub API

Althub is Newznab-compatible.

```text
GET https://api.althub.co.za/api?t=caps&apikey={althubKey}&o=json
GET https://api.althub.co.za/api?t=movie&imdbid={imdbWithoutTt}&apikey={althubKey}&limit=100&o=json
GET https://api.althub.co.za/api?t=tvsearch&q={title}&season={season}&ep={episode}&apikey={althubKey}&limit=100&o=json
```

Observed item fields:

```text
channel.item[].title
channel.item[].enclosure.@attributes.url
channel.item[].attr[name=guid]
channel.item[].attr[name=size]
channel.item[].attr[name=category]
channel.item[].attr[name=sha1]
```

## Deepbrid API

Deepbrid accepts NZB URLs:

```text
POST https://www.deepbrid.com/api/v1/usenet/add
Authorization: Bearer {deepbridKey}
Content-Type: application/x-www-form-urlencoded

nzb_url={althubNzbUrl}
```

## Cache

The package uses local Syncler storage to avoid hitting the same Althub account repeatedly:

```text
althub:movie:{imdb}
althub:episode:{title-season-episode-hash}
deepbrid:nzb:{deepbridAccountHash}:{althubGuid}
```

No raw API keys are stored in cache keys or cache values. Althub NZB URLs are stored without `apikey` or `r` parameters, then the key is reattached only when submitting the NZB URL to Deepbrid.

## Placeholder Video

When Deepbrid is still processing an NZB, the package returns:

```text
name: Deepbrid Caching
title: [Caching] ... retry in a minute
url: https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.2.1/assets/deepbrid-caching.mp4
```

This is intentionally similar to Stremio addons that show a placeholder stream while an uncached torrent is being added.
