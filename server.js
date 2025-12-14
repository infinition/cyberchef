const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for large data
app.use(express.static(__dirname)); // Serve static files (index.html, css, etc.)

// Paths
const RECIPES_FILE = path.join(__dirname, 'recipes', 'recipes.json');
const MEDIA_DIR = path.join(__dirname, 'recipes', 'medias');

// Ensure directories exist
if (!fs.existsSync(path.dirname(RECIPES_FILE))) fs.mkdirSync(path.dirname(RECIPES_FILE), { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// --- API ROUTES ---

// GET Recipes
app.get('/api/recipes', (req, res) => {
    if (fs.existsSync(RECIPES_FILE)) {
        fs.readFile(RECIPES_FILE, 'utf8', (err, data) => {
            if (err) return res.status(500).json({ error: 'Failed to read file' });
            try {
                const json = JSON.parse(data);
                res.json(json);
            } catch (e) {
                res.json([]); // Return empty if file is corrupt or empty
            }
        });
    } else {
        res.json([]);
    }
});

// SAVE Recipes
app.post('/api/recipes', (req, res) => {
    const recipes = req.body;
    fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2), (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to save file' });
        }
        res.json({ success: true, count: recipes.length });
    });
});

// UPLOAD Image
// UPLOAD Image
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = MEDIA_DIR;
        if (req.body.folder) {
            // Allow nested folders: split by / or \, sanitize each part, then join
            const parts = req.body.folder.split(/[/\\]/);
            const safeParts = parts.map(p => p.replace(/[^a-z0-9\-_]/gi, '_'));
            const safeFolder = path.join(...safeParts);

            uploadPath = path.join(MEDIA_DIR, safeFolder);
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Sanitize filename and keep extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct relative path
    let relativePath = '/recipes/medias/';
    if (req.body.folder) {
        // Re-sanitize for URL construction (force forward slashes)
        const parts = req.body.folder.split(/[/\\]/);
        const safeParts = parts.map(p => p.replace(/[^a-z0-9\-_]/gi, '_'));
        const safeFolder = safeParts.join('/');
        relativePath += safeFolder + '/';
    }
    relativePath += req.file.filename;

    res.json({ path: relativePath });
});

// DELETE File
app.delete('/api/file', (req, res) => {
    const relativePath = req.body.path;
    if (!relativePath) return res.status(400).json({ error: 'No path provided' });

    // Security check: ensure path is within MEDIA_DIR
    const fullPath = path.join(__dirname, relativePath);
    const resolvedPath = path.resolve(fullPath);

    if (!resolvedPath.startsWith(MEDIA_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (fs.existsSync(resolvedPath)) {
        fs.unlink(resolvedPath, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to delete file' });
            }
            res.json({ success: true });
        });
    } else {
        res.json({ success: true }); // File already gone, consider success
    }
});

// DELETE Folder (Recursive)
app.delete('/api/folder', (req, res) => {
    const relativePath = req.body.path;
    if (!relativePath) return res.status(400).json({ error: 'No path provided' });

    const fullPath = path.join(__dirname, relativePath);
    const resolvedPath = path.resolve(fullPath);

    // Security: Must be within MEDIA_DIR
    if (!resolvedPath.startsWith(MEDIA_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (fs.existsSync(resolvedPath)) {
        fs.rm(resolvedPath, { recursive: true, force: true }, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to delete folder' });
            }
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
});

// RENAME Folder
app.post('/api/rename-folder', (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: 'Missing paths' });

    const fullOldPath = path.join(__dirname, oldPath);
    const fullNewPath = path.join(__dirname, newPath);
    const resolvedOld = path.resolve(fullOldPath);
    const resolvedNew = path.resolve(fullNewPath);

    // Security check
    if (!resolvedOld.startsWith(MEDIA_DIR) || !resolvedNew.startsWith(MEDIA_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (fs.existsSync(resolvedOld)) {
        // Ensure parent of new path exists (though usually it's just a rename in same dir)
        const newParent = path.dirname(resolvedNew);
        if (!fs.existsSync(newParent)) fs.mkdirSync(newParent, { recursive: true });

        fs.rename(resolvedOld, resolvedNew, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to rename folder' });
            }
            res.json({ success: true });
        });
    } else {
        // Old folder doesn't exist, maybe it was never created. Just return success.
        res.json({ success: true, message: 'Old folder not found, nothing to rename' });
    }
});

// IMPORT Recipe from URL
app.post('/api/import-recipe', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        let recipeData = null;

        // 1. Try JSON-LD
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                // Handle graph or single object
                const data = json['@graph'] || (Array.isArray(json) ? json : [json]);

                const recipe = data.find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
                if (recipe) {
                    recipeData = recipe;
                    return false; // break loop
                }
            } catch (e) {
                console.error("Error parsing JSON-LD", e);
            }
        });

        // 2. Fallback (Microdata/RDFa) - simplified for now, focusing on JSON-LD as it's standard
        if (!recipeData) {
            return res.status(404).json({ error: 'No structured recipe data found (JSON-LD)' });
        }

        // Helper to decode HTML entities (handles double encoding)
        const decodeHtml = (str) => {
            if (!str) return '';
            let decoded = str;
            // Decode up to 3 times to handle nested entities like &amp;eacute;
            for (let i = 0; i < 3; i++) {
                const $ = cheerio.load(`<div>${decoded}</div>`, { xmlMode: false });
                const newDecoded = $('div').text();
                if (newDecoded === decoded) break;
                decoded = newDecoded;
            }
            return decoded;
        };

        // Parse and Normalize Data
        const extracted = {
            title: decodeHtml(recipeData.name || 'Untitled Recipe'),
            description: decodeHtml(recipeData.description || ''),
            ingredients: [],
            instructions: '',
            imageUrl: '',
            servings: recipeData.recipeYield ? parseInt(recipeData.recipeYield) : 4,
            prepTime: recipeData.prepTime || '',
            cookTime: recipeData.cookTime || '',
            sourceUrl: url
        };

        // Ingredients
        if (Array.isArray(recipeData.recipeIngredient)) {
            extracted.ingredients = recipeData.recipeIngredient.map(i => decodeHtml(i));
        } else if (typeof recipeData.recipeIngredient === 'string') {
            extracted.ingredients = [decodeHtml(recipeData.recipeIngredient)];
        }

        // Instructions
        if (Array.isArray(recipeData.recipeInstructions)) {
            extracted.instructions = recipeData.recipeInstructions.map(step => {
                let text = '';
                if (typeof step === 'string') text = step;
                else if (step.text) text = step.text;
                else if (step.name) text = step.name;
                return decodeHtml(text);
            }).join('\n\n');
        } else if (typeof recipeData.recipeInstructions === 'string') {
            extracted.instructions = decodeHtml(recipeData.recipeInstructions);
        }

        // Image
        let imgUrl = recipeData.image;
        if (Array.isArray(imgUrl)) imgUrl = imgUrl[0];
        if (typeof imgUrl === 'object' && imgUrl.url) imgUrl = imgUrl.url;

        if (imgUrl) {
            // Download Image
            try {
                const imgResp = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                const ext = path.extname(imgUrl).split('?')[0] || '.jpg';
                const filename = 'import-' + Date.now() + ext;
                const savePath = path.join(MEDIA_DIR, filename);

                fs.writeFileSync(savePath, imgResp.data);
                extracted.imageUrl = '/recipes/medias/' + filename;
            } catch (e) {
                console.error("Failed to download image", e);
            }
        }

        res.json(extracted);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch recipe' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    CYBER KITCHEN SERVER ONLINE
    -------------------------------------------
    > Access App: http://localhost:${PORT}
    > API:        http://localhost:${PORT}/api/recipes
    -------------------------------------------
    `);
});
