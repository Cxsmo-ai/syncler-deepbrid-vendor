(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    var sdk;
    try { sdk = require("package-sdk"); } catch (e) { sdk = (root && root["package-sdk"]) || {}; }
    var exported = factory(sdk);
    module.exports = exported;
    module.exports.default = exported;
    module.exports.providerPackage = exported;
  } else if (typeof define === "function" && define.amd) {
    define(["package-sdk"], factory);
  } else {
    var target = (typeof globalThis !== "undefined" && globalThis) || (typeof self !== "undefined" && self) || (typeof window !== "undefined" && window) || (typeof global !== "undefined" && global) || root || {};
    var sdk = (target && target["package-sdk"]) || (root && root["package-sdk"]) || {};
    var exported = factory(sdk);
    if (target) {
      target["provider-package"] = exported;
      target.providerPackage = exported;
      target.default = exported;
    }
    if (root && root !== target) {
      root["provider-package"] = exported;
      root.providerPackage = exported;
      root.default = exported;
    }
  }
})(typeof self !== "undefined" ? self : typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : this, function (packageSdk) {
  var SourceTypes = (packageSdk && packageSdk.SourceTypes) || {
    DEBRID: "DEBRID",
    TORRENT: "TORRENT",
    FREE_HOSTER: "FREE_HOSTER",
    HOSTER: "HOSTER",
    DIRECT: "DIRECT"
  };

  var DEEPBRID_BASE_URL = "https://www.deepbrid.com/api/v1";
  var FINDER_USER_AGENT = "Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF";
  var SEARCH_TTL_MS = 12 * 60 * 60 * 1000;
  var CONTENT_TTL_MS = 6 * 60 * 60 * 1000;
  var MAX_CANDIDATES = 4;

  var VIDEO_EXTENSIONS_REGEX = /\.(mkv|mp4|avi|ts|m4v|mov|webm|wmv|flv|iso)$/i;
  var NON_VIDEO_EXTENSIONS_REGEX = /\.(par2|nfo|nzb|sfv|srr|txt|jpg|png|gif|srt|sub|idx|exe|apk|zip)$/i;
  var SAMPLE_REGEX = /(sample|trailer|featurette)/i;

  function now() {
    return Date.now();
  }

  function normalizeTitle(value) {
    return String(value || "")
      .replace(/[._-]+/g, " ")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanQuery(value) {
    return String(value || "")
      .replace(/[._-]+/g, " ")
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function episodeCode(season, episode) {
    var s = String(season || "");
    while (s.length < 2) s = "0" + s;
    var e = String(episode || "");
    while (e.length < 2) e = "0" + e;
    return "S" + s + "E" + e;
  }

  function extractQuality(text) {
    if (/2160p|\b4k\b|\buhd\b/i.test(text)) return "2160p";
    if (/1080p/i.test(text)) return "1080p";
    if (/720p/i.test(text)) return "720p";
    if (/480p|\bsd\b/i.test(text)) return "480p";
    return "1080p";
  }

  function extractResolution(text) {
    if (/2160p|\b4k\b|\buhd\b/i.test(text)) return "4K";
    if (/1080p/i.test(text)) return "1080p";
    if (/720p/i.test(text)) return "720p";
    if (/480p|\bsd\b/i.test(text)) return "SD";
    return "HD";
  }

  function extractShowTitle(episode) {
    if (!episode) return "";
    var show = episode.show || {};
    var title =
      (show.titles && show.titles.main && show.titles.main.title) ||
      show.title ||
      show.name ||
      show.original_name ||
      show.show_name ||
      episode.showTitle ||
      episode.showName ||
      episode.seriesTitle ||
      episode.seriesName ||
      "";
    return String(title || "").trim();
  }

  function extractSeasonEpisode(episode) {
    var s =
      (episode.season && (episode.season.number != null ? episode.season.number : episode.season)) ||
      episode.seasonNumber ||
      episode.season_number ||
      episode.season ||
      episode.s ||
      1;
    var e =
      (episode.episode && (episode.episode.number != null ? episode.episode.number : episode.episode)) ||
      episode.episodeNumber ||
      episode.episode_number ||
      episode.number ||
      episode.ep ||
      episode.e ||
      1;
    return {
      season: parseInt(String(s), 10) || 1,
      episode: parseInt(String(e), 10) || 1
    };
  }

  function extractMovieTitle(movie) {
    if (!movie) return "";
    var title =
      (movie.titles && movie.titles.main && movie.titles.main.title) ||
      movie.title ||
      movie.name ||
      movie.original_title ||
      movie.movieTitle ||
      "";
    return String(title || "").trim();
  }

  function matchesEpisode(text, season, episode) {
    if (!text || season == null || episode == null) return false;
    var sNum = parseInt(String(season), 10);
    var eNum = parseInt(String(episode), 10);
    if (isNaN(sNum) || isNaN(eNum)) return false;

    var sPad = String(sNum);
    while (sPad.length < 2) sPad = "0" + sPad;
    var ePad = String(eNum);
    while (ePad.length < 2) ePad = "0" + ePad;

    var patterns = [
      new RegExp("\\bS0*?" + sNum + "E0*?" + eNum + "\\b", "i"),
      new RegExp("\\b0*?" + sNum + "x0*?" + eNum + "\\b", "i"),
      new RegExp("\\[0*?" + sNum + "x0*?" + eNum + "\\]", "i"),
      new RegExp("\\bS" + sPad + "E" + ePad + "\\b", "i"),
      new RegExp("\\bS" + sNum + "E" + eNum + "\\b", "i")
    ];

    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(text)) return true;
    }
    return false;
  }

  function safeHash(value) {
    var hash = 2166136261;
    for (var index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function getEnv() {
    if (typeof env !== "undefined" && env) return env;
    if (typeof globalThis !== "undefined" && globalThis.env) return globalThis.env;
    if (typeof self !== "undefined" && self.env) return self.env;
    if (typeof window !== "undefined" && window.env) return window.env;
    return null;
  }

  function deepbridApiKey() {
    var e = getEnv();
    if (!e) return "";

    if (e.accounts) {
      if (e.accounts.deepbrid) {
        if (typeof e.accounts.deepbrid === "string") return e.accounts.deepbrid.trim();
        if (e.accounts.deepbrid.token) return String(e.accounts.deepbrid.token).trim();
        if (e.accounts.deepbrid.apiKey) return String(e.accounts.deepbrid.apiKey).trim();
        if (e.accounts.deepbrid.key) return String(e.accounts.deepbrid.key).trim();
      }
      if (Array.isArray(e.accounts)) {
        for (var i = 0; i < e.accounts.length; i++) {
          var acc = e.accounts[i];
          if (acc && (acc.alias === "deepbrid" || acc.name === "deepbrid" || acc.id === "deepbrid")) {
            if (acc.token) return String(acc.token).trim();
            if (acc.apiKey) return String(acc.apiKey).trim();
          }
        }
        if (e.accounts[0] && e.accounts[0].token) return String(e.accounts[0].token).trim();
      }
    }

    if (e.account) {
      if (typeof e.account === "string") return e.account.trim();
      if (e.account.token) return String(e.account.token).trim();
      if (e.account.apiKey) return String(e.account.apiKey).trim();
      if (e.account.key) return String(e.account.key).trim();
    }

    if (e.settings) {
      if (e.settings.deepbridApiKey) return String(e.settings.deepbridApiKey).trim();
      if (e.settings.apiKey) return String(e.settings.apiKey).trim();
      if (e.settings.token) return String(e.settings.token).trim();
      if (e.settings.key) return String(e.settings.key).trim();
    }

    if (e.config) {
      if (e.config.deepbridApiKey) return String(e.config.deepbridApiKey).trim();
      if (e.config.apiKey) return String(e.config.apiKey).trim();
      if (e.config.token) return String(e.config.token).trim();
    }

    return "";
  }

  function accountHash() {
    return safeHash(deepbridApiKey());
  }

  function getCache(key) {
    var e = getEnv();
    if (!e || !e.storage || !e.storage.getItem) return Promise.resolve(undefined);
    try {
      return Promise.resolve(e.storage.getItem(key)).then(function (raw) {
        if (!raw) return undefined;
        try {
          var record = JSON.parse(raw);
          if (record.expiresAt < now()) {
            try { e.storage.removeItem(key); } catch (x) {}
            return undefined;
          }
          return record.value;
        } catch (x) {
          return undefined;
        }
      }, function () { return undefined; });
    } catch (x) {
      return Promise.resolve(undefined);
    }
  }

  function setCache(key, value, ttlMs) {
    var e = getEnv();
    if (!e || !e.storage || !e.storage.setItem) return Promise.resolve();
    try {
      return Promise.resolve(e.storage.setItem(key, JSON.stringify({ expiresAt: now() + ttlMs, value: value }))).then(function () {}, function () {});
    } catch (x) {
      return Promise.resolve();
    }
  }

  function safeHttpGet(url, headers) {
    var e = getEnv();

    function tryFetch() {
      if (typeof fetch === "function") {
        try {
          return fetch(url, { headers: headers }).then(function (res) {
            if (res.ok) return res.json();
            return null;
          }, function () { return null; });
        } catch (x) {
          return Promise.resolve(null);
        }
      }
      return Promise.resolve(null);
    }

    function tryHttpGet() {
      if (e && e.http && e.http.get) {
        try {
          return Promise.resolve(e.http.get(url, { headers: headers })).then(function (res) {
            if (res) {
              var raw = res.data != null ? res.data : res.body != null ? res.body : res;
              if (typeof raw === "string") {
                try { return JSON.parse(raw); } catch (x) { return null; }
              }
              return raw;
            }
            return null;
          }, function () { return tryFetch(); });
        } catch (x) {
          return tryFetch();
        }
      }
      return tryFetch();
    }

    if (e && e.http && e.http.create) {
      try {
        var client = e.http.create();
        return Promise.resolve(client.get(url, { headers: headers })).then(function (res) {
          if (res) {
            var raw = res.data != null ? res.data : res.body != null ? res.body : res;
            if (typeof raw === "string") {
              try { return JSON.parse(raw); } catch (x) { return null; }
            }
            return raw;
          }
          return null;
        }, function () { return tryHttpGet(); });
      } catch (x) {
        return tryHttpGet();
      }
    }
    return tryHttpGet();
  }

  function searchFinderApi(query, category) {
    var key = deepbridApiKey();
    if (!key) return Promise.resolve([]);
    var trimmed = query.trim();
    if (trimmed.length < 2) return Promise.resolve([]);

    var cacheKey = "db:finder:search:" + safeHash(trimmed + (category || ""));
    return getCache(cacheKey).then(function (cached) {
      if (cached) return cached;

      var endpoint = DEEPBRID_BASE_URL + "/usenet/finder/search?q=" + encodeURIComponent(trimmed) + "&offset=0&limit=50";
      if (category) {
        endpoint += "&category=" + encodeURIComponent(category);
      }

      return safeHttpGet(endpoint, {
        "User-Agent": FINDER_USER_AGENT,
        "Authorization": "Bearer " + key,
        "Accept": "application/json"
      }).then(function (data) {
        var items = (data && Array.isArray(data.items)) ? data.items : [];
        if (items.length > 0) {
          return setCache(cacheKey, items, SEARCH_TTL_MS).then(function () { return items; });
        }
        return items;
      });
    });
  }

  function fetchContentApi(token) {
    var key = deepbridApiKey();
    if (!key || !token) return Promise.resolve(null);

    var cacheKey = "db:finder:content:" + accountHash() + ":" + safeHash(token);
    return getCache(cacheKey).then(function (cached) {
      if (cached) return cached;

      var endpoint = DEEPBRID_BASE_URL + "/usenet/finder/content?token=" + encodeURIComponent(token) + "&archives=1";
      return safeHttpGet(endpoint, {
        "User-Agent": FINDER_USER_AGENT,
        "Authorization": "Bearer " + key,
        "Accept": "application/json"
      }).then(function (data) {
        if (data && Array.isArray(data.files)) {
          return setCache(cacheKey, data, CONTENT_TTL_MS).then(function () { return data; });
        }
        return null;
      });
    });
  }

  function scoreMovieItem(item, titleWords, year) {
    var title = (item.title || "").toLowerCase();
    var score = 0;

    for (var i = 0; i < titleWords.length; i++) {
      if (title.indexOf(titleWords[i]) >= 0) score += 5;
      else score -= 3;
    }

    if (year && title.indexOf(String(year)) >= 0) score += 10;

    if (/2160p|\b4k\b|\buhd\b/i.test(title)) score += 10;
    else if (/1080p/i.test(title)) score += 7;
    else if (/720p/i.test(title)) score += 4;

    if (/remux/i.test(title)) score += 6;
    if (/blu-?ray|bd-?rip/i.test(title)) score += 5;
    if (/web-?dl|webrip/i.test(title)) score += 3;
    if (/hdr10|\bhdr\b|\bdv\b|dolby.?vision/i.test(title)) score += 4;

    var catName = item.category_name || item.category || "";
    if (item.kind === "video" || /movies|hd|uhd|bluray/i.test(catName)) {
      score += 5;
    } else if (item.kind === "audio" || item.kind === "book" || item.kind === "game") {
      score -= 30;
    }

    if (item.size && item.size > 0) {
      score += Math.min(item.size / (1024 * 1024 * 1024 * 15), 6);
    }

    return score;
  }

  function scoreEpisodeItem(item, showWords, season, episode) {
    var title = (item.title || "").toLowerCase();
    var score = 0;

    for (var i = 0; i < showWords.length; i++) {
      if (title.indexOf(showWords[i]) >= 0) score += 5;
      else score -= 3;
    }

    if (season != null && episode != null) {
      if (matchesEpisode(item.title, season, episode)) {
        score += 20;
      } else {
        var sNum = parseInt(String(season), 10);
        var sPattern = new RegExp("\\b(?:season|s)[. _-]*0*?" + sNum + "\\b", "i");
        if (sPattern.test(item.title) && /pack|complete/i.test(item.title)) {
          score += 10;
        } else {
          score -= 25;
        }
      }
    }

    if (/2160p|\b4k\b|\buhd\b/i.test(title)) score += 10;
    else if (/1080p/i.test(title)) score += 7;
    else if (/720p/i.test(title)) score += 4;

    if (/remux/i.test(title)) score += 6;
    if (/blu-?ray|bd-?rip/i.test(title)) score += 5;
    if (/web-?dl|webrip/i.test(title)) score += 3;

    var catName = item.category_name || item.category || "";
    if (item.kind === "video" || /tv|hd|uhd|sd/i.test(catName)) {
      score += 5;
    } else if (item.kind === "audio" || item.kind === "book" || item.kind === "game") {
      score -= 30;
    }

    return score;
  }

  function findBestVideoFile(files, season, episode) {
    if (!files || !files.length) return null;

    var videoFiles = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file.link) continue;
      var name = file.name || "";
      if (NON_VIDEO_EXTENSIONS_REGEX.test(name)) continue;
      if (!VIDEO_EXTENSIONS_REGEX.test(name)) continue;
      if (SAMPLE_REGEX.test(name)) continue;
      videoFiles.push(file);
    }

    if (!videoFiles.length) {
      var fallbackLinks = [];
      for (var j = 0; j < files.length; j++) {
        if (files[j].link && !NON_VIDEO_EXTENSIONS_REGEX.test(files[j].name || "") && !SAMPLE_REGEX.test(files[j].name || "")) {
          fallbackLinks.push(files[j]);
        }
      }
      return fallbackLinks[0] || null;
    }

    if (season != null && episode != null) {
      var matchingEp = [];
      for (var k = 0; k < videoFiles.length; k++) {
        if (matchesEpisode(videoFiles[k].name, season, episode)) {
          matchingEp.push(videoFiles[k]);
        }
      }
      if (matchingEp.length > 0) {
        return matchingEp[0];
      }
    }

    videoFiles.sort(function (a, b) {
      return (b.size || 0) - (a.size || 0);
    });
    return videoFiles[0];
  }

  function uniqueByToken(items) {
    var seen = {};
    var result = [];
    for (var i = 0; i < items.length; i++) {
      if (!items[i].token) continue;
      if (seen[items[i].token]) continue;
      seen[items[i].token] = true;
      result.push(items[i]);
    }
    return result;
  }

  function searchMovieImpl(movie) {
    var apiKey = deepbridApiKey();
    if (!apiKey) return Promise.resolve([]);

    var mainTitle = extractMovieTitle(movie);
    var cleanMain = cleanQuery(mainTitle);
    if (!cleanMain || cleanMain.length < 2) return Promise.resolve([]);

    var titleWords = normalizeTitle(mainTitle).toLowerCase().split(" ");
    var filtered = [];
    for (var tw = 0; tw < titleWords.length; tw++) {
      if (titleWords[tw]) filtered.push(titleWords[tw]);
    }
    titleWords = filtered;

    var queries = [cleanMain];
    if (movie.year) {
      var withYear = cleanMain + " " + movie.year;
      if (queries.indexOf(withYear) < 0) queries.unshift(withYear);
    }

    var idx = 0;
    function tryNextQuery() {
      if (idx >= queries.length) return Promise.resolve([]);
      var q = queries[idx];
      idx++;
      return searchFinderApi(q).then(function (results) {
        if (results && results.length > 0) return results;
        return tryNextQuery();
      });
    }

    return tryNextQuery().then(function (items) {
      if (!items.length) return [];

      var unique = uniqueByToken(items);
      var scored = [];
      for (var i = 0; i < unique.length; i++) {
        var s = scoreMovieItem(unique[i], titleWords, movie.year);
        if (s > 0) scored.push({ item: unique[i], score: s });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      scored = scored.slice(0, MAX_CANDIDATES);

      var contentPromises = [];
      for (var j = 0; j < scored.length; j++) {
        contentPromises.push(
          (function (entry) {
            return fetchContentApi(entry.item.token).then(function (content) {
              return { item: entry.item, content: content };
            });
          })(scored[j])
        );
      }

      return Promise.all(contentPromises).then(function (contentResults) {
        var sources = [];
        for (var k = 0; k < contentResults.length; k++) {
          var item = contentResults[k].item;
          var content = contentResults[k].content;
          if (!content || !content.files || !content.files.length) continue;

          var bestFile = findBestVideoFile(content.files);
          if (bestFile && bestFile.link) {
            var label = item.title || bestFile.name;
            sources.push({
              url: bestFile.link,
              name: "Deepbrid Finder",
              title: label,
              size: bestFile.size || item.size,
              type: SourceTypes.DEBRID || "DEBRID",
              debrid: "deepbrid",
              quality: extractQuality(label),
              resolution: extractResolution(label),
              seeds: item.sources || 1,
              filename: bestFile.name || item.title
            });
          }
        }
        return sources;
      });
    });
  }

  function searchEpisodeImpl(episode) {
    var apiKey = deepbridApiKey();
    if (!apiKey) return Promise.resolve([]);

    var showTitle = extractShowTitle(episode);
    var cleanShow = cleanQuery(showTitle);
    if (!cleanShow || cleanShow.length < 2) return Promise.resolve([]);

    var se = extractSeasonEpisode(episode);
    var seasonNo = se.season;
    var episodeNo = se.episode;
    var epCode = episodeCode(seasonNo, episodeNo);
    var sPad = String(seasonNo);
    while (sPad.length < 2) sPad = "0" + sPad;

    var showWords = normalizeTitle(showTitle).toLowerCase().split(" ");
    var filtered = [];
    for (var tw = 0; tw < showWords.length; tw++) {
      if (showWords[tw]) filtered.push(showWords[tw]);
    }
    showWords = filtered;

    var rawQueries = [
      cleanShow + " " + epCode,
      cleanShow + " S" + seasonNo + "E" + episodeNo,
      cleanShow + " S" + sPad,
      cleanShow + " Season " + seasonNo,
      cleanShow
    ];
    var queries = [];
    for (var qi = 0; qi < rawQueries.length; qi++) {
      if (queries.indexOf(rawQueries[qi]) < 0) queries.push(rawQueries[qi]);
    }

    var idx = 0;
    function tryNextQuery() {
      if (idx >= queries.length) return Promise.resolve([]);
      var q = queries[idx];
      idx++;
      return searchFinderApi(q).then(function (results) {
        if (results && results.length > 0) return results;
        return tryNextQuery();
      });
    }

    return tryNextQuery().then(function (items) {
      if (!items.length) return [];

      var unique = uniqueByToken(items);
      var scored = [];
      for (var i = 0; i < unique.length; i++) {
        var s = scoreEpisodeItem(unique[i], showWords, seasonNo, episodeNo);
        if (s > 0) scored.push({ item: unique[i], score: s });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      scored = scored.slice(0, MAX_CANDIDATES);

      var contentPromises = [];
      for (var j = 0; j < scored.length; j++) {
        contentPromises.push(
          (function (entry) {
            return fetchContentApi(entry.item.token).then(function (content) {
              return { item: entry.item, content: content };
            });
          })(scored[j])
        );
      }

      return Promise.all(contentPromises).then(function (contentResults) {
        var sources = [];
        for (var k = 0; k < contentResults.length; k++) {
          var item = contentResults[k].item;
          var content = contentResults[k].content;
          if (!content || !content.files || !content.files.length) continue;

          var bestFile = findBestVideoFile(content.files, seasonNo, episodeNo);
          if (bestFile && bestFile.link) {
            var label = item.title || bestFile.name;
            sources.push({
              url: bestFile.link,
              name: "Deepbrid Finder",
              title: label,
              size: bestFile.size || item.size,
              type: SourceTypes.DEBRID || "DEBRID",
              debrid: "deepbrid",
              quality: extractQuality(label),
              resolution: extractResolution(label),
              seeds: item.sources || 1,
              filename: bestFile.name || item.title
            });
          }
        }
        return sources;
      });
    });
  }

  function DeepbridFinderProvider() {
    this.metadata = {
      name: "Deepbrid Usenet Finder",
      sourceTypes: [
        SourceTypes.DEBRID || "DEBRID",
        SourceTypes.TORRENT || "TORRENT",
        SourceTypes.FREE_HOSTER || "FREE_HOSTER",
        SourceTypes.DIRECT || "DIRECT"
      ],
      movie: true,
      episode: true,
      season: false,
      anime: false,
      languages: ["en"]
    };
  }

  DeepbridFinderProvider.prototype.searchMovie = function (movie) {
    return searchMovieImpl(movie);
  };

  DeepbridFinderProvider.prototype.searchEpisode = function (episode) {
    return searchEpisodeImpl(episode);
  };

  DeepbridFinderProvider.prototype.searchSeason = function (_season) {
    return Promise.resolve([]);
  };

  var providers = [new DeepbridFinderProvider()];

  function DeepbridFinderPackage() {}

  DeepbridFinderPackage.prototype.createProviderMetadata = function () {
    var metas = [];
    for (var i = 0; i < providers.length; i++) {
      metas.push(providers[i].metadata);
    }
    return Promise.resolve(metas);
  };

  DeepbridFinderPackage.prototype.createProvider = function (metadata) {
    var provider = null;
    for (var i = 0; i < providers.length; i++) {
      if (providers[i].metadata.name === metadata.name) {
        provider = providers[i];
        break;
      }
    }
    if (!provider) throw new Error("Unknown provider " + metadata.name);
    return Promise.resolve(provider);
  };

  var pkgInstance = new DeepbridFinderPackage();
  pkgInstance.default = pkgInstance;
  pkgInstance.providerPackage = pkgInstance;
  pkgInstance.DeepbridFinderPackage = DeepbridFinderPackage;
  pkgInstance.DeepbridFinderProvider = DeepbridFinderProvider;
  return pkgInstance;
});

