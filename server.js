const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Client axios dengan timeout cepat (3 detik) agar Vercel tidak pernah 504 Timeout
const api = axios.create({
    baseURL: 'https://api.jikan.moe/v4',
    timeout: 3000
});

function transformAnime(item) {
    return {
        id: item.mal_id.toString(),
        title: item.title_japanese || item.title,
        englishTitle: item.title,
        cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
        episodes: item.episodes ? `Ep ${item.episodes}` : 'Ongoing',
        score: item.score ? item.score.toString() : '8.5',
        status: item.status || 'Ongoing',
        genres: item.genres ? item.genres.map(g => g.name).join(', ') : 'Anime',
        synopsis: item.synopsis || 'Sinopsis tidak tersedia.'
    };
}

// 1. Home Endpoint
app.get('/api/home', async (req, res) => {
    try {
        const [latestRes, popularRes] = await Promise.all([
            api.get('/seasons/now?limit=12'),
            api.get('/top/anime?limit=12')
        ]);
        const ongoing = latestRes.data.data.map(transformAnime);
        const popular = popularRes.data.data.map(transformAnime);
        res.json({ ongoing, popular });
    } catch (e) {
        res.json({ ongoing: [], popular: [] });
    }
});

// 2. Latest Endpoint
app.get('/api/latest', async (req, res) => {
    try {
        const { data } = await api.get('/seasons/now?limit=24');
        res.json(data.data.map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 3. Popular Endpoint
app.get('/api/popular', async (req, res) => {
    try {
        const { data } = await api.get('/top/anime?limit=24');
        res.json(data.data.map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 4. Genre Endpoint
app.get('/api/genre/:name', async (req, res) => {
    try {
        const { data } = await api.get(`/anime?q=${encodeURIComponent(req.params.name)}&limit=24`);
        res.json(data.data.map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 5. Search Endpoint
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    try {
        const { data } = await api.get(`/anime?q=${encodeURIComponent(q)}&limit=24`);
        res.json(data.data.map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 6. Detail Anime & Episodes List
app.get('/api/anime/:id', async (req, res) => {
    try {
        const { data } = await api.get(`/anime/${req.params.id}`);
        const item = data.data;
        const detail = transformAnime(item);
        
        const epCount = typeof item.episodes === 'number' && item.episodes > 0 ? item.episodes : 12;
        const episodes = [];
        for (let i = 1; i <= Math.min(epCount, 50); i++) {
            episodes.push({
                id: `${item.mal_id}-${i}`,
                title: `Episode ${i} (Sub Indo)`
            });
        }
        detail.episodes = episodes;
        res.json(detail);
    } catch (e) {
        res.status(500).json(null);
    }
});

// 7. Video Stream Server Endpoint
app.get('/api/watch/:epId', (req, res) => {
    const parts = req.params.epId.split('-');
    const malId = parts[0];
    const epNum = parts[1] || 1;
    
    // Multi-server iframe generator
    const streamUrl = `https://vidsrc.cc/v2/embed/anime/${malId}/${epNum}`;
    res.json({ streamUrl });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
