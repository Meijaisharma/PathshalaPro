const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Ye headers video playback ko smooth banate hain
app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// Public folder ko khola
app.use(express.static(path.join(__dirname, 'public')));

// Website ka main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

