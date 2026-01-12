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

async function startTelegram() {
    console.log("🔄 Starting System...");
    client = new TelegramClient(stringSession, apiId, apiHash, { 
        connectionRetries: 5,
        useWSS: true, 
    });
    
    await client.start({ onError: (err) => console.log("System Error:", err) });
    console.log("✅ SYSTEM LIVE: Force DC Mode");
    
    // Heartbeat
    setInterval(async () => {
        if (!client.connected) {
            try { await client.connect(); } catch(e) {}
        }
    }, 20000);
}

startTelegram();

function getRealId(customId) {
    customId = parseInt(customId);
    if (customId <= 115) return customId + 1;
    return customId + 43;
}

// 1. FORCE DC VIDEO API 🔧
app.get('/api/video/:id', async (req, res) => {
    try {
        if (!client.connected) await client.connect();

        const msgId = getRealId(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if (!media || !media.document) {
            console.log(`Video ${msgId} not found or invalid media.`);
            return res.status(404).send("Video not found");
        }

        const doc = media.document;
        const fileSize = Number(doc.size);
        const range = req.headers.range;

        // DEBUG LOG: Dekhte hain DC ID kya hai
        console.log(`Playing Video: ${msgId} | DC_ID: ${doc.dcId} | Size: ${fileSize}`);

        // HEAD Request
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

            // THE FIX: Explicitly passing dcId and fileSize
            // Isse library confuse nahi hogi
            const stream = client.iterDownload(media, { 
                offset: start, 
                limit: chunksize,
                chunkSize: 1024 * 512, // 512KB Chunks
                workers: 1,
                dcId: doc.dcId, // <--- YE HAI ASLI FIX
                fileSize: fileSize
            });

            for await (const chunk of stream) {
                res.write(chunk);
            }
            res.end();

        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            });
            await client.downloadMedia(media, { 
                outputFile: res, 
                workers: 1,
                dcId: doc.dcId // Force DC ID here too
            });
        }

    } catch (error) {
        console.log("Stream Error:", error.message);
        if (!res.headersSent) res.end();
    }
});

// 2. PDF API
app.get('/api/pdf/:id', async (req, res) => {
    try {
        if (!client.connected) await client.connect();
        const msgId = parseInt(req.params.id);
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;
        
        if(!media) return res.status(404).send("PDF not found");
        
        const doc = media.document;
        
        res.setHeader('Content-Length', Number(doc.size));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Note_${msgId}.pdf"`);
        
        await client.downloadMedia(media, { 
            outputFile: res, 
            workers: 1,
            dcId: doc.dcId // Force DC ID
        });
    } catch (e) {
        res.status(500).send("Error");
    }
});

// 3. META API
app.get('/api/meta/:id', async (req, res) => {
    try {
        if (!client.connected) await client.connect();
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

