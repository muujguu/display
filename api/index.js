// /api/index — health-check / root handler for KioskOS Vercel backend

module.exports = function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    ok: true,
    service: 'KioskOS API',
    version: '1.0.0',
    endpoints: {
      sync: '/api/sync',
      config: '/api/config',
    },
    ts: Date.now(),
  });
};
