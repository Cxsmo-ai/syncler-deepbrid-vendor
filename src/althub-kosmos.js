(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("package-sdk"));
  } else if (typeof define === "function" && define.amd) {
    define(["package-sdk"], factory);
  } else {
    root["provider-package"] = factory(root["package-sdk"]);
  }
})(typeof self !== "undefined" ? self : this, function (packageSdk) {
  const SourceTypes = packageSdk.SourceTypes;
  const ALTHUB_BASE_URL = "https://api.althub.co.za/api";
  const DEEPBRID_BASE_URL = "https://www.deepbrid.com/api/v1";
  const PLACEHOLDER_VIDEO_URL = "https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.2.1/assets/deepbrid-caching.mp4";
  const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
  const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const PLAYABLE_TTL_MS = 6 * 60 * 60 * 1000;
  const ERROR_TTL_MS = 10 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function stripTt(imdbId) {
    return String(imdbId || "").replace(/^tt/i, "");
  }

  function normalizeTitle(value) {
    return String(value || "")
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function episodeCode(season, episode) {
    const s = String(season || "").padStart(2, "0");
    const e = String(episode || "").padStart(2, "0");
    return `S${s}E${e}`;
  }

  function stripApiKeyFromUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      url.searchParams.delete("apikey");
      url.searchParams.delete("r");
      return url.toString();
    } catch {
      return value;
    }
  }

  function withAlthubApiKey(value) {
    try {
      const url = new URL(value);
      const key = althubApiKey();
      url.searchParams.set("apikey", key);
      url.searchParams.set("r", key);
      return url.toString();
    } catch {
      return value;
    }
  }

  async function getCache(key) {
    const raw = await env.storage.getItem(key);
    if (!raw) return undefined;
    try {
      const record = JSON.parse(raw);
      if (record.expiresAt < now()) {
        await env.storage.removeItem(key);
        return undefined;
      }
      return record.value;
    } catch {
      await env.storage.removeItem(key);
      return undefined;
    }
  }

  async function setCache(key, value, ttlMs) {
    await env.storage.setItem(key, JSON.stringify({ expiresAt: now() + ttlMs, value }));
  }

  function safeHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function althubApiKey() {
    return (env.accounts && env.accounts.althub && env.accounts.althub.token) || (env.settings && env.settings.althubApiKey) || "";
  }

  function deepbridApiKey() {
    return (env.accounts && env.accounts.deepbrid && env.accounts.deepbrid.token) || (env.settings && env.settings.deepbridApiKey) || "";
  }

  function accountHash() {
    return safeHash(deepbridApiKey());
  }

  function getAttr(attrs, name) {
    const list = Array.isArray(attrs) ? attrs : attrs ? [attrs] : [];
    for (const item of list) {
      if (item && item["@attributes"] && item["@attributes"].name === name) return item["@attributes"].value;
    }
    return undefined;
  }

  function parseNewznabItems(json) {
    const rawItems = json && json.channel && json.channel.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    return items
      .map((item) => {
        const attrs = item && item.attr;
        const guid = getAttr(attrs, "guid") || (item.guid && item.guid["#text"]) || item.guid;
        const nzbUrl = (item.enclosure && item.enclosure["@attributes"] && item.enclosure["@attributes"].url) || item.link;
        const size = Number(getAttr(attrs, "size"));
        return {
          title: item.title,
          guid,
          nzbUrl: stripApiKeyFromUrl(nzbUrl),
          category: item.category,
          size: Number.isFinite(size) ? size : undefined,
          sha1: getAttr(attrs, "sha1")
        };
      })
      .filter((item) => item.title && item.guid && item.nzbUrl);
  }

  async function althubGet(params) {
    const key = althubApiKey();
    if (!key) throw new Error("Missing Althub API key");
    const url = new URL(ALTHUB_BASE_URL);
    Object.keys(params).forEach((name) => {
      const value = params[name];
      if (value != null && value !== "") url.searchParams.set(name, String(value));
    });
    url.searchParams.set("apikey", key);
    url.searchParams.set("o", "json");
    return env.http.create().get(url.toString()).then((response) => response.data);
  }

  function sortItems(items, title, year) {
    const titleWords = normalizeTitle(title || "").toLowerCase().split(" ").filter(Boolean);
    return items.sort((a, b) => scoreItem(b, titleWords, year) - scoreItem(a, titleWords, year));
  }

  function scoreItem(item, titleWords, year) {
    const haystack = normalizeTitle(item.title).toLowerCase();
    let score = 0;
    titleWords.forEach((word) => {
      if (haystack.includes(word)) score += 5;
    });
    if (year && haystack.includes(String(year))) score += 10;
    if (/2160p|uhd|4k/i.test(item.title)) score += 8;
    if (/1080p/i.test(item.title)) score += 6;
    if (/remux/i.test(item.title)) score += 5;
    if (/web[- .]?dl/i.test(item.title)) score += 3;
    if (/movies|tv/i.test(item.category || "")) score += 3;
    if (item.size) score += Math.min(item.size / 1024 / 1024 / 1024 / 20, 8);
    return score;
  }

  async function searchMovieItems(movie) {
    const imdb = stripTt((movie.ids && movie.ids.imdb) || movie.imdbId);
    const cacheKey = `althub:movie:${imdb}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const json = await althubGet({ t: "movie", imdbid: imdb, limit: 100 });
    const title = movie.titles && movie.titles.main && movie.titles.main.title;
    const items = sortItems(parseNewznabItems(json), title, movie.year);
    await setCache(cacheKey, items, SEARCH_TTL_MS);
    return items;
  }

  async function searchEpisodeItems(episode) {
    const title = (episode.show && episode.show.titles && episode.show.titles.main && episode.show.titles.main.title) || (episode.show && episode.show.title) || "";
    const seasonNo = (episode.season && episode.season.number) || episode.seasonNumber || episode.season;
    const episodeNo = episode.number || episode.episodeNumber;
    const cacheKey = `althub:episode:${safeHash(`${title}:${seasonNo}:${episodeNo}`)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const json = await althubGet({ t: "tvsearch", q: title, season: seasonNo, ep: episodeNo, limit: 100 });
    const items = sortItems(parseNewznabItems(json), `${title} ${episodeCode(seasonNo, episodeNo)}`);
    await setCache(cacheKey, items, SEARCH_TTL_MS);
    return items;
  }

  async function submitToDeepbrid(item) {
    const cacheKey = `deepbrid:nzb:${accountHash()}:${item.guid}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const key = deepbridApiKey();
    if (!key) throw new Error("Missing Deepbrid API key");
    try {
      const response = await env.http.create().post(`${DEEPBRID_BASE_URL}/usenet/add`, `nzb_url=${encodeURIComponent(withAlthubApiKey(item.nzbUrl))}`, {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      const data = response.data || {};
      const playableUrl = data.link || data.download || data.url || (data.links && data.links[0]);
      if (playableUrl) {
        const ready = {
          state: "ready",
          guid: item.guid,
          title: item.title,
          url: playableUrl,
          filename: data.filename || item.title,
          size: data.size_bytes || item.size
        };
        await setCache(cacheKey, ready, PLAYABLE_TTL_MS);
        return ready;
      }
      const pending = {
        state: "pending",
        guid: item.guid,
        title: item.title,
        submittedAt: now(),
        lastCheckedAt: now(),
        message: data.message || "Submitted to Deepbrid"
      };
      await setCache(cacheKey, pending, PENDING_TTL_MS);
      return pending;
    } catch (error) {
      const record = {
        state: "error",
        guid: item.guid,
        title: item.title,
        submittedAt: now(),
        lastCheckedAt: now(),
        message: (error && error.message) || "Deepbrid submission failed"
      };
      await setCache(cacheKey, record, ERROR_TTL_MS);
      return record;
    }
  }

  function placeholderSource(item) {
    return {
      url: PLACEHOLDER_VIDEO_URL,
      name: "Deepbrid Caching",
      title: `[Caching] ${(item && item.title) || "Deepbrid is adding this NZB"} - retry in a minute`,
      size: 1048576,
      type: SourceTypes.FREE_HOSTER
    };
  }

  function readySource(record, fallback) {
    return {
      url: record.url,
      name: "Deepbrid Althub",
      title: record.title,
      size: record.size || (fallback && fallback.size),
      type: SourceTypes.FREE_HOSTER,
      filename: record.filename || (fallback && fallback.title)
    };
  }

  async function resolveItems(items) {
    const sources = [];
    let pending;
    for (const item of items.slice(0, 8)) {
      const result = await submitToDeepbrid(item);
      if (result.state === "ready") sources.push(readySource(result, item));
      else if (!pending) pending = result;
    }
    if (!sources.length) sources.push(placeholderSource(pending || items[0]));
    return sources;
  }

  class DeepbridAlthubProvider {
    constructor() {
      this.metadata = {
        name: "Deepbrid Althub Cache",
        sourceTypes: [SourceTypes.FREE_HOSTER],
        movie: true,
        episode: true,
        season: false,
        anime: false,
        languages: ["en"]
      };
    }

    async searchMovie(movie) {
      return resolveItems(await searchMovieItems(movie));
    }

    async searchEpisode(episode) {
      return resolveItems(await searchEpisodeItems(episode));
    }

    async searchSeason() {
      return [];
    }
  }

  const providers = [new DeepbridAlthubProvider()];

  class DeepbridAlthubPackage {
    createProviderMetadata() {
      return Promise.resolve(providers.map((provider) => provider.metadata));
    }

    createProvider(metadata) {
      const provider = providers.find((candidate) => candidate.metadata.name === metadata.name);
      if (!provider) throw new Error(`Unknown provider ${metadata.name}`);
      return Promise.resolve(provider);
    }
  }

  return { providerPackage: new DeepbridAlthubPackage() };
});
