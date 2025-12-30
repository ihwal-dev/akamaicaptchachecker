const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' })); // cookie bisa panjang banget

const API_URL = "https://accountmtapi.mobilelegends.com/";

// Data default (user tidak perlu input ini lagi)
const DEFAULT_ACCOUNT = "admin@paradox88.my.id";
const DEFAULT_PASSWORD = "Akun123456";
const DEFAULT_E_CAPTCHA = "Dummy"; // atau token dummy, nanti diganti kalau perlu

const baseHeaders = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
  "Content-Type": "application/json",
  "Origin": "https://mtacc.mobilelegends.com",
  "Referer": "https://mtacc.mobilelegends.com/",
  "Accept": "application/json, text/plain, */*",
};

app.post('/login', async (req, res) => {
  // Ambil cookie dari body atau header
  let userCookie = req.body.cookie || req.headers['cookie'];

  if (!userCookie || userCookie.trim() === "") {
    return res.status(400).json({
      success: false,
      error: "Cookie wajib dikirim! Kirim via body { \"cookie\": \"...\" } atau header 'Cookie'"
    });
  }

  // Bersihkan cookie dari spasi/linebreak kalau ada
  userCookie = userCookie.replace(/\s+/g, '');

  try {
    // Hitung MD5 password (tetap pakai default)
    const md5pwd = crypto.createHash("md5").update(DEFAULT_PASSWORD).digest("hex")

    // Buat sign
    const rawSign = `account=${DEFAULT_ACCOUNT}&e_captcha=${DEFAULT_E_CAPTCHA}&md5pwd=${md5pwd}&op=login`;
    const sign = crypto.createHash("md5").update(rawSign).digest("hex");

    const payload = {
      op: "login",
      sign: sign,
      params: {
        account: DEFAULT_ACCOUNT,
        md5pwd: md5pwd,
        e_captcha: DEFAULT_E_CAPTCHA
      }
    };

    // Header final dengan cookie dari user
    const requestHeaders = {
      ...baseHeaders,
      Cookie: userCookie
    };

    const response = await axios.post(API_URL, payload, {
      headers: requestHeaders,
      timeout: 60000,
      transformResponse: [data => data] // ambil raw text, jangan auto-parse JSON
    });

    const responseText = response.data;

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // Kalau bukan JSON → kemungkinan besar kena captcha/block
      result = {
        error: "Non-JSON response dari server (kemungkinan captcha, block Akamai, atau cookie invalid)",
        status: response.status,
        contentType: response.headers['content-type'],
        rawPreview: responseText.substring(0, 600) + "..."
      };
    }

    res.json({
      success: true,
      usedAccount: DEFAULT_ACCOUNT,
      data: result
    });

  } catch (error) {
    if (error.response) {
      const raw = error.response.data || "";
      res.status(error.response.status || 500).json({
        success: false,
        error: "Gagal login ke Mobile Legends API",
        status: error.response.status,
        rawPreview: typeof raw === 'string' ? raw.substring(0, 600) + "..." : raw
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Network error / timeout",
        message: error.message
      });
    }
  }
});

// Optional: endpoint kesehatan
app.get('/', (req, res) => {
  res.json({ message: "ML Login Proxy siap. POST /login dengan cookie saja!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Gunakan: POST /login + kirim cookie saja`);
});