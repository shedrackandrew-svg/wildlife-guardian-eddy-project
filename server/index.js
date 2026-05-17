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
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const windowMs = 60 * 1000;
const maxRequests = Number(process.env.RATE_LIMIT_MAX || 120);
const rateBuckets = new Map();

app.use((req, res, next) => {
	const key = req.ip || req.headers['x-forwarded-for'] || 'local';
	const now = Date.now();
	const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
	if (now > bucket.resetAt) {
		bucket.count = 0;
		bucket.resetAt = now + windowMs;
	}
	bucket.count += 1;
	rateBuckets.set(key, bucket);
	if (bucket.count > maxRequests) {
		res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
		return res.status(429).json({ error: 'rate limited' });
	}
	next();
});

setInterval(() => {
	const now = Date.now();
	for (const [key, bucket] of rateBuckets.entries()) {
		if (bucket.resetAt <= now) rateBuckets.delete(key);
	}
}, windowMs).unref();

// API
app.use('/api/users', users(db));
app.use('/api/species', species(db));
app.use('/api/sightings', sightings(db));
app.use('/api/comments', comments(db));
app.use('/api/favorites', favorites(db));

// Serve the app root so /static assets and pretty routes both work
const appRoot = path.join(__dirname, '..', 'app');
app.use(express.static(appRoot));

const prettyPages = new Set([
	'library', 'plants', 'dashboard', 'history', 'map', 'live', 'onboarding', 'settings', 'inventory', 'admin', 'remote_camera'
]);

app.get('/:page', (req, res, next) => {
	const page = String(req.params.page || '').replace(/\/+$/g, '');
	if (!prettyPages.has(page)) return next();
	return res.redirect(`/static/${page}.html`);
});

app.get('/', (req, res) => {
	res.sendFile(path.join(appRoot, 'index.html'));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
