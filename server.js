const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

// Serve folder public
app.use(express.static(path.join(__dirname, 'public')));

const TARGET_URL = 'https://otakudesu.cloud';
const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    timeout: 8000
};

// Helper Scraper List
async function scrapeList(url) {
    try {
        const { data } = await axios.get(url, AXIOS_CONFIG);
        const $ = cheerio.load(data);
        let result = [];
        $('.venz ul li, .detal ul li').each((i, el) => {
            const endpoint = $(el).find('.thumb a, .thumbz a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if (endpoint) {
                result.push({
                    id: endpoint,
                    title: $(el).find('h2.jdlflm, h2').text().trim(),
                    cover: $(el).find('img').attr('src'),
                    episodes: $(el).find('.epz').text().trim() || 'Sub Indo',
                    score: $(el).find('.epztipe').text().trim() || 'N/A'
                });
            }
        });
        return result;
    } catch (e) {
        return [];
    }
}

// 1. Home Data
app.get('/api/home', async (req, res) => {
    const ongoing = await scrapeList(`${TARGET_URL}/ongoing-anime/`);
    const complete = await scrapeList(`${TARGET_URL}/complete-anime/`);
    res.json({ ongoing, popular: complete });
});

// 2. Terbaru
app.get('/api/latest', async (req, res) => {
    const data = await scrapeList(`${TARGET_URL}/ongoing-anime/`);
    res.json(data);
});

// 3. Populer / Complete
app.get('/api/popular', async (req, res) => {
    const data = await scrapeList(`${TARGET_URL}/complete-anime/`);
    res.json(data);
});

// 4. Genre
app.get('/api/genre/:name', async (req, res) => {
    const genreName = req.params.name.toLowerCase();
    const data = await scrapeList(`${TARGET_URL}/genres/${genreName}/`);
    res.json(data);
});

// 5. Search
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    try {
        const { data } = await axios.get(`${TARGET_URL}/?s=${encodeURIComponent(q)}&post_type=anime`, AXIOS_CONFIG);
        const $ = cheerio.load(data);
        let result = [];
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
        res.json(result);
    } catch (error) {
        res.json([]);
    }
});

// 6. Detail Anime & Episodes
app.get('/api/anime/:id', async (req, res) => {
    try {
        const { data } = await axios.get(`${TARGET_URL}/anime/${req.params.id}/`, AXIOS_CONFIG);
        const $ = cheerio.load(data);
        
        let episodes = [];
        $('.episodelist ul li').each((i, el) => {
            const epLink = $(el).find('a').attr('href');
            const epId = epLink?.split('/episode/')[1]?.replace('/', '');
            const epTitle = $(el).find('a').text().trim();
            if (epId) episodes.push({ id: epId, title: epTitle });
        });

        res.json({
            id: req.params.id,
            title: $('.infozingle p:contains("Judul")').text().replace('Judul: ', '').trim() || $('h1').text().trim(),
            cover: $('.fotoanime img').attr('src'),
            synopsis: $('.sinopc').text().trim() || 'Sinopsis tidak tersedia.',
            status: $('.infozingle p:contains("Status")').text().replace('Status: ', '').trim() || 'Ongoing',
            score: $('.infozingle p:contains("Skor")').text().replace('Skor: ', '').trim() || 'N/A',
            genres: $('.infozingle p:contains("Genre")').text().replace('Genre: ', '').trim() || 'Anime',
            episodes: episodes
        });
    } catch (error) {
        res.status(500).json(null);
    }
});

// 7. Streaming Video Iframe
app.get('/api/watch/:epId', async (req, res) => {
    try {
        const { data } = await axios.get(`${TARGET_URL}/episode/${req.params.epId}/`, AXIOS_CONFIG);
        const $ = cheerio.load(data);
        let iframeSrc = $('#lightsVideo iframe').attr('src') || $('.responsive-embed-stream iframe').attr('src');
        res.json({ streamUrl: iframeSrc || '' });
    } catch (error) {
        res.status(500).json({ streamUrl: '' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
