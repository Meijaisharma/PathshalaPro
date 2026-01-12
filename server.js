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

// Connection
(async () => {
    console.log("Connecting to Telegram...");
    client = new TelegramClient(stringSession, apiId, apiHash, { 
        connectionRetries: 5,
        useWSS: false 
    });
    await client.start({ onError: (err) => console.log(err) });
    console.log("✅ Telegram Connected! Gold Standard Mode.");
})();

function getRealId(customId) {
    customId = parseInt(customId);
    if (customId <= 115) return customId + 1;
    return customId + 43;
}

// 1. VIDEO STREAMING (The Logic that worked previously) 🚀
app.get('/api/video/:id', async (req, res) => {
    if (!client) return res.status(500).send("Booting...");
    
    try {
        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if (!media || !media.document) return res.status(404).send("Video not found");

        const fileSize = Number(media.document.size);
        const range = req.headers.range;

        // Browser aksar pehle size puchta hai (HEAD request)
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

            // MANUAL STREAM CONTROL (Ye wala logic best hai)
            const stream = client.iterDownload(media, { 
                offset: start, 
                limit: chunksize,
                chunkSize: 1024 * 1024, // 1MB Chunks (Best for Speed)
                workers: 1 // Stable Streaming
            });

            for await (const chunk of stream) {
                // Agar browser ready nahi hai, to wait karo (Anti-Buffer Logic)
                if (!res.write(chunk)) {
                    await new Promise(resolve => res.once('drain', resolve));
                }
            }
            res.end();

        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            });
            await client.downloadMedia(media, { outputFile: res, workers: 1 });
        }

    } catch (error) {
        if (!res.headersSent) res.end();
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
        
        const fileSize = Number(media.document.size);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Note_${msgId}.pdf"`);
        
        await client.downloadMedia(media, { outputFile: res, workers: 1 });
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

