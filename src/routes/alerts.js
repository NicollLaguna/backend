const express = require("express");
const router = express.Router();

const lastAlerts = {};
const ALERT_INTERVAL = 2 * 60 * 1000; // 2 minutos

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/alerts.json");



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

  saveAlert({
    timestamp: new Date().toISOString(),
    patientName,
    deviceId: req.body.deviceId,
    hrBpm,
    thresholdBpm,
    secondsAbove,
    phones,
    location
  });

    return res.json({
      ok: true,
      message: "alert_blocked_by_antispam",
      deviceId: deviceKey
  });

  }

  router.get("/history", (req, res) => {
    try {

      if (!fs.existsSync(DATA_FILE)) {
        return res.json([]);
      }

      const raw = fs.readFileSync(DATA_FILE);
      const data = JSON.parse(raw);

      // devolver últimos 50
      const last = data.slice(-50).reverse();

      res.json(last);

    } catch (err) {
      res.status(500).json({ error: "error_reading_history" });
    }
  });

  lastAlerts[deviceKey] = now;

  let message =
`🚨 ALERTA MIJ@

Paciente: ${patientName}

Pulso actual: ${hrBpm} bpm
Umbral configurado: ${thresholdBpm} bpm
Tiempo sobre umbral: ${secondsAbove} segundos.`;

  if (location) {
    message += `

Ubicación del paciente:
${location}`;
  }

  message += `

Se recomienda verificar el estado del paciente.`;

  console.log("📢 Enviando alerta:", message);

  for (const phone of phones) {

    try {

      await sendWhatsAppMessage(phone, message);

      console.log("mensaje enviado a:", phone);

    } catch (err) {

      console.error("error enviando a", phone, err);

    }

  }

  return res.json({
    ok: true,
    message: "alert_sent",
    phones
  });

});

module.exports = router;