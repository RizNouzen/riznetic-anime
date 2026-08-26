const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ===== ANILIST API (Ga Pernah Blokir) =====
const ANILIST_API = 'https://graphql.anilist.co';

// Query untuk cari anime
const SEARCH_QUERY = `
query ($search: String, $page: Int) {
  Page(page: $page, perPage: 24) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji english native }
      coverImage { large }
      episodes
      averageScore
      status
      genres
      description
      seasonYear
    }
  }
}`;

// Query untuk detail
const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    coverImage { large }
    episodes
    averageScore
    status
    genres
    description
    seasonYear
  }
}`;

// Helper fetch AniList
async function fetchAniList(query, variables = {}) {
    try {
        const response = await axios.post(ANILIST_API, { query, variables }, {
            timeout: 8000,
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data.data;
    } catch (e) {
        console.error('AniList Error:', e.message);
        return null;
    }
}

// Transform ke format RIZNETIC
function transformAnime(item) {
    const title = item.title?.romaji || item.title?.english || item.title?.native || 'Unknown';
    return {
        id: item.id.toString(),
        title: title,
        englishTitle: item.title?.english || title,
        cover: item.coverImage?.large || '',
        episodes: item.episodes ? `Ep ${item.episodes}` : 'Ongoing',
        score: item.averageScore ? (item.averageScore / 10).toFixed(1) : 'N/A',
        status: item.status || 'Ongoing',
        genres: item.genres ? item.genres.join(', ') : 'Anime',
        synopsis: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 500) : 'Sinopsis tidak tersedia.'
    };
}

// ============ ENDPOINTS ============

// 1. Home
app.get('/api/home', async (req, res) => {
    try {
        const [latestData, popularData] = await Promise.all([
            fetchAniList(SEARCH_QUERY, { search: '', page: 1 }),
            fetchAniList(SEARCH_QUERY, { search: '', page: 2 })
        ]);
        
        const ongoing = (latestData?.Page?.media || []).map(transformAnime);
        const popular = (popularData?.Page?.media || []).map(transformAnime);
        res.json({ ongoing, popular });
    } catch (e) {
        res.json({ ongoing: [], popular: [] });
    }
});

// 2. Latest
app.get('/api/latest', async (req, res) => {
    try {
        const data = await fetchAniList(SEARCH_QUERY, { search: '', page: 1 });
        res.json((data?.Page?.media || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 3. Popular
app.get('/api/popular', async (req, res) => {
    try {
        const data = await fetchAniList(SEARCH_QUERY, { search: '', page: 2 });
        res.json((data?.Page?.media || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 4. Genre
app.get('/api/genre/:name', async (req, res) => {
    try {
        const data = await fetchAniList(SEARCH_QUERY, { search: req.params.name, page: 1 });
        res.json((data?.Page?.media || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 5. Search
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    try {
        const data = await fetchAniList(SEARCH_QUERY, { search: q, page: 1 });
        res.json((data?.Page?.media || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 6. Detail + Episode
app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await fetchAniList(DETAIL_QUERY, { id: parseInt(req.params.id) });
        const item = data?.Media;
        if (!item) return res.status(404).json(null);
        
        const detail = transformAnime(item);
        const epCount = item.episodes || 12;
        const episodes = [];
        for (let i = 1; i <= Math.min(epCount, 50); i++) {
            episodes.push({
                id: `${item.id}-${i}`,
                title: `Episode ${i} (Sub Indo)`
            });
        }
        detail.episodes = episodes;
        res.json(detail);
    } catch (e) {
        res.status(500).json(null);
    }
});

// 7. Video Stream (SUB INDO)
app.get('/api/watch/:epId', (req, res) => {
    const parts = req.params.epId.split('-');
    const malId = parts[0];
    const epNum = parts[1] || 1;
    
    // Multiple source SUB INDO
    const sources = [
        `https://vidsrc.cc/v2/embed/anime/${malId}/${epNum}`,
        `https://vidsrc.net/embed/anime/${malId}/${epNum}`,
        `https://embed.su/embed/anime/${malId}/${epNum}`
    ];
    
    res.json({ 
        streamUrl: sources[0],
        sources: sources
    });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🔥 RIZNETIC running on port ${PORT}`));
}

module.exports = app;
