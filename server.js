const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi
const API_BASE = 'https://api.jikan.moe/v4';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

// Helper fetch dengan auto fallback ke proxy
async function fetchWithProxy(url) {
    try {
        // Coba langsung dulu
        const response = await axios.get(url, { 
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        console.log('Direct fetch failed, using proxy...');
        // Fallback ke proxy
        const proxyResponse = await axios.get(`${PROXY_URL}${encodeURIComponent(url)}`, { 
            timeout: 10000 
        });
        return proxyResponse.data;
    }
}

// Transform data anime ke format RIZNETIC
function transformAnime(item) {
    return {
        id: item.mal_id?.toString() || '0',
        title: item.title_japanese || item.title || 'Unknown',
        englishTitle: item.title || '',
        cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
        episodes: item.episodes ? `Ep ${item.episodes}` : 'Ongoing',
        score: item.score ? item.score.toString() : 'N/A',
        status: item.status || 'Ongoing',
        genres: item.genres ? item.genres.map(g => g.name).join(', ') : 'Anime',
        synopsis: item.synopsis || 'Sinopsis tidak tersedia.'
    };
}

// ============ ENDPOINTS ============

// 1. Home
app.get('/api/home', async (req, res) => {
    try {
        const [latestData, popularData] = await Promise.all([
            fetchWithProxy(`${API_BASE}/seasons/now?limit=12`),
            fetchWithProxy(`${API_BASE}/top/anime?limit=12`)
        ]);
        const ongoing = (latestData.data || []).map(transformAnime);
        const popular = (popularData.data || []).map(transformAnime);
        res.json({ ongoing, popular });
    } catch (e) {
        res.json({ ongoing: [], popular: [] });
    }
});

// 2. Latest
app.get('/api/latest', async (req, res) => {
    try {
        const data = await fetchWithProxy(`${API_BASE}/seasons/now?limit=24`);
        res.json((data.data || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 3. Popular
app.get('/api/popular', async (req, res) => {
    try {
        const data = await fetchWithProxy(`${API_BASE}/top/anime?limit=24`);
        res.json((data.data || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 4. Genre
app.get('/api/genre/:name', async (req, res) => {
    try {
        const data = await fetchWithProxy(`${API_BASE}/anime?q=${encodeURIComponent(req.params.name)}&limit=24`);
        res.json((data.data || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 5. Search
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    try {
        const data = await fetchWithProxy(`${API_BASE}/anime?q=${encodeURIComponent(q)}&limit=24`);
        res.json((data.data || []).map(transformAnime));
    } catch (e) {
        res.json([]);
    }
});

// 6. Detail Anime + Episode List (SUB INDO)
app.get('/api/anime/:id', async (req, res) => {
    try {
        const data = await fetchWithProxy(`${API_BASE}/anime/${req.params.id}`);
        const item = data.data;
        if (!item) return res.status(404).json(null);
        
        const detail = transformAnime(item);
        const epCount = typeof item.episodes === 'number' && item.episodes > 0 ? item.episodes : 12;
        const episodes = [];
        for (let i = 1; i <= Math.min(epCount, 50); i++) {
            episodes.push({
                id: `${item.mal_id}-${i}`,
                title: `Episode ${i} (Sub Indo)` // SUB INDO di sini
            });
        }
        detail.episodes = episodes;
        res.json(detail);
    } catch (e) {
        res.status(500).json(null);
    }
});

// 7. Video Stream (SUB INDO Player)
app.get('/api/watch/:epId', (req, res) => {
    const parts = req.params.epId.split('-');
    const malId = parts[0];
    const epNum = parts[1] || 1;
    
    // Multiple source SUB INDO
    const sources = [
        `https://vidsrc.cc/v2/embed/anime/${malId}/${epNum}`,
        `https://vidsrc.net/embed/anime/${malId}/${epNum}`,
        `https://embed.su/embed/anime/${malId}/${epNum}`,
        `https://gogoanime.gg/${malId}-episode-${epNum}` // Fallback
    ];
    
    res.json({ 
        streamUrl: sources[0],
        sources: sources
    });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🔥 RIZNETIC SUB INDO running on port ${PORT}`));
}

module.exports = app;
