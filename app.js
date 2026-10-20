import express from 'express';
import path from 'node:path';

const __dirname = import.meta.dirname;
const app = express();

app.get('/manifest.json', (req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'dist', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist', 'sw.js'));
});

// dist/ es lo que genera `npm run build` (index.html, assets/, icons/, js/, offline.html)
app.use(express.static(path.join(__dirname, 'dist')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
