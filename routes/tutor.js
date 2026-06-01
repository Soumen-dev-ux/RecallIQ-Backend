// routes/tutor.js
const express = require('express');
const router = express.Router();
// ── ADD THIS: Initialize Gemini Model ──────────────────
const { GoogleGenAI } = require('@google/genai');

// Ensure your API key is in your Railway environment variables as GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = ai.models.get({ model: 'gemini-3-pro-preview' });
// ───────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
    const { message, userId, conversationHistory } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Map incoming roles safely to Gemini standards
    let safeHistory = (conversationHistory || [])
        .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
        .map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content || '' }]
        }));

    // 2. Prevent starting with a model/assistant response
    while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
        safeHistory.shift();
    }

    // 3. Enforce strict alternation: user -> model -> user -> model
    const validHistory = [];
    let nextExpectedRole = 'user';

    for (const msg of safeHistory) {
        if (msg.role === nextExpectedRole) {
            validHistory.push(msg);
            nextExpectedRole = nextExpectedRole === 'user' ? 'model' : 'user';
        }
    }

    try {
        // 4. Initialize the Gemini session safely
        const chat = model.startChat({
            history: validHistory,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.3,
            }
        });

        const result = await chat.sendMessage(message);
        let responseText = result.response.text() ? result.response.text().trim() : '';

        console.log("Raw Gemini Response:", responseText);

        // 5. Peel off code block fences safely if present
        if (responseText.startsWith("```")) {
            responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        // 6. Try parsing the JSON payload. Fallback gracefully to raw strings if it fails.
        try {
            const parsedJson = JSON.parse(responseText);
            return res.json({
                message: parsedJson.message || parsedJson.reply || responseText,
                reply: parsedJson.reply || parsedJson.message || responseText,
                content: parsedJson.content || "",
                cards: parsedJson.cards || [],
                suggestions: parsedJson.suggestions || [],
                hasCards: Array.isArray(parsedJson.cards) ? parsedJson.cards.length > 0 : false,
                simulated: false
            });
        } catch (jsonErr) {
            // Fallback object to keep frontend from breaking
            return res.json({
                message: responseText,
                reply: responseText,
                content: responseText,
                cards: [],
                suggestions: [],
                hasCards: false,
                simulated: false
            });
        }

    } catch (err) {
        console.error("❌ Gemini Runtime Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
