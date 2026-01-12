const express = require('express');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Credentials from Render Environment Variables
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING);

let client; 

// Connect to Telegram
(async () => {
    console.log("Connecting to Telegram...");
    client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await client.start({ onError: (err) => console.log(err) });
    console.log("✅ Telegram Connected!");
})();

// Helper: ID Calculator
function getRealId(customId) {
    customId = parseInt(customId);
    if (customId <= 115) return customId + 1;
    return customId + 43;
}

// 1. VIDEO STREAMING API
app.get('/api/video/:id', async (req, res) => {
    if (!client) return res.status(500).send("Server starting...");
    try {
        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if (!media) return res.status(404).send("Video not found");

        res.setHeader('Content-Type', 'video/mp4');
        await client.downloadMedia(media, { outputFile: res });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error streaming video");
    }
});

// 2. PDF API
app.get('/api/pdf/:id', async (req, res) => {
    if (!client) return res.status(500).send("Wait...");
    try {
        const msgId = parseInt(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        if(!messages[0]?.media) return res.status(404).send("PDF not found");

        res.setHeader('Content-Type', 'application/pdf');
        await client.downloadMedia(messages[0].media, { outputFile: res });
    } catch (e) {
        res.status(500).send("Error");
    }
});

// 3. META DATA API (New Feature: Fetch Caption/Text) 🌟
app.get('/api/meta/:id', async (req, res) => {
    if (!client) return res.status(500).json({ text: "Loading details..." });
    try {
        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const msg = messages[0];
        
        // Agar caption hai to wo bhejo, nahi to default text
        const caption = msg?.message || "No description available for this lecture.";
        
        res.json({ text: caption });
    } catch (e) {
        res.status(500).json({ text: "Error fetching details." });
    }
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

