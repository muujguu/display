// /api/config — GET returns config, POST updates it (password protected)
// Uses Vercel KV for persistence. Falls back to in-memory defaults if KV unavailable.

const DEFAULT_CONFIG = {
  imageScreenTime: 10,
  loopFrequency: 1,
  updateSchedule: 'hourly',
  customInterval: 30,
  brandName: 'KioskOS',
  accentColor: '#3B82F6',
  adminPassword: 'kiosk1234',
  ticker: [
    'Welcome — update info.txt in Google Drive to change these messages',
  ],
};

async function getKV(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ? JSON.parse(result) : null;
}

async function setKV(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  const r = await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
  return r.ok;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const CONFIG_KEY = 'kiosk:config';

  if (req.method === 'GET') {
    const stored = await getKV(CONFIG_KEY).catch(() => null);
    const config = { ...DEFAULT_CONFIG, ...(stored || {}) };
    const { adminPassword, ...safe } = config;
    return res.status(200).json({ ok: true, config: safe });
  }

  if (req.method === 'POST') {
    let body = req.body;
    // Parse body if it arrived as a string (some Vercel configs)
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }

    const { password, ...updates } = body || {};
    const stored = await getKV(CONFIG_KEY).catch(() => null);
    const current = { ...DEFAULT_CONFIG, ...(stored || {}) };

    if (password !== current.adminPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const newConfig = { ...current, ...updates };
    await setKV(CONFIG_KEY, newConfig).catch(() => {});

    const { adminPassword, ...safe } = newConfig;
    return res.status(200).json({ ok: true, config: safe });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
