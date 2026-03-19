require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors'); // 👈 NUEVO
const alertsRouter = require('./routes/alerts');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Seguridad básica
app.use(helmet());

// ✅ CORS (permite dashboard y futuras apps)
app.use(cors({
  origin: '*', // puedes restringir luego a tu dominio
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

// 📦 JSON
app.use(express.json({ limit: '1mb' }));

// 📊 Logs
app.use(morgan('combined'));

// ❤️ Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'mija-alert-backend',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 🚨 Rutas de alertas
app.use('/api/alerts', alertsRouter);

// ❌ 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'route_not_found' });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`MIJ@ backend escuchando en puerto ${PORT}`);
});