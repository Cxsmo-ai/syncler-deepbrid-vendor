 import assert from "node:assert/strict";
 
 const [, , mode, query, season, episode] = process.argv;
 const apiKey = process.env.DEEPBRID_API_KEY;
 
 if (!apiKey) {
   console.error("Set DEEPBRID_API_KEY before running live checks.");
   process.exit(1);
 }
 
 if (!mode || !query) {
   console.error("Usage: node test/live-finder-check.mjs movie <query>");
   console.error("Usage: node test/live-finder-check.mjs episode <showTitle> <season> <episode>");
   process.exit(1);
 }
 
 const baseUrl = "https://www.deepbrid.com/api/v1";
 const headers = {
   "User-Agent": "Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF",
   Authorization: `Bearer ${apiKey}`,
   Accept: "application/json"
 };
 
 const searchQuery = mode === "movie"
   ? query
   : `${query} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
 
 console.log(`Searching Deepbrid Usenet Finder for: "${searchQuery}"...`);
 
 const searchRes = await fetch(`${baseUrl}/usenet/finder/search?q=${encodeURIComponent(searchQuery)}&offset=0&limit=10`, { headers });
 const searchJson = await searchRes.json();
 
 assert.equal(searchRes.status, 200, `expected HTTP 200, got ${searchRes.status}`);
 assert.equal(searchJson.error, 0, `Deepbrid API error ${searchJson.error}: ${searchJson.message}`);
 assert.ok(Array.isArray(searchJson.items), "expected items array");
 
 console.log(`Found ${searchJson.items.length} items.`);
 
 if (searchJson.items.length > 0) {
   const first = searchJson.items[0];
   console.log(`First item: "${first.title}" (size: ${first.size_human || first.size})`);
   console.log(`Fetching content for token ${first.token}...`);
 
   const contentRes = await fetch(`${baseUrl}/usenet/finder/content?token=${encodeURIComponent(first.token)}&archives=1`, { headers });
   const contentJson = await contentRes.json();
   assert.equal(contentRes.status, 200, `expected HTTP 200, got ${contentRes.status}`);
   assert.equal(contentJson.error, 0, `Deepbrid API error ${contentJson.error}`);
   assert.ok(Array.isArray(contentJson.files), "expected files array");
 
   console.log(`Resolved ${contentJson.files.length} files:`);
   contentJson.files.slice(0, 5).forEach((f) => {
     console.log(`  - ${f.name} (${f.size_human || f.size}) -> ${f.link ? "has direct link" : "no link"}`);
   });
 }
 
 console.log("Live Deepbrid Usenet Finder check successful.");
