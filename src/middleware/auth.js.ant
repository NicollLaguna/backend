function requireApiKey(req, res, next) {
  const providedKey = req.header('x-api-key');
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: 'server_api_key_not_configured' });
  }

  if (providedKey !== expectedKey) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  next();
}

module.exports = { requireApiKey };
