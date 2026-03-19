const express = require("express");
const router = express.Router();

const lastAlerts = {};
const ALERT_INTERVAL = 2 * 60 * 1000; // 2 minutos

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/alerts.json");

// ✅ FUNCIÓN QUE FALTABA
function saveAlert(alert) {
  try {

    let data = [];

    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE);
      data = JSON.parse(raw);
    }

    data.push(alert);

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Error guardando historial:", err);
  }
}

async function sendWhatsAppMessage(to, message) {

  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: {
      body: message
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  console.log("WhatsApp response:", data);

  return data;
}

router.post("/send", async (req, res) => {

  const {
    patientName = "Paciente",
    hrBpm,
    thresholdBpm,
    secondsAbove,
    phones = [],
    location
  } = req.body;

  if (!hrBpm || !thresholdBpm || !secondsAbove) {
    return res.status(400).json({
      ok: false,
      error: "missing_required_fields",
      required: ["hrBpm", "thresholdBpm", "secondsAbove"]
    });
  }

  if (!phones || phones.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "phones_required"
    });
  }

  const now = Date.now();
  const deviceKey = req.body.deviceId || "default";

  if (!lastAlerts[deviceKey]) {
    lastAlerts[deviceKey] = 0;
  }

  if (now - lastAlerts[deviceKey] < ALERT_INTERVAL) {

    console.log(`⚠️ alerta bloqueada (${deviceKey})`);

    return res.json({
      ok: true,
      message: "alert_blocked_by_antispam",
      deviceId: deviceKey
    });
  }

  lastAlerts[deviceKey] = now