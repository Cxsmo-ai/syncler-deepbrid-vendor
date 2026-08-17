 import fs from "node:fs";
 import vm from "node:vm";
 
 const code = fs.readFileSync("syncler-deepbrid-vendor/src/finder-kosmos.js", "utf8");
 
 const mockHttp = {
   get: async (url, opts) => {
     console.log("HTTP GET requested URL:", url);
     console.log("HTTP Headers:", opts.headers);
     if (url.includes("/usenet/finder/search")) {
       return {
         data: {
           error: 0,
           items: [
             {
               token: "tok_tower_prep_s01e01",
               title: "Tower.Prep.S01E01.New.Kid.720p.WEB-DL.DD5.1.H.264-DAWN",
               category: "c33",
               category_name: "HD",
               kind: "video",
               size: 1503238553,
               size_human: "1.4 GB"
             }
           ]
         }
       };
     }
     if (url.includes("/usenet/finder/content")) {
       return {
         data: {
           error: 0,
           title: "Tower.Prep.S01E01.New.Kid.720p.WEB-DL.DD5.1.H.264-DAWN",
           files: [
             {
               name: "Tower.Prep.S01E01.New.Kid.720p.WEB-DL.DD5.1.H.264-DAWN.mkv",
               link: "https://usenet-2.myfast.link/download/towerprep_s01e01.mkv",
               size: 1503238553,
               size_human: "1.4 GB"
             }
           ]
         }
       };
     }
     return { data: {} };
   }
 };
 
 const mockStorage = {
   getItem: async () => null,
   setItem: async () => {},
   removeItem: async () => {}
 };
 
 const mockEnv = {
   http: { create: () => mockHttp },
   storage: mockStorage,
   accounts: {
     deepbrid: {
       token: "test_key_123"
     }
   }
 };
 
 const sandbox = {
   env: mockEnv
 };
 
 vm.runInNewContext(code, sandbox);
 
 const pkg = sandbox.providerPackage || sandbox["provider-package"]?.providerPackage || sandbox.default;
 const metadataList = await pkg.createProviderMetadata();
 const provider = await pkg.createProvider(metadataList[0]);
 
 console.log("Testing searchEpisode with Syncler episode shapes...");
 
 const synclerEpisode1 = {
   show: {
     title: "Tower Prep"
   },
   seasonNumber: 1,
   episodeNumber: 1,
   title: "New Kid"
 };
 
 const sources1 = await provider.searchEpisode(synclerEpisode1);
 console.log("Sources returned for synclerEpisode1:", sources1);
 
 const synclerEpisode2 = {
   show: {
     name: "Tower Prep"
   },
   season: {
     number: 1
   },
   number: 1,
   name: "New Kid"
 };
 
 const sources2 = await provider.searchEpisode(synclerEpisode2);
 console.log("Sources returned for synclerEpisode2:", sources2);
 
 const synclerEpisode3 = {
   showTitle: "Tower Prep",
   season: 1,
   episode: 1
 };
 
 const sources3 = await provider.searchEpisode(synclerEpisode3);
 console.log("Sources returned for synclerEpisode3:", sources3);
