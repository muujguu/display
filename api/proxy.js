// /api/proxy — streams a Google Drive file through Vercel to avoid browser CORS
// Usage: GET /api/proxy?id=DRIVE_FILE_ID

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[\w-]{10,}$/.test(id)) {
    return res.status(400).json({ error: 'Missing or invalid file id' });
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });
  }

  const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${GOOGLE_API_KEY}`;

  try {
    const upstream = await fetch(driveUrl);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Drive returned ${upstream.status}` });
    }

    // Forward content-type so the browser knows how to handle it
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const cl = upstream.headers.get('content-length');
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h on CDN
    if (cl) res.setHeader('Content-Length', cl);

    // Stream the body directly to the response
    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};
