 (function (root, factory) {
   if (typeof module === "object" && module.exports) {
     var sdk;
     try { sdk = require("package-sdk"); } catch (e) { sdk = (root && root["package-sdk"]) || {}; }
     module.exports = factory(sdk);
   } else if (typeof define === "function" && define.amd) {
     define(["package-sdk"], factory);
   } else {
     var target = (typeof globalThis !== "undefined") ? globalThis : (typeof self !== "undefined") ? self : (typeof window !== "undefined") ? window : (typeof global !== "undefined") ? global : root || this || {};
     var sdk = (target && target["package-sdk"]) || (root && root["package-sdk"]) || {};
     var exported = factory(sdk);
     if (target) {
       target["provider-package"] = exported;
       target.providerPackage = exported.providerPackage || exported;
       target.default = exported.default || exported;
     }
     if (root && root !== target) {
       root["provider-package"] = exported;
       root.providerPackage = exported.providerPackage || exported;
       root.default = exported.default || exported;
     }
   }
 })(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this, function (packageSdk) {
   var SourceTypes = (packageSdk && packageSdk.SourceTypes) || {
     DEBRID: "DEBRID",
     TORRENT: "TORRENT",
     FREE_HOSTER: "FREE_HOSTER",
     HOSTER: "HOSTER",
     DIRECT: "DIRECT"
   };
   const DEEPBRID_BASE_URL = "https://www.deepbrid.com/api/v1";
   const FINDER_USER_AGENT = "Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF";
   const SEARCH_TTL_MS = 12 * 60 * 60 * 1000;
   const CONTENT_TTL_MS = 6 * 60 * 60 * 1000;
   const MAX_CANDIDATES = 6;
 
   const VIDEO_EXTENSIONS_REGEX = /\.(mkv|mp4|avi|ts|m4v|mov|webm|wmv|flv|iso)$/i;
   const NON_VIDEO_EXTENSIONS_REGEX = /\.(par2|nfo|nzb|sfv|srr|txt|jpg|png|gif|srt|sub|idx|exe|apk|zip)$/i;
   const SAMPLE_REGEX = /(sample|trailer|featurette)/i;
 
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
     const s = String(season || "").padStart(2, "0");
     const e = String(episode || "").padStart(2, "0");
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
     const sNum = parseInt(String(season), 10);
     const eNum = parseInt(String(episode), 10);
     if (isNaN(sNum) || isNaN(eNum)) return false;
 
     const sPad = String(sNum).padStart(2, "0");
     const ePad = String(eNum).padStart(2, "0");
 
     const patterns = [
       new RegExp("\\bS0*?" + sNum + "E0*?" + eNum + "\\b", "i"),
       new RegExp("\\b0*?" + sNum + "x0*?" + eNum + "\\b", "i"),
       new RegExp("\\[0*?" + sNum + "x0*?" + eNum + "\\]", "i"),
       new RegExp("\\bS" + sPad + "E" + ePad + "\\b", "i"),
       new RegExp("\\bS" + sNum + "E" + eNum + "\\b", "i")
     ];
 
     for (let i = 0; i < patterns.length; i += 1) {
       if (patterns[i].test(text)) return true;
     }
     return false;
   }
 
   function safeHash(value) {
     let hash = 2166136261;
     for (let index = 0; index < value.length; index += 1) {
       hash ^= value.charCodeAt(index);
       hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
     }
     return (hash >>> 0).toString(16);
   }
 
   function deepbridApiKey() {
     if (typeof env === "undefined") return "";
 
     if (env.accounts) {
       if (env.accounts.deepbrid) {
         if (typeof env.accounts.deepbrid === "string") return env.accounts.deepbrid.trim();
         if (env.accounts.deepbrid.token) return String(env.accounts.deepbrid.token).trim();
         if (env.accounts.deepbrid.apiKey) return String(env.accounts.deepbrid.apiKey).trim();
         if (env.accounts.deepbrid.key) return String(env.accounts.deepbrid.key).trim();
       }
       if (Array.isArray(env.accounts)) {
         for (var i = 0; i < env.accounts.length; i += 1) {
           var acc = env.accounts[i];
           if (acc && (acc.alias === "deepbrid" || acc.name === "deepbrid" || acc.id === "deepbrid")) {
             if (acc.token) return String(acc.token).trim();
             if (acc.apiKey) return String(acc.apiKey).trim();
           }
         }
         if (env.accounts[0] && env.accounts[0].token) return String(env.accounts[0].token).trim();
       }
     }
 
     if (env.account) {
       if (typeof env.account === "string") return env.account.trim();
       if (env.account.token) return String(env.account.token).trim();
       if (env.account.apiKey) return String(env.account.apiKey).trim();
       if (env.account.key) return String(env.account.key).trim();
     }
 
     if (env.settings) {
       if (env.settings.deepbridApiKey) return String(env.settings.deepbridApiKey).trim();
       if (env.settings.apiKey) return String(env.settings.apiKey).trim();
       if (env.settings.token) return String(env.settings.token).trim();
       if (env.settings.key) return String(env.settings.key).trim();
     }
 
     return "";
   }
 
   function accountHash() {
     return safeHash(deepbridApiKey());
   }
 
   async function getCache(key) {
     if (typeof env === "undefined" || !env.storage || !env.storage.getItem) return undefined;
     try {
       const raw = await env.storage.getItem(key);
       if (!raw) return undefined;
       const record = JSON.parse(raw);
       if (record.expiresAt < now()) {
         await env.storage.removeItem(key);
         return undefined;
       }
       return record.value;
     } catch {
       return undefined;
     }
   }
 
   async function setCache(key, value, ttlMs) {
     if (typeof env === "undefined" || !env.storage || !env.storage.setItem) return;
     try {
       await env.storage.setItem(key, JSON.stringify({ expiresAt: now() + ttlMs, value: value }));
     } catch {
       // ignored
     }
   }
 
   async function safeHttpGet(url, headers) {
     if (typeof env === "undefined" || !env.http || !env.http.create) return null;
     try {
       var client = env.http.create();
       var res = await client.get(url, { headers: headers });
       if (!res) return null;
       var raw = res.data != null ? res.data : res.body != null ? res.body : res;
       if (typeof raw === "string") {
         try { return JSON.parse(raw); } catch (e) { return null; }
       }
       return raw;
     } catch (err) {
       return null;
     }
   }
 
   async function searchFinderApi(query, category) {
     const key = deepbridApiKey();
     if (!key) return [];
     const trimmed = query.trim();
     if (trimmed.length < 2) return [];
 
     const cacheKey = "db:finder:search:" + safeHash(trimmed + (category || ""));
     const cached = await getCache(cacheKey);
     if (cached) return cached;
 
     let endpoint = DEEPBRID_BASE_URL + "/usenet/finder/search?q=" + encodeURIComponent(trimmed) + "&offset=0&limit=50";
     if (category) {
       endpoint += "&category=" + encodeURIComponent(category);
     }
 
     const data = await safeHttpGet(endpoint, {
       "User-Agent": FINDER_USER_AGENT,
       Authorization: "Bearer " + key,
       Accept: "application/json"
     });
 
     const items = Array.isArray(data && data.items) ? data.items : [];
     if (items.length > 0) {
       await setCache(cacheKey, items, SEARCH_TTL_MS);
     }
     return items;
   }
 
   async function fetchContentApi(token) {
     const key = deepbridApiKey();
     if (!key || !token) return null;
 
     const cacheKey = "db:finder:content:" + accountHash() + ":" + safeHash(token);
     const cached = await getCache(cacheKey);
     if (cached) return cached;
 
     const endpoint = DEEPBRID_BASE_URL + "/usenet/finder/content?token=" + encodeURIComponent(token) + "&archives=1";
     const data = await safeHttpGet(endpoint, {
       "User-Agent": FINDER_USER_AGENT,
       Authorization: "Bearer " + key,
       Accept: "application/json"
     });
 
     if (data && Array.isArray(data.files)) {
       await setCache(cacheKey, data, CONTENT_TTL_MS);
       return data;
     }
     return null;
   }
 
   function scoreMovieItem(item, titleWords, year) {
     const title = (item.title || "").toLowerCase();
     let score = 0;
 
     for (let i = 0; i < titleWords.length; i += 1) {
       const word = titleWords[i];
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
 
   function scoreEpisodeItem(item, showWords, season, episode) {
     const title = (item.title || "").toLowerCase();
     let score = 0;
 
     for (let i = 0; i < showWords.length; i += 1) {
       const word = showWords[i];
       if (title.includes(word)) score += 5;
       else score -= 3;
     }
 
     if (season != null && episode != null) {
       if (matchesEpisode(item.title, season, episode)) {
         score += 20;
       } else {
         const sNum = parseInt(String(season), 10);
         const sPattern = new RegExp("\\b(?:season|s)[. _-]*0*?" + sNum + "\\b", "i");
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
 
   function findBestVideoFile(files, season, episode) {
     if (!files || !files.length) return null;
 
     const videoFiles = files.filter(function (file) {
       if (!file.link) return false;
       const name = file.name || "";
       if (NON_VIDEO_EXTENSIONS_REGEX.test(name)) return false;
       if (!VIDEO_EXTENSIONS_REGEX.test(name)) return false;
       if (SAMPLE_REGEX.test(name)) return false;
       return true;
     });
 
     if (!videoFiles.length) {
       const fallbackLinks = files.filter(function (f) {
         return f.link && !NON_VIDEO_EXTENSIONS_REGEX.test(f.name || "") && !SAMPLE_REGEX.test(f.name || "");
       });
       return fallbackLinks[0] || null;
     }
 
     if (season != null && episode != null) {
       const matchingEp = videoFiles.filter(function (f) {
         return matchesEpisode(f.name, season, episode);
       });
       if (matchingEp.length > 0) {
         return matchingEp[0];
       }
     }
 
     return videoFiles.sort(function (a, b) {
       return (b.size || 0) - (a.size || 0);
     })[0];
   }
 
   class DeepbridFinderProvider {
     constructor() {
       this.metadata = {
         name: "Deepbrid Usenet Finder",
         sourceTypes: [
           SourceTypes.DEBRID || "DEBRID",
           SourceTypes.TORRENT || "TORRENT",
           SourceTypes.FREE_HOSTER || "FREE_HOSTER"
         ],
         movie: true,
         episode: true,
         season: false,
         anime: false,
         languages: ["en"]
       };
     }
 
     async searchMovie(movie) {
       const apiKey = deepbridApiKey();
       if (!apiKey) return [];
 
       const mainTitle = extractMovieTitle(movie);
       const cleanMain = cleanQuery(mainTitle);
       if (!cleanMain || cleanMain.length < 2) return [];
 
       const titleWords = normalizeTitle(mainTitle).toLowerCase().split(" ").filter(Boolean);
       const queries = [
         movie.year ? cleanMain + " " + movie.year : cleanMain,
         cleanMain
       ].filter(function (q, idx, arr) {
         return arr.indexOf(q) === idx;
       });
 
       let items = [];
       for (let i = 0; i < queries.length; i += 1) {
         const results = await searchFinderApi(queries[i]);
         if (results && results.length > 0) {
           items = results;
           break;
         }
       }
 
       if (!items.length) return [];
 
       const seenTokens = new Set();
       const uniqueItems = items.filter(function (item) {
         if (!item.token || seenTokens.has(item.token)) return false;
         seenTokens.add(item.token);
         return true;
       });
 
       const scored = uniqueItems
         .map(function (item) {
           return { item: item, score: scoreMovieItem(item, titleWords, movie.year) };
         })
         .filter(function (entry) {
           return entry.score > 0;
         })
         .sort(function (a, b) {
           return b.score - a.score;
         })
         .slice(0, MAX_CANDIDATES);
 
       const contentResults = await Promise.all(
         scored.map(function (entry) {
           return fetchContentApi(entry.item.token).then(function (content) {
             return { item: entry.item, content: content };
           });
         })
       );
 
       const sources = [];
       for (let j = 0; j < contentResults.length; j += 1) {
         const item = contentResults[j].item;
         const content = contentResults[j].content;
         if (!content || !content.files || !content.files.length) continue;
 
         const bestFile = findBestVideoFile(content.files);
         if (bestFile && bestFile.link) {
           sources.push({
             url: bestFile.link,
             name: "Deepbrid Finder",
             title: item.title || bestFile.name,
             size: bestFile.size || item.size,
             type: SourceTypes.DEBRID || "DEBRID",
             quality: extractQuality(item.title || bestFile.name),
             resolution: extractResolution(item.title || bestFile.name),
             seeds: item.sources || 1,
             filename: bestFile.name || item.title
           });
         }
       }
 
       return sources;
     }
 
     async searchEpisode(episode) {
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
         cleanShow + " " + epCode,
         cleanShow + " S" + seasonNo + "E" + episodeNo,
         cleanShow + " S" + sPad,
         cleanShow + " Season " + seasonNo,
         cleanShow
       ].filter(function (q, idx, arr) {
         return arr.indexOf(q) === idx;
       });
 
       let items = [];
       for (let i = 0; i < queries.length; i += 1) {
         const results = await searchFinderApi(queries[i]);
         if (results && results.length > 0) {
           items = results;
           break;
         }
       }
 
       if (!items.length) return [];
 
       const seenTokens = new Set();
       const uniqueItems = items.filter(function (item) {
         if (!item.token || seenTokens.has(item.token)) return false;
         seenTokens.add(item.token);
         return true;
       });
 
       const scored = uniqueItems
         .map(function (item) {
           return { item: item, score: scoreEpisodeItem(item, showWords, seasonNo, episodeNo) };
         })
         .filter(function (entry) {
           return entry.score > 0;
         })
         .sort(function (a, b) {
           return b.score - a.score;
         })
         .slice(0, MAX_CANDIDATES);
 
       const contentResults = await Promise.all(
         scored.map(function (entry) {
           return fetchContentApi(entry.item.token).then(function (content) {
             return { item: entry.item, content: content };
           });
         })
       );
 
       const sources = [];
       for (let j = 0; j < contentResults.length; j += 1) {
         const item = contentResults[j].item;
         const content = contentResults[j].content;
         if (!content || !content.files || !content.files.length) continue;
 
         const bestFile = findBestVideoFile(content.files, seasonNo, episodeNo);
         if (bestFile && bestFile.link) {
           sources.push({
             url: bestFile.link,
             name: "Deepbrid Finder",
             title: item.title || bestFile.name,
             size: bestFile.size || item.size,
             type: SourceTypes.DEBRID || "DEBRID",
             quality: extractQuality(item.title || bestFile.name),
             resolution: extractResolution(item.title || bestFile.name),
             seeds: item.sources || 1,
             filename: bestFile.name || item.title
           });
         }
       }
 
       return sources;
     }
 
     async searchSeason(_season) {
       return [];
     }
   }
 
   const providers = [new DeepbridFinderProvider()];
 
   class DeepbridFinderPackage {
     createProviderMetadata() {
       return Promise.resolve(providers.map(function (provider) { return provider.metadata; }));
     }
 
     createProvider(metadata) {
       const provider = providers.find(function (candidate) { return candidate.metadata.name === metadata.name; });
       if (!provider) throw new Error("Unknown provider " + metadata.name);
       return Promise.resolve(provider);
     }
   }
 
   const pkgInstance = new DeepbridFinderPackage();
   return { providerPackage: pkgInstance, default: pkgInstance };
 });
