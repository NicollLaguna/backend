module.exports = function (req, res, next) {

  const apiKey = req.headers["x-api-key"];

  if (!process.env.API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "server_api_key_not_configured"
    });
  }

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized"
    });
  }

  next();
};