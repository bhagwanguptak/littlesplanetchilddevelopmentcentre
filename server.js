const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
const { put, del } = require('@vercel/blob');
const dbManager = require('./database');

const envConfig = dotenv.config({ path: path.resolve(__dirname, 'variables.env') });
const app = express(); 

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));

// Auth Middleware
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ message: 'Access denied.' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });
        req.user = user; next();
    });
}

const upload = multer({ storage: multer.memoryStorage() });
const multerErrorHandler = (err, req, res, next) => next();

// --- ROUTES ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await dbManager.get('SELECT * FROM users WHERE username = ?', [username]);
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials.' });
});

app.get('/api/settings', async (req, res) => {
    try {
        const rows = await dbManager.all('SELECT setting_name, setting_value FROM settings');
        const settings = {};
        // Filter out old "true/false" zombie strings if they exist
        const zombieKeys = ['hero', 'carousel', 'about', 'admissions', 'facilities', 'therapies', 'gallery', 'testimonials', 'contact', 'academics'];
        
        rows.forEach(row => {
            if (zombieKeys.includes(row.setting_name) && row.setting_value === 'true') return; // Skip zombies
            
            let value = row.setting_value;
            if (['socialLinks', 'sectionVisibility'].includes(row.setting_name) && value) {
                try { value = JSON.parse(value); } catch (e) { value = {}; }
            }
            settings[row.setting_name] = value;
        });
        res.json(settings);
    } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

app.post('/api/settings', verifyToken, async (req, res) => {
    const { settings } = req.body;
    try {
        const operations = Object.entries(settings).map(async ([key, value]) => {
            let valueToStore = (typeof value === 'object') ? JSON.stringify(value) : String(value || '');
            await dbManager.run('DELETE FROM settings WHERE setting_name = ?', [key]);
            return dbManager.run('INSERT INTO settings (setting_name, setting_value) VALUES (?, ?)', [key, valueToStore]);
        });
        await Promise.all(operations);
        res.json({ message: 'Saved.' });
    } catch (e) { res.status(500).json({ error: 'Failed.' }); }
});

// ★★★ CRITICAL FIX: Return [] on error, not {} ★★★
app.get('/api/services', async (req, res) => {
    try { res.json(await dbManager.all('SELECT * FROM services ORDER BY id DESC')); } catch(e) { res.json([]); } 
});
app.post('/api/services', verifyToken, upload.single('image'), async (req, res) => {
    let url = '';
    if(req.file) { try { url = (await put(req.file.originalname, req.file.buffer, { access: 'public' })).url; } catch(e){} }
    await dbManager.run('INSERT INTO services (title, description, image_url, icon_class) VALUES (?, ?, ?, ?)', [req.body.title, req.body.description, url, req.body.icon_class]);
    res.json({success:true});
});
app.delete('/api/services/:id', verifyToken, async (req, res) => {
    await dbManager.run('DELETE FROM services WHERE id = ?', [req.params.id]); res.json({success:true});
});

app.get('/api/testimonials', async (req, res) => {
    try { res.json(await dbManager.all('SELECT * FROM testimonials ORDER BY id DESC')); } catch(e) { res.json([]); }
});
app.post('/api/testimonials', verifyToken, async (req, res) => {
    await dbManager.run('INSERT INTO testimonials (name, role, message) VALUES (?, ?, ?)', [req.body.name, req.body.role, req.body.message]);
    res.json({success:true});
});
app.delete('/api/testimonials/:id', verifyToken, async (req, res) => {
    await dbManager.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]); res.json({success:true});
});

app.get('/api/carousel', async (req, res) => {
    try { res.json(await dbManager.all('SELECT * FROM carousel_images ORDER BY display_order ASC')); } catch(e) { res.json([]); }
});
app.post('/api/carousel', verifyToken, upload.single('carouselImage'), async (req, res) => {
    if(!req.file) return res.status(400).json({});
    try {
        const url = (await put(req.file.originalname, req.file.buffer, { access: 'public' })).url;
        await dbManager.run('INSERT INTO carousel_images (image_url, link_url, alt_text, file_name, display_order) VALUES (?, ?, ?, ?, 0)', [url, '', '', req.file.originalname]);
        res.json({success:true});
    } catch(e) { res.status(500).json({}); }
});
app.delete('/api/carousel/:id', verifyToken, async (req, res) => {
    await dbManager.run('DELETE FROM carousel_images WHERE id = ?', [req.params.id]); res.json({success:true});
});

app.post('/api/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    if(!req.file) return res.status(400).json({});
    const url = (await put(req.file.originalname, req.file.buffer, { access: 'public', allowOverwrite: true })).url;
    res.json({ url });
});

app.post('/api/submit-contact', (req, res) => {
    const url = `https://wa.me/${process.env.SCHOOL_WHATSAPP_NUMBER}?text=${encodeURIComponent(req.body.contactMessage)}`;
    res.json({ success: true, action: 'whatsapp', whatsappUrl: url });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'school.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

async function startServer() {
    await dbManager.initialize();
    const admin = await dbManager.get('SELECT * FROM users');
    if(!admin) await dbManager.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', await bcrypt.hash('password123', 10)]);
    app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server running on port ${process.env.PORT || 3000}`));
}
startServer();