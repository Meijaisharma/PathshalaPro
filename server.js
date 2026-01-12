const express = require('express');
const { TelegramClient, Api } = require("telegram"); // Api import kiya
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
    console.log("✅ VERSION 3.0 LIVE: Manual Location Mode");
    
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

// 1. ADVANCED VIDEO API (Manual Location Construction) 🔧
app.get('/api/video/:id', async (req, res) => {
    try {
        if (!client.connected) await client.connect();

        const msgId = getRealId(req.params.id);
        
        // 1. Message Fetch karo
        const messages = await client.getMessages("jaikipathshalax", { ids: [msgId] });
        const media = messages[0]?.media;

        if (!media || !media.document) return res.status(404).send("Video not found");

        const doc = media.document;
        const fileSize = Number(doc.size);
        const range = req.headers.range;

        // 2. MANUAL LOCATION BANANA (Ye Error Fix karega) 🛠️
        // Library ko guess mat karne do, khud location bana kar do
        const inputLocation = new Api.InputDocumentFileLocation({
            id: doc.id,
            accessHash: doc.accessHash,
            fileReference: doc.fileReference,
            thumbSize: ""
        });

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

            // Yahan hum sidha 'inputLocation' pass kar rahe hain
            await client.downloadFile(inputLocation, { 
                outputFile: res, 
                offset: start, 
                limit: chunksize,
                workers: 1,
                dcId: doc.dcId // DC ID bhi explicitly bata di
            });
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            });
            await client.downloadFile(inputLocation, { 
                outputFile: res, 
                workers: 1,
                dcId: doc.dcId 
            });
        }

    } catch (error) {
        console.log("Stream Error:", error.message); // Clean Log
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
        // Manual Location for PDF too
        const inputLocation = new Api.InputDocumentFileLocation({
            id: doc.id,
            accessHash: doc.accessHash,
            fileReference: doc.fileReference,
            thumbSize: ""
        });

        res.setHeader('Content-Length', Number(doc.size));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Note_${msgId}.pdf"`);
        
        await client.downloadFile(inputLocation, { 
            outputFile: res, 
            workers: 1,
            dcId: doc.dcId
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

