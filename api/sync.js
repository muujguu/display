// /api/sync — fetches media list + info.txt from Google Drive folder

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!GOOGLE_API_KEY || !FOLDER_ID) {
    return res.status(500).json({
      error: 'Missing env vars: GOOGLE_API_KEY and/or GOOGLE_DRIVE_FOLDER_ID'
    });
  }

  try {
    // List all files in the Drive folder
    const listUrl =
      `https://www.googleapis.com/drive/v3/files` +
      `?q=%27${FOLDER_ID}%27+in+parents+and+trashed%3Dfalse` +
      `&fields=files(id%2Cname%2CmimeType%2CmodifiedTime%2Csize)` +
      `&orderBy=name` +
      `&key=${GOOGLE_API_KEY}`;

    const listResp = await fetch(listUrl);
    if (!listResp.ok) {
      const text = await listResp.text();
      return res.status(500).json({ error: `Drive API ${listResp.status}: ${text}` });
    }
    const { files } = await listResp.json();

    // Separate media files from info.txt
    const media = (files || [])
      .filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'))
      .map(f => ({
        id: f.id,
        name: f.name,
        type: f.mimeType.startsWith('video/') ? 'video' : 'image',
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        size: f.size,
        url: `https://drive.google.com/uc?export=view&id=${f.id}`,
        streamUrl: `https://drive.google.com/uc?export=view&id=${f.id}`,
        embedUrl: `https://drive.google.com/file/d/${f.id}/preview`,
        thumb: `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,
      }));

    // Fetch info.txt for ticker lines
    let ticker = null;
    const infoFile = (files || []).find(f => f.name.toLowerCase() === 'info.txt');
    if (infoFile) {
      try {
        const txtResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${infoFile.id}?alt=media&key=${GOOGLE_API_KEY}`
        );
        if (txtResp.ok) {
          const text = await txtResp.text();
          ticker = text.split('\n').map(l => l.trim()).filter(Boolean);
        }
      } catch (_) { /* non-fatal */ }
    }

    return res.status(200).json({ ok: true, media, count: media.length, ticker, ts: Date.now() });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
