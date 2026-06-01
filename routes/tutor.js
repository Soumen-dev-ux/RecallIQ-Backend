// routes/tutor.js

router.post('/chat', async (req, res) => {
  const { message, userId, conversationHistory } = req.body;

  // ... (Keep your safeHistory filtering logic from before here) ...

  try {
    const chat = model.startChat({
      history: validHistory,
      generationConfig: {
        maxOutputTokens: 2048, // Increased token limit so it doesn't cut off JSON
        temperature:     0.3,  // Lower temperature makes JSON formatting much more reliable
      }
    });

    const result = await chat.sendMessage(message);
    let responseText = result.response.text().trim();
    
    console.log("Raw Gemini Output:", responseText); // Check your server logs for this!

    // Clean up markdown fences if Gemini injected them
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^
```json\s*/i, "").replace(/```$/, "").trim();
    }

    // Try to parse it as an object to see if it's already a JSON structure
    try {
      const parsedJson = JSON.parse(responseText);
      
      // If it parsed successfully, send the structured object directly
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
      // Fallback: If it's just raw text response and not JSON string
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
    console.error("Gemini Error:", err);
    res.status(500).json({ error: err.message });
  }
});
