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

// --- HEARTBEAT & AUTO-RECONNECT SYSTEM ---
async function startTelegram() {
    console.log("🔄 Connecting to Telegram...");
    client = new TelegramClient(stringSession, apiId, apiHash, { 
        connectionRetries: 5,
        useWSS: true, // Render ke liye sabse best setting
        deviceModel: "PathshalaServer",
        appVersion: "1.0.0"
    });
    
    await client.start({ onError: (err) => console.log("Client Error:", err) });
    console.log("✅ Telegram Connected! Ultimate Mode.");
    
    // Heartbeat: Har 30 sec me connection check karega
    setInterval(async () => {
        if (!client.connected) {
            console.log("⚠️ Connection lost, reconnecting...");
            try { await client.connect(); } catch(e) {}
        }
    }, 30000);
}

startTelegram();

function getRealId(customId) {
    customId = parseInt(customId);
    if (customId <= 115) return customId + 1;
    return customId + 43;
}

// 1. STABLE VIDEO STREAMING (Native + WSS) 🛡️
app.get('/api/video/:id', async (req, res) => {
    // Request aate hi connection check karo
    if (!client || !client.connected) {
        console.log("🔌 Reconnecting for video...");
        try { await client.connect(); } catch(e) { return res.status(500).send("Connection Error"); }
    }
    
    try {
        const msgId = getRealId(req.params.id);
        // FRESH FETCH: Har baar naya message layenge taaki link expire na ho
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if (!media || !media.document) return res.status(404).send("Video not found");

        const fileSize = Number(media.document.size);
        const range = req.headers.range;

        // Browser check (HEAD request)
        if (req.method === 'HEAD') {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
                "Accept-Ranges": "bytes"
            });
            return res.end();
        }

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

            // ERROR FIX IS HERE: Using downloadMedia (Native) instead of iterDownload
            await client.downloadMedia(media, { 
                outputFile: res, 
                offset: start, 
                limit: chunksize,
                workers: 1 // Stability ke liye 1 hi rakhein
            });
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            });
            await client.downloadMedia(media, { outputFile: res, workers: 1 });
        }

    } catch (error) {
        // Error chupchap handle karein taaki crash na ho
        if (!res.headersSent) res.end();
    }
});

// 2. PDF API
app.get('/api/pdf/:id', async (req, res) => {
    if (!client.connected) await client.connect();
    try {
        const msgId = parseInt(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;
        
        if(!media) return res.status(404).send("PDF not found");
        
        res.setHeader('Content-Length', Number(media.document.size));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Note_${msgId}.pdf"`);
        
        await client.downloadMedia(media, { outputFile: res, workers: 1 });
    } catch (e) {
        res.status(500).send("Error");
    }
});

// 3. META API
app.get('/api/meta/:id', async (req, res) => {
    if (!client.connected) await client.connect();
    try {
        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        res.json({ text: messages[0]?.message || "No description." });
    } catch (e) {
        res.json({ text: "Loading..." });
    }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

