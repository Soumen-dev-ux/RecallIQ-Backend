// routes/tutor.js
const express = require('express');
const router = express.Router();

let aiClient = null;
let isModernSDK = false;

// ── AUTOMATIC SDK DETECTION LAYER ─────────────────────────
try {
  // Try loading the modern SDK first
  const { GoogleGenAI } = require('@google/genai');
  aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  isModernSDK = true;
  console.log("✅ Tutor Route: Successfully initialized modern @google/genai SDK");
} catch (modernError) {
  try {
    // Fall back to the traditional SDK if modern isn't installed
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    aiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    isModernSDK = false;
    console.log("✅ Tutor Route: Successfully initialized legacy @google/generative-ai SDK");
  } catch (legacyError) {
    console.error("❌ CRITICAL ERROR: Neither '@google/genai' nor '@google/generative-ai' is installed in package.json.");
  }
}
// ──────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  const { message, userId, conversationHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!aiClient) {
    return res.status(500).json({ error: 'Gemini SDK is not configured properly on the server.' });
  }

  // 1. Clean history and structure it for Gemini format
  let safeHistory = (conversationHistory || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role:  m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || '' }]
    }));

  // 2. Remove leading model responses
  while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
    safeHistory.shift();
  }

  // 3. Enforce strict alternating order
  const validHistory = [];
  let nextExpectedRole = 'user';

  for (const msg of safeHistory) {
    if (msg.role === nextExpectedRole) {
      validHistory.push(msg);
      nextExpectedRole = nextExpectedRole === 'user' ? 'model' : 'user';
    }
  }

  try {
    let responseText = '';

    // 4. Route conversation based on the active SDK version
    if (isModernSDK) {
      // Modern SDK execution pathway
      const chat = aiClient.chats.create({
        model: 'gemini-2.5-flash',
        history: validHistory,
        config: {
          maxOutputTokens: 2048,
          temperature:     0.3,
        }
      });
      const result = await chat.sendMessage({ message: message });
      responseText = result.text ? result.text.trim() : '';
    } else {
      // Legacy SDK execution pathway
      const model = aiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const chat = model.startChat({
        history: validHistory,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature:     0.3,
        }
      });
      const result = await chat.sendMessage(message);
      responseText = result.response.text() ? result.response.text().trim() : '';
    }

    console.log("Raw Gemini Response:", responseText);

    // 5. Clean off code block backticks if present
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    // 6. Output structured object response safely
    try {
      const parsedJson = JSON.parse(responseText);
      return res.json({
        message:     parsedJson.message || parsedJson.reply || responseText,
        reply:       parsedJson.reply || parsedJson.message || responseText,
        content:     parsedJson.content || "",
        cards:       parsedJson.cards || [],
        suggestions: parsedJson.suggestions || [],
        hasCards:    Array.isArray(parsedJson.cards) ? parsedJson.cards.length > 0 : false,
        simulated:   false
      });
    } catch (jsonErr) {
      return res.json({
        message:     responseText,
        reply:       responseText,
        content:     responseText,
        cards:       [],
        suggestions: [],
        hasCards:    false,
        simulated:   false
      });
    }

  } catch (err) {
    console.error("❌ Gemini Runtime Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
