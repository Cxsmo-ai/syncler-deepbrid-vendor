# Deepbrid Route Map

## Base

```text
https://www.deepbrid.com/stremio/{deepbridApiKey}~qall.s0.rar1
```

The suffix controls Deepbrid addon preferences:

```text
qall = all qualities
s0 = size preference value 0
rar1 = include RAR/7z streaming results
```

## Movie Streams

```text
GET /stream/movie/{imdbId}.json
```

Example:

```text
GET /stream/movie/tt1375666.json
```

Observed response shape:

```json
{
  "streams": [
    {
      "url": "https://...",
      "name": "Deepbrid 4K",
      "title": "Premium ...",
      "behaviorHints": {
        "notWebReady": false,
        "bingeGroup": "deepbrid-usenet-tt1375666-2160p-remux-h265",
        "videoSize": 79853765334,
        "filename": "Example.mkv"
      }
    }
  ]
}
```

## Episode Streams

```text
GET /stream/series/{showImdbId}:{season}:{episode}.json
```

Example:

```text
GET /stream/series/tt0903747:1:1.json
```

## Syncler Mapping

| Syncler Field | Deepbrid Field |
| --- | --- |
| Result list | `streams` |
| URL | `url` |
| Title | `title` |
| Host | extracted from `url` |
| Size | extracted from `title` |
| Playback filename | `behaviorHints.filename` |
| Playback file size | `behaviorHints.videoSize` |

## Boundary

The Deepbrid server does the source lookup internally after `/stream/...`. Those internal calls are not exposed to clients. The public/static package boundary is the Stremio stream route.
