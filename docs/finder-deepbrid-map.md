 # Deepbrid Usenet Finder Map for Syncler
 
 This package adds native **Deepbrid Usenet Finder** integration to Syncler via Kosmos.
 
 Unlike external indexers (such as Althub/Newznab), this calls Deepbrid's own indexed Usenet search and content extraction API directly.
 
 ## API Endpoints
 
 Deepbrid exposes private/native app endpoints:
 
 ### 1. Categories
 
 ```text
 GET https://www.deepbrid.com/api/v1/usenet/finder/categories
 Headers:
   User-Agent: Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF
   Authorization: Bearer {deepbridApiKey}
 ```
 
 ### 2. Search
 
 ```text
 GET https://www.deepbrid.com/api/v1/usenet/finder/search?q={query}&offset=0&limit=50
 Headers:
   User-Agent: Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF
   Authorization: Bearer {deepbridApiKey}
 ```
 
 Response items include:
 - `token`: Encoded content identifier
 - `title`: Release name
 - `category`, `category_name`, `kind`
 - `size`, `size_human`
 - `sources`
 
 ### 3. Content & Archive Extraction
 
 ```text
 GET https://www.deepbrid.com/api/v1/usenet/finder/content?token={token}&archives=1
 Headers:
   User-Agent: Deepbrid/1.0 (ios) DBX/k9Q4mZ2xV7bN1pR8sT3wY6cH0jL5dF
   Authorization: Bearer {deepbridApiKey}
 ```
 
 Setting `archives=1` tells Deepbrid to expand RAR/7z/ZIP archives into direct playable video streams on Deepbrid debrid servers.
 
 ## Syncler Kosmos Workflow
 
 1. **Query Construction**:
    - Movies: `{Title} {Year}` (with fallback to `{Title}`)
    - Episodes: `{ShowTitle} S{Season}E{Episode}` (with fallback to season packs `{ShowTitle} S{Season}`)
 
 2. **Candidate Selection & Scoring**:
    - Queries Deepbrid Usenet Finder search.
    - Matches title tokens, release year, resolution (4K/2160p, 1080p, 720p), codec, source (Remux, BluRay, WEB-DL).
    - Filters out non-video formats.
 
 3. **Content Resolution**:
    - For the top scored candidates, calls `/usenet/finder/content` with `archives=1`.
    - Results are cached in Syncler storage (`env.storage`) to prevent redundant API calls.
    - Selects the target video file (matching the specific episode in a season pack, or the main movie file).
 
 4. **Stream Return**:
    - Returns direct playable `Source` objects to Syncler.
 
