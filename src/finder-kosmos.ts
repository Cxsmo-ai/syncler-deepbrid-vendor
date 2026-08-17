 import { Episode, Movie, Package, Provider, ProviderMetadata, Season, Show, Source, SourceTypes } from "package-sdk";
 
 declare const env: any;
 
const DEEPBRID_BASE_URL = "https://www.deepbrid.com/api/v1";
const FINDER_USER_AGENT = "Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF";
const SEARCH_TTL_MS = 12 * 60 * 60 * 1000;
const CONTENT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CANDIDATES = 4;

const VIDEO_EXTENSIONS_REGEX = /\.(mkv|mp4|avi|ts|m4v|mov|webm|wmv|flv|iso)$/i;
 const NON_VIDEO_EXTENSIONS_REGEX = /\.(par2|nfo|nzb|sfv|srr|txt|jpg|png|gif|srt|sub|idx|exe|apk|zip)$/i;
 const SAMPLE_REGEX = /(sample|trailer|featurette)/i;
 
 type CacheRecord<T> = {
   expiresAt: number;
   value: T;
 };
 
 export type FinderSearchItem = {
   token: string;
   title: string;
   category?: string;
   category_name?: string;
   kind?: string;
   size?: number;
   size_human?: string;
   date?: string | number;
   sources?: number;
 };
 
export type FinderFile = {
  name: string;
  link: string;
  size?: number;
  size_human?: string;
  video?: boolean;
};

export type FinderContentResponse = {
   error?: number;
   title?: string;
   files?: FinderFile[];
   has_password?: boolean;
   password?: string;
 };
 
 interface BaseProvider extends Provider {
   metadata: ProviderMetadata;
 }
 
 function now(): number {
   return Date.now();
 }
 
 function normalizeTitle(value: string): string {
   return String(value || "")
     .replace(/[._-]+/g, " ")
     .replace(/[^a-zA-Z0-9 ]/g, "")
     .replace(/\s+/g, " ")
     .trim();
 }
 
 function cleanQuery(value: string): string {
   return String(value || "")
     .replace(/[._-]+/g, " ")
     .replace(/[^a-zA-Z0-9 ]/g, " ")
     .replace(/\s+/g, " ")
     .trim();
 }
 
 function episodeCode(season?: number | string, episode?: number | string): string {
   const s = String(season || "").padStart(2, "0");
   const e = String(episode || "").padStart(2, "0");
   return `S${s}E${e}`;
 }
 
 function extractQuality(text: string): string {
   if (/2160p|\b4k\b|\buhd\b/i.test(text)) return "2160p";
   if (/1080p/i.test(text)) return "1080p";
   if (/720p/i.test(text)) return "720p";
   if (/480p|\bsd\b/i.test(text)) return "480p";
   return "1080p";
 }
 
 function extractResolution(text: string): string {
   if (/2160p|\b4k\b|\buhd\b/i.test(text)) return "4K";
   if (/1080p/i.test(text)) return "1080p";
   if (/720p/i.test(text)) return "720p";
   if (/480p|\bsd\b/i.test(text)) return "SD";
   return "HD";
 }
 
 function extractShowTitle(episode: any): string {
   if (!episode) return "";
   const show = episode.show || {};
   const title =
     show.titles?.main?.title ||
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
 
 function extractSeasonEpisode(episode: any): { season: number; episode: number } {
   const s =
     (episode.season && (episode.season.number != null ? episode.season.number : episode.season)) ||
     episode.seasonNumber ||
     episode.season_number ||
     episode.season ||
     episode.s ||
     1;
   const e =
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
 
 function extractMovieTitle(movie: any): string {
   if (!movie) return "";
   const title =
     movie.titles?.main?.title ||
     movie.title ||
     movie.name ||
     movie.original_title ||
     movie.movieTitle ||
     "";
   return String(title || "").trim();
 }
 
 function matchesEpisode(text: string, season?: number | string, episode?: number | string): boolean {
   if (!text || season == null || episode == null) return false;
   const sNum = parseInt(String(season), 10);
   const eNum = parseInt(String(episode), 10);
   if (isNaN(sNum) || isNaN(eNum)) return false;
 
   const sPad = String(sNum).padStart(2, "0");
   const ePad = String(eNum).padStart(2, "0");
 
   const patterns = [
     new RegExp(`\\bS0*?${sNum}E0*?${eNum}\\b`, "i"),
     new RegExp(`\\b0*?${sNum}x0*?${eNum}\\b`, "i"),
     new RegExp(`\\[0*?${sNum}x0*?${eNum}\\]`, "i"),
     new RegExp(`\\bS${sPad}E${ePad}\\b`, "i"),
     new RegExp(`\\bS${sNum}E${eNum}\\b`, "i")
   ];
 
   for (const pattern of patterns) {
     if (pattern.test(text)) return true;
   }
   return false;
 }
 
function safeHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function getEnv(): any {
  if (typeof env !== "undefined" && env) return env;
  if (typeof globalThis !== "undefined" && (globalThis as any).env) return (globalThis as any).env;
  if (typeof self !== "undefined" && (self as any).env) return (self as any).env;
  if (typeof window !== "undefined" && (window as any).env) return (window as any).env;
  return null;
}

function deepbridApiKey(): string {
  const e = getEnv();
  if (!e) return "";

  if (e.accounts) {
    if (e.accounts.deepbrid) {
      if (typeof e.accounts.deepbrid === "string") return e.accounts.deepbrid.trim();
      if (e.accounts.deepbrid.token) return String(e.accounts.deepbrid.token).trim();
      if (e.accounts.deepbrid.apiKey) return String(e.accounts.deepbrid.apiKey).trim();
      if (e.accounts.deepbrid.key) return String(e.accounts.deepbrid.key).trim();
    }
    if (Array.isArray(e.accounts)) {
      for (let i = 0; i < e.accounts.length; i += 1) {
        const acc = e.accounts[i];
        if (acc && (acc.alias === "deepbrid" || acc.name === "deepbrid" || acc.id === "deepbrid")) {
          if (acc.token) return String(acc.token).trim();
          if (acc.apiKey) return String(acc.apiKey).trim();
        }
      }
      if (e.accounts[0]?.token) return String(e.accounts[0].token).trim();
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
 
 function accountHash(): string {
   return safeHash(deepbridApiKey());
 }
 
async function getCache<T>(key: string): Promise<T | undefined> {
  const e = getEnv();
  if (!e?.storage?.getItem) return undefined;
  try {
    const raw = await e.storage.getItem(key);
    if (!raw) return undefined;
    const record = JSON.parse(raw) as CacheRecord<T>;
    if (record.expiresAt < now()) {
      await e.storage.removeItem(key);
      return undefined;
    }
    return record.value;
  } catch {
    return undefined;
  }
}

async function setCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const e = getEnv();
  if (!e?.storage?.setItem) return;
  try {
    const record: CacheRecord<T> = {
      expiresAt: now() + ttlMs,
      value
    };
    await e.storage.setItem(key, JSON.stringify(record));
  } catch {
    // storage write failed silently
  }
}

async function safeHttpGet(url: string, headers: Record<string, string>): Promise<any> {
  const e = getEnv();

  if (e?.http?.create) {
    try {
      const client = e.http.create();
      const res = await client.get(url, { headers });
      if (res) {
        const raw = res.data != null ? res.data : res.body != null ? res.body : res;
        if (typeof raw === "string") {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return raw;
      }
    } catch {
      // ignore
    }
  }

  if (e?.http?.get) {
    try {
      const res = await e.http.get(url, { headers });
      if (res) {
        const raw = res.data != null ? res.data : res.body != null ? res.body : res;
        if (typeof raw === "string") {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return raw;
      }
    } catch {
      // ignore
    }
  }

  if (typeof fetch === "function") {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
  }

  return null;
}
 
 async function searchFinderApi(query: string, category?: string): Promise<FinderSearchItem[]> {
   const key = deepbridApiKey();
   if (!key) return [];
   const trimmed = query.trim();
   if (trimmed.length < 2) return [];
 
   const cacheKey = `db:finder:search:${safeHash(trimmed + (category || ""))}`;
   const cached = await getCache<FinderSearchItem[]>(cacheKey);
   if (cached) return cached;
 
   let endpoint = `${DEEPBRID_BASE_URL}/usenet/finder/search?q=${encodeURIComponent(trimmed)}&offset=0&limit=50`;
   if (category) {
     endpoint += `&category=${encodeURIComponent(category)}`;
   }
 
   const data = await safeHttpGet(endpoint, {
     "User-Agent": FINDER_USER_AGENT,
     Authorization: `Bearer ${key}`,
     Accept: "application/json"
   });
 
   const items: FinderSearchItem[] = Array.isArray(data?.items) ? data.items : [];
   if (items.length > 0) {
     await setCache(cacheKey, items, SEARCH_TTL_MS);
   }
   return items;
 }
 
 async function fetchContentApi(token: string): Promise<FinderContentResponse | null> {
   const key = deepbridApiKey();
   if (!key || !token) return null;
 
   const cacheKey = `db:finder:content:${accountHash()}:${safeHash(token)}`;
   const cached = await getCache<FinderContentResponse>(cacheKey);
   if (cached) return cached;
 
   const endpoint = `${DEEPBRID_BASE_URL}/usenet/finder/content?token=${encodeURIComponent(token)}&archives=1`;
   const data: FinderContentResponse = await safeHttpGet(endpoint, {
     "User-Agent": FINDER_USER_AGENT,
     Authorization: `Bearer ${key}`,
     Accept: "application/json"
   });
 
   if (data && Array.isArray(data.files)) {
     await setCache(cacheKey, data, CONTENT_TTL_MS);
     return data;
   }
   return null;
 }
 
 function scoreMovieItem(item: FinderSearchItem, titleWords: string[], year?: string | number): number {
   const title = (item.title || "").toLowerCase();
   let score = 0;
 
   for (const word of titleWords) {
     if (title.includes(word)) score += 5;
     else score -= 3;
   }
 
   if (year && title.includes(String(year))) score += 10;
 
   if (/2160p|\b4k\b|\buhd\b/i.test(title)) score += 10;
   else if (/1080p/i.test(title)) score += 7;
   else if (/720p/i.test(title)) score += 4;
 
   if (/remux/i.test(title)) score += 6;
   if (/blu-?ray|bd-?rip/i.test(title)) score += 5;
   if (/web-?dl|webrip/i.test(title)) score += 3;
   if (/hdr10|\bhdr\b|\bdv\b|dolby.?vision/i.test(title)) score += 4;
 
   if (item.kind === "video" || /movies|hd|uhd|bluray/i.test(item.category_name || item.category || "")) {
     score += 5;
   } else if (item.kind === "audio" || item.kind === "book" || item.kind === "game") {
     score -= 30;
   }
 
   if (item.size && item.size > 0) {
     score += Math.min(item.size / (1024 * 1024 * 1024 * 15), 6);
   }
 
   return score;
 }
 
 function scoreEpisodeItem(
   item: FinderSearchItem,
   showWords: string[],
   season?: number | string,
   episode?: number | string
 ): number {
   const title = (item.title || "").toLowerCase();
   let score = 0;
 
   for (const word of showWords) {
     if (title.includes(word)) score += 5;
     else score -= 3;
   }
 
   if (season != null && episode != null) {
     if (matchesEpisode(item.title, season, episode)) {
       score += 20;
     } else {
       const sNum = parseInt(String(season), 10);
       const sPattern = new RegExp(`\\b(?:season|s)[. _-]*0*?${sNum}\\b`, "i");
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
 
   if (item.kind === "video" || /tv|hd|uhd|sd/i.test(item.category_name || item.category || "")) {
     score += 5;
   } else if (item.kind === "audio" || item.kind === "book" || item.kind === "game") {
     score -= 30;
   }
 
   return score;
 }
 
 function findBestVideoFile(files: FinderFile[], season?: number | string, episode?: number | string): FinderFile | null {
   if (!files || !files.length) return null;
 
   const videoFiles = files.filter((file) => {
     if (!file.link) return false;
     const name = file.name || "";
     if (NON_VIDEO_EXTENSIONS_REGEX.test(name)) return false;
     if (!VIDEO_EXTENSIONS_REGEX.test(name)) return false;
     if (SAMPLE_REGEX.test(name)) return false;
     return true;
   });
 
   if (!videoFiles.length) {
     const fallbackLinks = files.filter((f) => f.link && !NON_VIDEO_EXTENSIONS_REGEX.test(f.name || "") && !SAMPLE_REGEX.test(f.name || ""));
     return fallbackLinks[0] || null;
   }
 
   if (season != null && episode != null) {
     const matchingEp = videoFiles.filter((f) => matchesEpisode(f.name, season, episode));
     if (matchingEp.length > 0) {
       return matchingEp[0];
     }
   }
 
   return videoFiles.sort((a, b) => (b.size || 0) - (a.size || 0))[0];
 }
 
export class DeepbridFinderProvider implements BaseProvider {
  metadata: ProviderMetadata = {
    name: "Deepbrid Usenet Finder",
    sourceTypes: [
      SourceTypes.DEBRID,
      SourceTypes.TORRENT,
      SourceTypes.FREE_HOSTER,
      SourceTypes.DIRECT
    ],
    movie: true,
    episode: true,
    season: false,
    anime: false,
    languages: ["en"]
  };
 
   async searchMovie(movie: Movie): Promise<Source[]> {
     const apiKey = deepbridApiKey();
     if (!apiKey) return [];
 
     const mainTitle = extractMovieTitle(movie);
     const cleanMain = cleanQuery(mainTitle);
     if (!cleanMain || cleanMain.length < 2) return [];
 
     const titleWords = normalizeTitle(mainTitle).toLowerCase().split(" ").filter(Boolean);
     const queries = [
       movie.year ? `${cleanMain} ${movie.year}` : cleanMain,
       cleanMain
     ].filter((q, idx, arr) => arr.indexOf(q) === idx);
 
     let items: FinderSearchItem[] = [];
     for (const q of queries) {
       const results = await searchFinderApi(q);
       if (results && results.length > 0) {
         items = results;
         break;
       }
     }
 
     if (!items.length) return [];
 
     const seenTokens = new Set<string>();
     const uniqueItems = items.filter((item) => {
       if (!item.token || seenTokens.has(item.token)) return false;
       seenTokens.add(item.token);
       return true;
     });
 
     const scored = uniqueItems
       .map((item) => ({ item, score: scoreMovieItem(item, titleWords, movie.year) }))
       .filter((entry) => entry.score > 0)
       .sort((a, b) => b.score - a.score)
       .slice(0, MAX_CANDIDATES);
 
     const contentResults = await Promise.all(
       scored.map((entry) => fetchContentApi(entry.item.token).then((content) => ({ item: entry.item, content })))
     );
 
     const sources: Source[] = [];
     for (const { item, content } of contentResults) {
       if (!content || !content.files || !content.files.length) continue;
 
      const bestFile = findBestVideoFile(content.files);
      if (bestFile && bestFile.link) {
        sources.push({
          url: bestFile.link,
          name: "Deepbrid Finder",
          title: item.title || bestFile.name,
          size: bestFile.size || item.size,
          type: SourceTypes.DEBRID,
          debrid: "deepbrid",
          quality: extractQuality(item.title || bestFile.name),
          resolution: extractResolution(item.title || bestFile.name),
          seeds: item.sources || 1,
          filename: bestFile.name || item.title
        } as Source);
      }
     }
 
     return sources;
   }
 
   async searchEpisode(episode: Episode): Promise<Source[]> {
     const apiKey = deepbridApiKey();
     if (!apiKey) return [];
 
     const showTitle = extractShowTitle(episode);
     const cleanShow = cleanQuery(showTitle);
     if (!cleanShow || cleanShow.length < 2) return [];
 
     const { season: seasonNo, episode: episodeNo } = extractSeasonEpisode(episode);
     const epCode = episodeCode(seasonNo, episodeNo);
     const sPad = String(seasonNo).padStart(2, "0");
     const showWords = normalizeTitle(showTitle).toLowerCase().split(" ").filter(Boolean);
 
     const queries = [
       `${cleanShow} ${epCode}`,
       `${cleanShow} S${seasonNo}E${episodeNo}`,
       `${cleanShow} S${sPad}`,
       `${cleanShow} Season ${seasonNo}`,
       cleanShow
     ].filter((q, idx, arr) => arr.indexOf(q) === idx);
 
     let items: FinderSearchItem[] = [];
     for (const q of queries) {
       const results = await searchFinderApi(q);
       if (results && results.length > 0) {
         items = results;
         break;
       }
     }
 
     if (!items.length) return [];
 
     const seenTokens = new Set<string>();
     const uniqueItems = items.filter((item) => {
       if (!item.token || seenTokens.has(item.token)) return false;
       seenTokens.add(item.token);
       return true;
     });
 
     const scored = uniqueItems
       .map((item) => ({ item, score: scoreEpisodeItem(item, showWords, seasonNo, episodeNo) }))
       .filter((entry) => entry.score > 0)
       .sort((a, b) => b.score - a.score)
       .slice(0, MAX_CANDIDATES);
 
     const contentResults = await Promise.all(
       scored.map((entry) => fetchContentApi(entry.item.token).then((content) => ({ item: entry.item, content })))
     );
 
     const sources: Source[] = [];
     for (const { item, content } of contentResults) {
       if (!content || !content.files || !content.files.length) continue;
 
      const bestFile = findBestVideoFile(content.files, seasonNo, episodeNo);
      if (bestFile && bestFile.link) {
        sources.push({
          url: bestFile.link,
          name: "Deepbrid Finder",
          title: item.title || bestFile.name,
          size: bestFile.size || item.size,
          type: SourceTypes.DEBRID,
          debrid: "deepbrid",
          quality: extractQuality(item.title || bestFile.name),
          resolution: extractResolution(item.title || bestFile.name),
          seeds: item.sources || 1,
          filename: bestFile.name || item.title
        } as Source);
      }
     }
 
     return sources;
   }
 
   async searchSeason(_season: Season): Promise<Source[]> {
     return [];
   }
 }
 
 const providers: BaseProvider[] = [new DeepbridFinderProvider()];
 
 export class DeepbridFinderPackage implements Package {
   createProviderMetadata(): Promise<ProviderMetadata[]> {
     return Promise.resolve(providers.map((provider) => provider.metadata));
   }
 
   createProvider(metadata: ProviderMetadata): Promise<Provider> {
     const provider = providers.find((candidate) => candidate.metadata.name === metadata.name);
     if (!provider) throw new Error(`Unknown provider ${metadata.name}`);
     return Promise.resolve(provider);
   }
 }
 
 export const providerPackage = new DeepbridFinderPackage();
 export default providerPackage;
