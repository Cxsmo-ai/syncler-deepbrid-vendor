import { Episode, Movie, Package, Provider, ProviderMetadata, Season, Show, Source, SourceTypes } from "package-sdk";

const ALTHUB_BASE_URL = "https://api.althub.co.za/api";
const DEEPBRID_BASE_URL = "https://www.deepbrid.com/api/v1";
const PLACEHOLDER_VIDEO_URL = "https://raw.githubusercontent.com/Cxsmo-ai/syncler-deepbrid-vendor/v0.2.1/assets/deepbrid-caching.mp4";

const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const CAPS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PLAYABLE_TTL_MS = 6 * 60 * 60 * 1000;
const ERROR_TTL_MS = 10 * 60 * 1000;

type CacheRecord<T> = {
  expiresAt: number;
  value: T;
};

type NewznabItem = {
  title: string;
  guid: string;
  nzbUrl: string;
  category?: string;
  size?: number;
  sha1?: string;
};

type PendingRecord = {
  state: "pending" | "error";
  guid: string;
  title: string;
  submittedAt: number;
  lastCheckedAt: number;
  message?: string;
};

type PlayableRecord = {
  state: "ready";
  guid: string;
  title: string;
  url: string;
  filename?: string;
  size?: number;
};

type DeepbridCacheRecord = PendingRecord | PlayableRecord;

interface BaseProvider extends Provider {
  metadata: ProviderMetadata;
}

function now() {
  return Date.now();
}

function stripTt(imdbId?: string | null) {
  return String(imdbId || "").replace(/^tt/i, "");
}

function normalizeTitle(value: string) {
  return String(value || "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function episodeCode(season?: number | string, episode?: number | string) {
  const s = String(season || "").padStart(2, "0");
  const e = String(episode || "").padStart(2, "0");
  return `S${s}E${e}`;
}

function sizeToLabel(size?: number) {
  if (!size || !Number.isFinite(size)) return undefined;
  const gb = size / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = size / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

function stripApiKeyFromUrl(value?: string) {
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

function withAlthubApiKey(value: string) {
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

async function getCache<T>(key: string): Promise<T | undefined> {
  const raw = await env.storage.getItem(key);
  if (!raw) return undefined;
  try {
    const record = JSON.parse(raw) as CacheRecord<T>;
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

async function setCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const record: CacheRecord<T> = {
    expiresAt: now() + ttlMs,
    value
  };
  await env.storage.setItem(key, JSON.stringify(record));
}

function safeHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function accountHash() {
  const token = deepbridApiKey();
  return safeHash(token);
}

function althubApiKey() {
  return env.accounts?.althub?.token || env.settings?.althubApiKey || "";
}

function deepbridApiKey() {
  return env.accounts?.deepbrid?.token || env.settings?.deepbridApiKey || "";
}

function getAttr(attrs: any, name: string): string | undefined {
  const list = Array.isArray(attrs) ? attrs : attrs ? [attrs] : [];
  for (const item of list) {
    if (item?.["@attributes"]?.name === name) return item["@attributes"].value;
  }
  return undefined;
}

function parseNewznabItems(json: any): NewznabItem[] {
  const rawItems = json?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return items
    .map((item: any) => {
      const attrs = item?.attr;
      const guid = getAttr(attrs, "guid") || item?.guid?.["#text"] || item?.guid;
      const nzbUrl = item?.enclosure?.["@attributes"]?.url || item?.link;
      const size = Number(getAttr(attrs, "size"));
      return {
        title: item?.title,
        guid,
        nzbUrl: stripApiKeyFromUrl(nzbUrl),
        category: item?.category,
        size: Number.isFinite(size) ? size : undefined,
        sha1: getAttr(attrs, "sha1")
      };
    })
    .filter((item: NewznabItem) => item.title && item.guid && item.nzbUrl);
}

async function althubGet(params: Record<string, string | number | undefined>): Promise<any> {
  const key = althubApiKey();
  if (!key) throw new Error("Missing Althub API key");
  const url = new URL(ALTHUB_BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(name, String(value));
  }
  url.searchParams.set("apikey", key);
  url.searchParams.set("o", "json");
  const client = env.http.create();
  return client.get(url.toString()).then((response: any) => response.data);
}

async function searchMovieItems(movie: Movie): Promise<NewznabItem[]> {
  const imdb = stripTt(movie.ids?.imdb || movie.imdbId);
  const cacheKey = `althub:movie:${imdb}`;
  const cached = await getCache<NewznabItem[]>(cacheKey);
  if (cached) return cached;
  const json = await althubGet({ t: "movie", imdbid: imdb, limit: 100 });
  const items = sortItems(parseNewznabItems(json), movie.titles?.main?.title, movie.year);
  await setCache(cacheKey, items, SEARCH_TTL_MS);
  return items;
}

async function searchEpisodeItems(episode: Episode): Promise<NewznabItem[]> {
  const title = episode.show?.titles?.main?.title || episode.show?.title || "";
  const seasonNo = episode.season?.number || episode.seasonNumber || episode.season;
  const episodeNo = episode.number || episode.episodeNumber;
  const cacheKey = `althub:episode:${safeHash(`${title}:${seasonNo}:${episodeNo}`)}`;
  const cached = await getCache<NewznabItem[]>(cacheKey);
  if (cached) return cached;
  const json = await althubGet({ t: "tvsearch", q: title, season: seasonNo, ep: episodeNo, limit: 100 });
  const items = sortItems(parseNewznabItems(json), `${title} ${episodeCode(seasonNo, episodeNo)}`);
  await setCache(cacheKey, items, SEARCH_TTL_MS);
  return items;
}

function sortItems(items: NewznabItem[], title?: string, year?: string | number): NewznabItem[] {
  const titleWords = normalizeTitle(title || "").toLowerCase().split(" ").filter(Boolean);
  return items.sort((a, b) => scoreItem(b, titleWords, year) - scoreItem(a, titleWords, year));
}

function scoreItem(item: NewznabItem, titleWords: string[], year?: string | number) {
  const haystack = normalizeTitle(item.title).toLowerCase();
  let score = 0;
  for (const word of titleWords) {
    if (haystack.includes(word)) score += 5;
  }
  if (year && haystack.includes(String(year))) score += 10;
  if (/2160p|uhd|4k/i.test(item.title)) score += 8;
  if (/1080p/i.test(item.title)) score += 6;
  if (/remux/i.test(item.title)) score += 5;
  if (/web[- .]?dl/i.test(item.title)) score += 3;
  if (/movies|tv/i.test(item.category || "")) score += 3;
  if (item.size) score += Math.min(item.size / 1024 / 1024 / 1024 / 20, 8);
  return score;
}

async function submitToDeepbrid(item: NewznabItem): Promise<DeepbridCacheRecord> {
  const cacheKey = `deepbrid:nzb:${accountHash()}:${item.guid}`;
  const cached = await getCache<DeepbridCacheRecord>(cacheKey);
  if (cached) return cached;

  const key = deepbridApiKey();
  if (!key) throw new Error("Missing Deepbrid API key");

  try {
    const client = env.http.create();
    const response = await client.post(`${DEEPBRID_BASE_URL}/usenet/add`, `nzb_url=${encodeURIComponent(withAlthubApiKey(item.nzbUrl))}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
    const data = response.data || {};
    const playableUrl = data.link || data.download || data.url || data.links?.[0];
    if (playableUrl) {
      const ready: PlayableRecord = {
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
    const pending: PendingRecord = {
      state: "pending",
      guid: item.guid,
      title: item.title,
      submittedAt: now(),
      lastCheckedAt: now(),
      message: data.message || "Submitted to Deepbrid"
    };
    await setCache(cacheKey, pending, PENDING_TTL_MS);
    return pending;
  } catch (error: any) {
    const record: PendingRecord = {
      state: "error",
      guid: item.guid,
      title: item.title,
      submittedAt: now(),
      lastCheckedAt: now(),
      message: error?.message || "Deepbrid submission failed"
    };
    await setCache(cacheKey, record, ERROR_TTL_MS);
    return record;
  }
}

function placeholderSource(item?: NewznabItem | PendingRecord): Source {
  return {
    url: PLACEHOLDER_VIDEO_URL,
    name: "Deepbrid Caching",
    title: `[Caching] ${item?.title || "Deepbrid is adding this NZB"} - retry in a minute`,
    size: 1048576,
    type: SourceTypes.FREE_HOSTER
  } as Source;
}

function readySource(record: PlayableRecord, fallback?: NewznabItem): Source {
  return {
    url: record.url,
    name: "Deepbrid Althub",
    title: record.title,
    size: record.size || fallback?.size,
    type: SourceTypes.FREE_HOSTER,
    filename: record.filename || fallback?.title
  } as Source;
}

async function resolveItems(items: NewznabItem[]): Promise<Source[]> {
  const sources: Source[] = [];
  let pending: NewznabItem | PendingRecord | undefined;
  for (const item of items.slice(0, 8)) {
    const result = await submitToDeepbrid(item);
    if (result.state === "ready") sources.push(readySource(result, item));
    else if (!pending) pending = result;
  }
  if (!sources.length) sources.push(placeholderSource(pending || items[0]));
  return sources;
}

export class DeepbridAlthubProvider implements BaseProvider {
  metadata: ProviderMetadata = {
    name: "Deepbrid Althub Cache",
    sourceTypes: [SourceTypes.FREE_HOSTER],
    movie: true,
    episode: true,
    season: false,
    anime: false,
    languages: ["en"]
  };

  async searchMovie(movie: Movie): Promise<Source[]> {
    return resolveItems(await searchMovieItems(movie));
  }

  async searchEpisode(episode: Episode): Promise<Source[]> {
    return resolveItems(await searchEpisodeItems(episode));
  }

  async searchSeason(_season: Season): Promise<Source[]> {
    return [];
  }
}

const providers: BaseProvider[] = [new DeepbridAlthubProvider()];

export class DeepbridAlthubPackage implements Package {
  createProviderMetadata(): Promise<ProviderMetadata[]> {
    return Promise.resolve(providers.map((provider) => provider.metadata));
  }

  createProvider(metadata: ProviderMetadata): Promise<Provider> {
    const provider = providers.find((candidate) => candidate.metadata.name === metadata.name);
    if (!provider) throw new Error(`Unknown provider ${metadata.name}`);
    return Promise.resolve(provider);
  }
}

export const providerPackage = new DeepbridAlthubPackage();
