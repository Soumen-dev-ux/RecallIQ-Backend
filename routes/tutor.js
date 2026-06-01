// routes/tutor.js
const express = require('express');
const router = express.Router();

// ── MODERN SDK INITIALIZATION ───────────────────────
const { GoogleGenAI } = require('@google/genai');

// Automatically loads your GEMINI_API_KEY from Railway environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// ───────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  const { message, userId, conversationHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 1. Map incoming history to standard Gemini chat parameters
  let safeHistory = (conversationHistory || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role:  m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || '' }]
    }));

  // 2. Clear out any leading model messages
  while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
    safeHistory.shift();
  }

  // 3. Enforce strict alternation (user -> model -> user)
  const validHistory = [];
  let nextExpectedRole = 'user';

  for (const msg of safeHistory) {
    if (msg.role === nextExpectedRole) {
      validHistory.push(msg);
      nextExpectedRole = nextExpectedRole === 'user' ? 'model' : 'user';
    }
  }

  try {
    // 4. Create the Chat Session using the modern client helper structure
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: validHistory,
      config: {
        maxOutputTokens: 2048,
        temperature:     0.3,
      }
    });

    // 5. Fire off the user's latest incoming message
    const result = await chat.sendMessage({ message: message });
    let responseText = result.text ? result.text.trim() : '';

    console.log("Raw Gemini Response:", responseText);

    // 6. Clean markdown wrappers safely if the model returns any
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    // 7. Parse response schema safely
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
      // Graceful fallback string delivery so frontends never map undefined attributes
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
