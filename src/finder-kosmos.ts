 import { Episode, Movie, Package, Provider, ProviderMetadata, Season, Show, Source, SourceTypes } from "package-sdk";
 
 declare const env: any;
 
 const DEEPBRID_BASE_URL = "https://www.deepbrid.com/api/v1";
 const FINDER_USER_AGENT = "Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF";
 const SEARCH_TTL_MS = 12 * 60 * 60 * 1000;
 const CONTENT_TTL_MS = 6 * 60 * 60 * 1000;
 const MAX_CANDIDATES = 6;
 
 const VIDEO_EXTENSIONS_REGEX = /\.(mkv|mp4|avi|ts|m4v|mov|webm|wmv|flv|iso)$/i;
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
   date?: string;
   sources?: number;
 };
 
 export type FinderFile = {
   name: string;
   link: string;
   size?: number;
   size_human?: string;
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
     new RegExp(`\\bS${sPad}E${ePad}\\b`, "i")
   ];
 
   for (const pattern of patterns) {
     if (pattern.test(text)) return true;
   }
 
   const epPatterns = [
     new RegExp(`\\b(?:E|EP|Episode)[. _-]*0*?${eNum}\\b`, "i")
   ];
   for (const epPattern of epPatterns) {
     if (epPattern.test(text)) {
       const seasonMatch = text.match(/\bS0*?(\d+)\b/i);
       if (!seasonMatch || parseInt(seasonMatch[1], 10) === sNum) {
         return true;
       }
     }
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
 
 function deepbridApiKey(): string {
   if (typeof env === "undefined") return "";
   const token =
     env?.accounts?.deepbrid?.token ||
     env?.accounts?.deepbrid?.apiKey ||
     (typeof env?.accounts?.deepbrid === "string" ? env.accounts.deepbrid : "") ||
     env?.account?.token ||
     env?.account?.apiKey ||
     (typeof env?.account === "string" ? env.account : "") ||
     env?.settings?.deepbridApiKey ||
     env?.settings?.apiKey ||
     env?.settings?.token ||
     "";
   return String(token || "").trim();
 }
 
 function accountHash(): string {
   return safeHash(deepbridApiKey());
 }
 
 async function getCache<T>(key: string): Promise<T | undefined> {
   if (!env?.storage?.getItem) return undefined;
   try {
     const raw = await env.storage.getItem(key);
     if (!raw) return undefined;
     const record = JSON.parse(raw) as CacheRecord<T>;
     if (record.expiresAt < now()) {
       await env.storage.removeItem(key);
       return undefined;
     }
     return record.value;
   } catch {
     return undefined;
   }
 }
 
 async function setCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
   if (!env?.storage?.setItem) return;
   try {
     const record: CacheRecord<T> = {
       expiresAt: now() + ttlMs,
       value
     };
     await env.storage.setItem(key, JSON.stringify(record));
   } catch {
     // storage write failed silently
   }
 }
 
 async function searchFinderApi(query: string, category?: string): Promise<FinderSearchItem[]> {
   const key = deepbridApiKey();
   if (!key) return [];
   const trimmed = query.trim();
   if (trimmed.length < 3) return [];
 
   const cacheKey = `db:finder:search:${safeHash(trimmed + (category || ""))}`;
   const cached = await getCache<FinderSearchItem[]>(cacheKey);
   if (cached) return cached;
 
   let endpoint = `${DEEPBRID_BASE_URL}/usenet/finder/search?q=${encodeURIComponent(trimmed)}&offset=0&limit=50`;
   if (category) {
     endpoint += `&category=${encodeURIComponent(category)}`;
   }
 
   try {
     const client = env.http.create();
     const response = await client.get(endpoint, {
       headers: {
         "User-Agent": FINDER_USER_AGENT,
         Authorization: `Bearer ${key}`,
         Accept: "application/json"
       }
     });
     const data = response?.data || {};
     const items: FinderSearchItem[] = Array.isArray(data.items) ? data.items : [];
     await setCache(cacheKey, items, SEARCH_TTL_MS);
     return items;
   } catch {
     return [];
   }
 }
 
 async function fetchContentApi(token: string): Promise<FinderContentResponse | null> {
   const key = deepbridApiKey();
   if (!key || !token) return null;
 
   const cacheKey = `db:finder:content:${accountHash()}:${safeHash(token)}`;
   const cached = await getCache<FinderContentResponse>(cacheKey);
   if (cached) return cached;
 
   const endpoint = `${DEEPBRID_BASE_URL}/usenet/finder/content?token=${encodeURIComponent(token)}&archives=1`;
   try {
     const client = env.http.create();
     const response = await client.get(endpoint, {
       headers: {
         "User-Agent": FINDER_USER_AGENT,
         Authorization: `Bearer ${key}`,
         Accept: "application/json"
       }
     });
     const data: FinderContentResponse = response?.data || {};
     if (data && Array.isArray(data.files)) {
       await setCache(cacheKey, data, CONTENT_TTL_MS);
       return data;
     }
     return null;
   } catch {
     return null;
   }
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
     if (!VIDEO_EXTENSIONS_REGEX.test(name)) return false;
     if (SAMPLE_REGEX.test(name)) return false;
     return true;
   });
 
   if (!videoFiles.length) {
     const fallbackLinks = files.filter((f) => f.link && !SAMPLE_REGEX.test(f.name || ""));
     return fallbackLinks[0] || null;
   }
 
   if (season != null && episode != null) {
     const matchingEp = videoFiles.filter((f) => matchesEpisode(f.name, season, episode));
     if (matchingEp.length > 0) {
       return matchingEp.sort((a, b) => (b.size || 0) - (a.size || 0))[0];
     }
   }
 
   return videoFiles.sort((a, b) => (b.size || 0) - (a.size || 0))[0];
 }
 
 export class DeepbridFinderProvider implements BaseProvider {
   metadata: ProviderMetadata = {
     name: "Deepbrid Usenet Finder",
     sourceTypes: [SourceTypes.FREE_HOSTER],
     movie: true,
     episode: true,
     season: false,
     anime: false,
     languages: ["en"]
   };
 
   async searchMovie(movie: Movie): Promise<Source[]> {
     const apiKey = deepbridApiKey();
     if (!apiKey) return [];
 
     const mainTitle = movie.titles?.main?.title || movie.title || "";
     const cleanMain = cleanQuery(mainTitle);
     if (!cleanMain || cleanMain.length < 3) return [];
 
     const titleWords = normalizeTitle(mainTitle).toLowerCase().split(" ").filter(Boolean);
     const queries = [
       movie.year ? `${cleanMain} ${movie.year}` : cleanMain,
       cleanMain
     ].filter((q, idx, arr) => arr.indexOf(q) === idx);
 
     let items: FinderSearchItem[] = [];
     for (const q of queries) {
       const results = await searchFinderApi(q);
       if (results && results.length > 0) {
         items = items.concat(results);
         if (items.length >= 10) break;
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
 
     const sources: Source[] = [];
     for (const { item } of scored) {
       const content = await fetchContentApi(item.token);
       if (!content || !content.files || !content.files.length) continue;
 
       const bestFile = findBestVideoFile(content.files);
       if (bestFile && bestFile.link) {
         sources.push({
           url: bestFile.link,
           name: "Deepbrid Finder",
           title: item.title || bestFile.name,
           size: bestFile.size || item.size,
           type: SourceTypes.FREE_HOSTER,
           filename: bestFile.name || item.title
         } as Source);
       }
     }
 
     return sources;
   }
 
   async searchEpisode(episode: Episode): Promise<Source[]> {
     const apiKey = deepbridApiKey();
     if (!apiKey) return [];
 
     const showTitle = episode.show?.titles?.main?.title || episode.show?.title || "";
     const cleanShow = cleanQuery(showTitle);
     if (!cleanShow || cleanShow.length < 3) return [];
 
     const seasonNo = episode.season?.number || episode.seasonNumber || episode.season;
     const episodeNo = episode.number || episode.episodeNumber;
     if (seasonNo == null || episodeNo == null) return [];
 
     const epCode = episodeCode(seasonNo, episodeNo);
     const sPad = String(seasonNo).padStart(2, "0");
     const showWords = normalizeTitle(showTitle).toLowerCase().split(" ").filter(Boolean);
 
     const queries = [
       `${cleanShow} ${epCode}`,
       `${cleanShow} S${sPad}`,
       `${cleanShow} Season ${seasonNo}`
     ].filter((q, idx, arr) => arr.indexOf(q) === idx);
 
     let items: FinderSearchItem[] = [];
     for (const q of queries) {
       const results = await searchFinderApi(q);
       if (results && results.length > 0) {
         items = items.concat(results);
         if (items.length >= 10) break;
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
 
     const sources: Source[] = [];
     for (const { item } of scored) {
       const content = await fetchContentApi(item.token);
       if (!content || !content.files || !content.files.length) continue;
 
       const bestFile = findBestVideoFile(content.files, seasonNo, episodeNo);
       if (bestFile && bestFile.link) {
         sources.push({
           url: bestFile.link,
           name: "Deepbrid Finder",
           title: item.title || bestFile.name,
           size: bestFile.size || item.size,
           type: SourceTypes.FREE_HOSTER,
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
 
