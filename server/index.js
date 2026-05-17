require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db');

const users = require('./routes/users');
const species = require('./routes/species');
const sightings = require('./routes/sightings');
const comments = require('./routes/comments');
const favorites = require('./routes/favorites');

const app = express();
app.use(cors());
app.use(express.json());

// API
app.use('/api/users', users(db));
app.use('/api/species', species(db));
app.use('/api/sightings', sightings(db));
app.use('/api/comments', comments(db));
app.use('/api/favorites', favorites(db));

// Serve static frontend
const staticPath = path.join(__dirname, '..', 'app', 'static');
app.use(express.static(staticPath));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
