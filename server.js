const express = require('express');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Credentials
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING);

let client; 

// Optimize Connection
(async () => {
    console.log("Connecting to Telegram...");
    client = new TelegramClient(stringSession, apiId, apiHash, { 
        connectionRetries: 5,
        useWSS: false // Faster on server
    });
    await client.start({ onError: (err) => console.log(err) });
    console.log("✅ Telegram Connected! High Speed Mode ON.");
})();

function getRealId(customId) {
    customId = parseInt(customId);
    if (customId <= 115) return customId + 1;
    return customId + 43;
}

// 1. ULTRA FAST VIDEO STREAMING 🚀
app.get('/api/video/:id', async (req, res) => {
    if (!client) return res.status(500).send("Booting...");
    
    try {
        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if (!media || !media.document) return res.status(404).send("Video not found");

        const fileSize = media.document.size.toJSNumber ? media.document.size.toJSNumber() : media.document.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": "video/mp4",
            });

            // MAGIC LINE: workers: 4 (4x Speed)
            await client.downloadMedia(media, { 
                outputFile: res, 
                offset: start, 
                limit: chunksize,
                workers: 4 
            });
            res.end();

        } else {
            // Full download (Browsers usually don't do this for video)
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            });
            await client.downloadMedia(media, { outputFile: res, workers: 4 });
        }

    } catch (error) {
        // Quiet fail for stream close
        if (!res.headersSent) res.status(500).send("Stream Error");
    }
});

// 2. PDF API
app.get('/api/pdf/:id', async (req, res) => {
    if (!client) return res.status(500).send("Wait...");
    try {
        const msgId = parseInt(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if(!media) return res.status(404).send("PDF not found");
        
        const fileSize = media.document.size;
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Note_${msgId}.pdf"`);
        
        // PDF ke liye bhi workers badhaye
        await client.downloadMedia(media, { outputFile: res, workers: 4 });

    } catch (e) {
        res.status(500).send("Error");
    }
});

// 3. META API
app.get('/api/meta/:id', async (req, res) => {
    if (!client) return res.status(500).json({ text: "Loading..." });
    try {
        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const msg = messages[0];
        const caption = msg?.message || "No description.";
        res.json({ text: caption });
    } catch (e) {
        res.status(500).json({ text: "Error" });
    }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

