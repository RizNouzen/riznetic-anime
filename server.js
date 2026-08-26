const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

// Menggunakan cdn/mirror target yang aktif
const TARGET_URL = 'https://otakudesu.cloud';
const CONSUMET_FALLBACK = 'https://api.consumet.org/anime/gogoanime';

// Headers khusus untuk menyamarkan request Vercel agar tidak mudah dicegat Cloudflare
const AXIOS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

async function fetchHTML(url) {
    try {
        const { data } = await axios.get(url, { headers: AXIOS_HEADERS, timeout: 7000 });
        return data;
    } catch (err) {
        console.error(`Fetch failed for ${url}:`, err.message);
        return null;
    }
}

// 1. Home Endpoint
app.get('/api/home', async (req, res) => {
    const html = await fetchHTML(`${TARGET_URL}/ongoing-anime/`);
    let ongoing = [];
    let popular = [];

    if (html) {
        const $ = cheerio.load(html);
        $('.venz ul li').each((i, el) => {
            const endpoint = $(el).find('.thumb a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if (endpoint) {
                ongoing.push({
                    id: endpoint,
                    title: $(el).find('h2.jdlflm').text().trim(),
                    cover: $(el).find('img').attr('src'),
                    episodes: $(el).find('.epz').text().trim() || 'Sub Indo',
                    score: 'N/A'
                });
            }
        });
    }

    // Fallback jika Otakudesu memblokir IP Vercel (menggunakan public API backup)
    if (ongoing.length === 0) {
        try {
            const { data } = await axios.get(`${CONSUMET_FALLBACK}/top-airing`, { timeout: 5000 });
            if (data && data.results) {
                ongoing = data.results.map(item => ({
                    id: item.id,
                    title: item.title,
                    cover: item.image,
                    episodes: `Ep ${item.episodeNumber || '?'}`,
                    score: '8.0'
                }));
            }
        } catch (e) {
            console.error("Fallback API also failed");
        }
    }

    res.json({ ongoing, popular: ongoing.slice().reverse() });
});

// 2. Latest Endpoint
app.get('/api/latest', async (req, res) => {
    const html = await fetchHTML(`${TARGET_URL}/ongoing-anime/`);
    let result = [];
    if (html) {
        const $ = cheerio.load(html);
        $('.venz ul li').each((i, el) => {
            const endpoint = $(el).find('.thumb a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if (endpoint) {
                result.push({
                    id: endpoint,
                    title: $(el).find('h2.jdlflm').text().trim(),
                    cover: $(el).find('img').attr('src'),
                    episodes: $(el).find('.epz').text().trim() || 'Sub Indo',
                    score: 'N/A'
                });
            }
        });
    }
    res.json(result);
});

// 3. Popular Endpoint
app.get('/api/popular', async (req, res) => {
    const html = await fetchHTML(`${TARGET_URL}/complete-anime/`);
    let result = [];
    if (html) {
        const $ = cheerio.load(html);
        $('.venz ul li').each((i, el) => {
            const endpoint = $(el).find('.thumb a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if (endpoint) {
                result.push({
                    id: endpoint,
                    title: $(el).find('h2.jdlflm').text().trim(),
                    cover: $(el).find('img').attr('src'),
                    episodes: $(el).find('.epz').text().trim() || 'Complete',
                    score: 'N/A'
                });
            }
        });
    }
    res.json(result);
});

// 4. Genre Endpoint
app.get('/api/genre/:name', async (req, res) => {
    const genre = req.params.name.toLowerCase();
    const html = await fetchHTML(`${TARGET_URL}/genres/${genre}/`);
    let result = [];
    if (html) {
        const $ = cheerio.load(html);
        $('.col-anime').each((i, el) => {
            const endpoint = $(el).find('.col-anime-title a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if (endpoint) {
                result.push({
                    id: endpoint,
                    title: $(el).find('.col-anime-title a').text().trim(),
                    cover: $(el).find('.col-anime-cover img').attr('src'),
                    episodes: $(el).find('.col-anime-eps').text().trim(),
                    score: $(el).find('.col-anime-rating').text().trim() || 'N/A'
                });
            }
        });
    }
    res.json(result);
});

// 5. Search Endpoint
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    
    const html = await fetchHTML(`${TARGET_URL}/?s=${encodeURIComponent(q)}&post_type=anime`);
    let result = [];
    if (html) {
        const $ = cheerio.load(html);
        $('ul.chivsrc li').each((i, el) => {
            const endpoint = $(el).find('h2 a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if (endpoint) {
                result.push({
                    id: endpoint,
                    title: $(el).find('h2 a').text().trim(),
                    cover: $(el).find('img').attr('src'),
                    genres: $(el).find('.set:contains("Genres")').text().replace('Genres : ', '').trim(),
                    score: 'N/A'
                });
            }
        });
    }

    // Fallback search jika scraper diblokir
    if (result.length === 0) {
        try {
            const { data } = await axios.get(`${CONSUMET_FALLBACK}/${encodeURIComponent(q)}`, { timeout: 5000 });
            if (data && data.results) {
                result = data.results.map(item => ({
                    id: item.id,
                    title: item.title,
                    cover: item.image,
                    genres: 'Anime',
                    score: 'N/A'
                }));
            }
        } catch (e) {}
    }

    res.json(result);
});

// 6. Anime Detail & Episodes
app.get('/api/anime/:id', async (req, res) => {
    const html = await fetchHTML(`${TARGET_URL}/anime/${req.params.id}/`);
    if (html) {
        const $ = cheerio.load(html);
        let episodes = [];
        $('.episodelist ul li').each((i, el) => {
            const epLink = $(el).find('a').attr('href');
            const epId = epLink?.split('/episode/')[1]?.replace('/', '');
            const epTitle = $(el).find('a').text().trim();
            if (epId) episodes.push({ id: epId, title: epTitle });
        });

        return res.json({
            id: req.params.id,
            title: $('.infozingle p:contains("Judul")').text().replace('Judul: ', '').trim() || $('h1').text().trim(),
            cover: $('.fotoanime img').attr('src'),
            synopsis: $('.sinopc').text().trim() || 'Sinopsis tidak tersedia.',
            status: $('.infozingle p:contains("Status")').text().replace('Status: ', '').trim() || 'Ongoing',
            score: $('.infozingle p:contains("Skor")').text().replace('Skor: ', '').trim() || 'N/A',
            genres: $('.infozingle p:contains("Genre")').text().replace('Genre: ', '').trim() || 'Anime',
            episodes: episodes
        });
    }

    // Fallback Detail
    try {
        const { data } = await axios.get(`${CONSUMET_FALLBACK}/info/${req.params.id}`);
        if (data) {
            return res.json({
                id: data.id,
                title: data.title,
                cover: data.image,
                synopsis: data.description || 'Sinopsis tidak tersedia.',
                status: data.status || 'Ongoing',
                score: '8.0',
                genres: Array.isArray(data.genres) ? data.genres.join(', ') : 'Anime',
                episodes: (data.episodes || []).map(e => ({ id: e.id, title: `Episode ${e.number}` }))
            });
        }
    } catch (e) {}

    res.status(404).json(null);
});

// 7. Stream Link
app.get('/api/watch/:epId', async (req, res) => {
    const html = await fetchHTML(`${TARGET_URL}/episode/${req.params.epId}/`);
    if (html) {
        const $ = cheerio.load(html);
        let iframeSrc = $('#lightsVideo iframe').attr('src') || $('.responsive-embed-stream iframe').attr('src');
        if (iframeSrc) return res.json({ streamUrl: iframeSrc });
    }

    // Fallback Stream Link
    try {
        const { data } = await axios.get(`${CONSUMET_FALLBACK}/watch/${req.params.epId}`);
        if (data && data.headers && data.sources && data.sources.length > 0) {
            return res.json({ streamUrl: data.sources[0].url });
        }
    } catch (e) {}

    res.json({ streamUrl: '' });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
