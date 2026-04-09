const express = require("express");
const router = express.Router();

const lastAlerts = {};
const ALERT_INTERVAL = 2 * 60 * 1000; // 2 minutos

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/alerts.json");

const auth = require("../middleware/auth");

// ================= HISTORIAL =================
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

// ================= WHATSAPP =================
async function sendWhatsAppMessage(to, message) {

  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: message }
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

  if (!response.ok) {
    console.error("❌ WhatsApp error:", data);
  } else {
    console.log("✅ WhatsApp enviado:", data);
  }

  return data;
}

// ================= SEND ALERT =================
router.post("/send", auth, async (req, res) => {
  const {
    patientName = "Paciente",
    deviceId,
    hrBpm,
    thresholdBpm,
    secondsAbove,
    phones = [],
    location
  } = req.body;
  // 🔥 permitir alertas HR y GEO
  if (
    hrBpm === undefined ||
    thresholdBpm === undefined ||
    secondsAbove === undefined
  ) {
    return res.status(400).json({
      ok: false,
      error: "missing_required_fields",
      required: ["hrBpm", "thresholdBpm", "secondsAbove"]
    });
  }
  if (!phones.length) {
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

//  if (now - lastAlerts[deviceKey] < ALERT_INTERVAL) {

//   console.log(`⚠️ alerta bloqueada (${deviceKey})`);

   // ✅ guardar aunque esté bloqueada
//   saveAlert({
//    timestamp: new Date().toISOString(),
//    patientName,
//    deviceId: deviceKey,
//    hrBpm,
//    thresholdBpm,
//    secondsAbove,
//    phones,
//    location,
//    status: "blocked"
//   });

//   return res.json({
//    ok: true,
//    message: "alert_blocked_by_antispam",
//    deviceId: deviceKey
//   });
//  }

  lastAlerts[deviceKey] = now;


let message;

// 🆕 PRIORIDAD: mensaje personalizado desde Flutter
if (req.body.message) {

  message = req.body.message;

  // agregar ubicación si existe
  if (location) {
    message += "\n\nUbicación:\n" + location;
  }

}
// 🔥 ALERTA GEO
else if (deviceId && deviceId.startsWith("GEO")) {

  const parts = deviceId.split("-");
  const distanceKm = parts.length > 2 ? parts[2] : "?";

  message =
    "🚨 ALERTA DE UBICACIÓN\n\n" +
    `Alerta!!, Sr. Carlos, se encuentra ud. a ${distanceKm} km de su lugar de origen, ¿Se encuentra ud. desorientado?\n\n` +
    "Ubicación:\n" +
    `${location}`;

}
// ❤️ ALERTA HR
else {

  message =
    "🚨 ALERTA MIJ@\n\n" +
    `Paciente: ${patientName}\n\n` +
    `Pulso actual: ${hrBpm} bpm\n` +
    `Umbral configurado: ${thresholdBpm} bpm\n` +
    `Tiempo sobre umbral: ${secondsAbove} segundos.\n\n`;

  if (location) {
    message +=
      "Ubicación del paciente:\n" +
      `${location}\n\n`;
  }

  message += "Se recomienda verificar el estado del paciente.";
}

  console.log("📢 Enviando alerta:", message);

  for (const phone of phones) {
    try {
      await sendWhatsAppMessage(phone, message);
      console.log("mensaje enviado a:", phone);
    } catch (err) {
      console.error("error enviando a", phone, err);
    }
  }

  // ✅ guardar historial

  saveAlert({
    timestamp: new Date().toISOString(),
    patientName,
    deviceId: deviceKey,
    hrBpm,
    thresholdBpm,
    secondsAbove,
    phones,
    location,
    status: "sent"
  });

  return res.json({
    ok: true,
    message: "alert_sent"
  });

});

// ================= HISTORY =================
router.get("/history", (req, res) => {
  try {

    if (!fs.existsSync(DATA_FILE)) {
      return res.json([]);
    }

    const raw = fs.readFileSync(DATA_FILE);
    const data = JSON.parse(raw);

    const last = data.slice(-50).reverse();

    res.json(last);

  } catch (err) {
    res.status(500).json({ error: "error_reading_history" });
  }
});

module.exports = router;