const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

// Serve folder 'public' tempat index.html berada
app.use(express.static(path.join(__dirname, 'public')));

// Ganti URL ini kalau domain web target kena internet positif/berubah
const TARGET_URL = 'https://otakudesu.cloud'; 

// 1. API: Get Latest Anime
app.get('/api/home', async (req, res) => {
    try {
        const { data } = await axios.get(`${TARGET_URL}/ongoing-anime/`);
        const $ = cheerio.load(data);
        let result = [];
        $('.venz ul li').each((i, el) => {
            const endpoint = $(el).find('.thumb a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if(endpoint) {
                result.push({
                    id: endpoint,
                    title: $(el).find('h2.jdlflm').text().trim(),
                    cover: $(el).find('img').attr('src'),
                    episodes: $(el).find('.epz').text().trim() || 'Ongoing',
                    score: 'N/A' // Web lokal jarang naruh skor di home
                });
            }
        });
        res.json(result);
    } catch (error) {
        console.error("Home Error:", error.message);
        res.status(500).json([]);
    }
});

// 2. API: Search Anime
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if(!q) return res.json([]);
    try {
        const { data } = await axios.get(`${TARGET_URL}/?s=${q}&post_type=anime`);
        const $ = cheerio.load(data);
        let result = [];
        $('ul.chivsrc li').each((i, el) => {
            const endpoint = $(el).find('h2 a').attr('href')?.split('/anime/')[1]?.replace('/', '');
            if(endpoint) {
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
        res.status(500).json([]);
    }
});

// 3. API: Detail & List Episode
app.get('/api/anime/:id', async (req, res) => {
    try {
        const { data } = await axios.get(`${TARGET_URL}/anime/${req.params.id}/`);
        const $ = cheerio.load(data);
        
        let episodes = [];
        $('.episodelist ul li').each((i, el) => {
            const epLink = $(el).find('a').attr('href');
            const epId = epLink?.split('/episode/')[1]?.replace('/', '');
            const epTitle = $(el).find('a').text().trim();
            if(epId) episodes.push({ id: epId, title: epTitle });
        });

        res.json({
            id: req.params.id,
            title: $('.infozingle p:contains("Judul")').text().replace('Judul: ', '').trim(),
            cover: $('.fotoanime img').attr('src'),
            synopsis: $('.sinopc').text().trim() || 'Sinopsis tidak tersedia.',
            status: $('.infozingle p:contains("Status")').text().replace('Status: ', '').trim(),
            score: $('.infozingle p:contains("Skor")').text().replace('Skor: ', '').trim() || 'N/A',
            genres: $('.infozingle p:contains("Genre")').text().replace('Genre: ', '').trim(),
            episodes: episodes // Array format
        });
    } catch (error) {
        res.status(500).json(null);
    }
});

// 4. API: Get Video Iframe URL
app.get('/api/watch/:epId', async (req, res) => {
    try {
        const { data } = await axios.get(`${TARGET_URL}/episode/${req.params.epId}/`);
        const $ = cheerio.load(data);
        
        // Cari elemen iframe streaming di dalam web
        let iframeSrc = $('#lightsVideo iframe').attr('src') || $('.responsive-embed-stream iframe').attr('src');
        
        res.json({ streamUrl: iframeSrc || '' });
    } catch (error) {
        res.status(500).json({ streamUrl: '' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Riznetic Engine (Scraper) running on http://localhost:${PORT}`);
});
