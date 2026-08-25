const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OTAKUDESU_URL = 'https://otakudesu.cloud';

const http = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': OTAKUDESU_URL
    },
    timeout: 12000
});

function getSlug(linkStr) {
    if (!linkStr) return '';
    return linkStr.replace(OTAKUDESU_URL, '').replace('/anime/', '').replace('/episode/', '').replace(/\//g, '');
}

app.get('/api/ongoing', async (req, res) => {
    try {
        const response = await http.get(`${OTAKUDESU_URL}/ongoing-anime/page/${req.query.page || 1}/`);
        const $ = cheerio.load(response.data);
        const ongoingList = [];

        $('.venz ul li').each((_, el) => {
            const title = $(el).find('.j2tl').text().trim();
            const thumb = $(el).find('img').attr('src');
            const epText = $(el).find('.epz').text().trim();
            const epMatch = epText.match(/\d+/);
            const episode = epMatch ? parseInt(epMatch[0]) : 1;
            const link = $(el).find('.thumb a').attr('href');
            const slug = getSlug(link);

            if (title && slug) ongoingList.push({ title, thumb, episode, slug, status: 'Ongoing' });
        });

        res.json({ status: true, data: ongoingList });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false });
        const response = await http.get(`${OTAKUDESU_URL}/?s=${encodeURIComponent(query)}&post_type=anime`);
        const $ = cheerio.load(response.data);
        const searchResults = [];

        $('.chlist li, .ulist li').each((_, el) => {
            const title = $(el).find('a').text().trim();
            const link = $(el).find('a').attr('href');
            const thumb = $(el).find('img').attr('src') || 'https://via.placeholder.com/300x400';
            const slug = getSlug(link);
            if (title && slug) searchResults.push({ title, thumb, slug, status: 'Sub Indo' });
        });

        res.json({ status: true, data: searchResults });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

app.get('/api/anime/:slug', async (req, res) => {
    try {
        const response = await http.get(`${OTAKUDESU_URL}/anime/${req.params.slug}/`);
        const $ = cheerio.load(response.data);
        const title = $('.fotoanime h1').text().trim();
        const thumb = $('.fotoanime img').attr('src');
        const episodes = [];

        $('.eplister ul li').each((_, el) => {
            const epTitle = $(el).find('a').text().trim();
            const epLink = $(el).find('a').attr('href');
            const epSlug = getSlug(epLink);
            const epNumMatch = epTitle.match(/\d+/);
            const episode = epNumMatch ? parseInt(epNumMatch[0]) : 1;
            if (epSlug) episodes.push({ title: epTitle, slug: epSlug, episode });
        });

        res.json({ status: true, data: { title, thumb, episodes: episodes.reverse() } });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

app.get('/api/episode/:epSlug', async (req, res) => {
    try {
        const response = await http.get(`${OTAKUDESU_URL}/episode/${req.params.epSlug}/`);
        const $ = cheerio.load(response.data);
        let iframeUrl = $('#stream1 iframe').attr('src') || $('.responsive-embed-stream iframe').attr('src');

        if (iframeUrl && iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;
        res.json({ status: true, data: { streamUrl: iframeUrl } });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server Live Port ${PORT}`));
