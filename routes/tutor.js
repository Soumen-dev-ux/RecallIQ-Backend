// routes/tutor.js
const express = require('express');
const router = require('express').Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const driver = require('../db');
require('dotenv').config();

// Safe Initialization of Gemini
const apiKey = process.env.GEMINI_API_KEY;
let genAI;

if (apiKey && apiKey.trim().length > 0 && !apiKey.includes('your_api_key')) {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
    } catch (e) {
        console.warn('⚠️ Error initializing GoogleGenerativeAI:', e.message);
    }
}

// High-fidelity local simulation generator
// High-fidelity local simulation generator
function generateSimulatedResponse(message, cards) {
    const msg = message.toLowerCase();
    let topic = 'General Study';
    let explanation = '';
    let simulatedCards = [];
    let suggestions = [];

    if (msg.includes('recursion') || msg.includes('recursive')) {
        topic = 'Recursion';
        explanation = 'Recursion is a programming technique where a function calls itself to solve a problem. It breaks down a complex problem into smaller, similar sub-problems until it reaches a "base case" where it stops.';
        simulatedCards = [
            { front: 'What is recursion?', back: 'A programming technique where a function calls itself to solve a problem.', topic: 'Recursion' },
            { front: 'What are the two essential components of a recursive function?', back: 'The base case (stops the recursion) and the recursive case (calls the function again).', topic: 'Recursion' },
            { front: 'What happens if a recursive function lacks a base case?', back: 'It leads to infinite recursion and eventually a stack overflow error.', topic: 'Recursion' }
        ];
        suggestions = ['Stack Overflow', 'Iterative vs Recursive', 'Fibonacci Recursion'];
    } else if (msg.includes('database') || msg.includes('sql') || msg.includes('neo4j') || msg.includes('graph')) {
        topic = 'Databases';
        explanation = 'A database is an organized collection of structured information or data. While relational databases use tables, graph databases like Neo4j use nodes and relationships to represent highly connected data.';
        simulatedCards = [
            { front: 'What is a graph database?', back: 'A database that uses graph structures (nodes, edges, properties) to represent and store data.', topic: 'Databases' },
            { front: 'What is a primary key in SQL?', back: 'A unique identifier for a record in a relational database table.', topic: 'Databases' },
            { front: 'What query language does Neo4j use?', back: 'Cypher, designed for efficient graph pattern matching.', topic: 'Databases' }
        ];
        suggestions = ['Cypher Queries', 'Relational vs Graph', 'Indexing'];
    } else if (msg.includes('react') || msg.includes('component') || msg.includes('native')) {
        topic = 'React & React Native';
        explanation = 'React is a popular JavaScript library for building component-based user interfaces. React Native extends this capability, allowing developers to build cross-platform mobile apps using standard React components.';
        simulatedCards = [
            { front: 'What is React?', back: 'A JavaScript library for building component-based user interfaces.', topic: 'React Native' },
            { front: 'What is JSX?', back: 'A syntax extension for JavaScript that allows writing HTML-like code inside JS.', topic: 'React Native' },
            { front: 'What is the purpose of hooks in React?', back: 'Hooks allow function components to use state and other React features.', topic: 'React Native' }
        ];
        suggestions = ['State vs Props', 'React Hooks', 'Virtual DOM'];
    } else if (msg.includes('javascript') || msg.includes('js') || msg.includes('es6')) {
        topic = 'JavaScript';
        explanation = 'JavaScript is a high-level, dynamic, interpreted programming language that is a core technology of the World Wide Web. It enables interactive web pages and is supported by all modern browsers.';
        simulatedCards = [
            { front: 'What is JavaScript?', back: 'A dynamic, high-level language that powers web interactivity.', topic: 'JavaScript' },
            { front: 'What is the difference between let and var?', back: 'let has block scope, while var has function scope.', topic: 'JavaScript' },
            { front: 'What is a Promise in JS?', back: 'An object representing the eventual completion or failure of an asynchronous operation.', topic: 'JavaScript' }
        ];
        suggestions = ['Asynchronous JS', 'Closures', 'ES6 Features'];
    } else if (msg.includes('python') || msg.includes('django') || msg.includes('flask')) {
        topic = 'Python';
        explanation = 'Python is a high-level, general-purpose programming language known for its readability and clean syntax. It is widely used in web development, data science, AI, and scripting.';
        simulatedCards = [
            { front: 'What is Python?', back: 'A high-level, readable, general-purpose programming language.', topic: 'Python' },
            { front: 'What is a list comprehension in Python?', back: 'A concise way to create lists using a single line of code.', topic: 'Python' },
            { front: 'How is memory managed in Python?', back: 'Automatically via a private heap space and a garbage collector.', topic: 'Python' }
        ];
        suggestions = ['PEP 8 Style', 'Python OOP', 'Data Science with Python'];
    } else if (cards && cards.length > 0) {
        const sampleCard = cards[Math.floor(Math.random() * cards.length)];
        topic = sampleCard.topic;
        explanation = `Let's study your saved memory on **${sampleCard.topic}**! Here is a helpful review: The question is **"${sampleCard.front}"**, and the answer is **"${sampleCard.back}"**. This is a great concept to practice using active recall!`;
        simulatedCards = [
            { front: `Review: ${sampleCard.front}`, back: sampleCard.back, topic: sampleCard.topic }
        ];
        suggestions = [`Study ${sampleCard.topic}`, 'Create New Card', 'Take a Quiz'];
    } else {
        // Fallback dynamic topic generator for ANY other query!
        const cleanMsg = msg.replace(/[?,.!]/g, '');
        const words = cleanMsg.split(/\s+/).filter(w => w.length > 3 && w !== 'explain' && w !== 'what' && w !== 'about' && w !== 'how' && w !== 'the' && w !== 'query');
        const inferredTopic = words.length > 0 ? words[0].charAt(0).toUpperCase() + words[0].slice(1) : 'Study Topic';

        topic = inferredTopic;
        explanation = `Here is a custom breakdown on **${inferredTopic}**! This topic represents key concepts, methods, and practical models. Exploring this subject helps build structural understanding and analytical frameworks. Let's use active recall flashcards to commit this to memory!`;
        simulatedCards = [
            { front: `What is the core definition of ${inferredTopic}?`, back: `It refers to the fundamental concepts, components, and primary systems associated with ${inferredTopic}.`, topic: inferredTopic },
            { front: `What is a primary real-world application of ${inferredTopic}?`, back: `It is widely utilized to solve domain-specific problems, optimize structures, and build practical solutions.`, topic: inferredTopic },
            { front: `What are key elements to remember about ${inferredTopic}?`, back: `To master this topic, prioritize understanding its core principles, dependencies, and logical connections.`, topic: inferredTopic }
        ];
        suggestions = [`${inferredTopic} Basics`, `Advanced ${inferredTopic}`, `${inferredTopic} Practice`];
    }

    const fullMessage = explanation + '\n\n⚠️ *Note: Running in high-fidelity local simulation mode because GEMINI_API_KEY is not configured or is invalid. Add your key in the backend `.env` to enable full live AI.*';
    return {
        message: fullMessage,
        reply: fullMessage,
        content: fullMessage,
        cards: simulatedCards,
        suggestions: suggestions,
        hasCards: simulatedCards.length > 0,
        simulated: true,
        setupGuide: 'To unlock full Gemini 1.5 Flash tutoring, get a free API Key at https://aistudio.google.com/ and configure it in backend/.env as GEMINI_API_KEY=your_key_here.'
    };
}

// ── POST /tutor/chat ───────────────────────────────────
router.post('/chat', async (req, res) => {
    const { message, userId, conversationHistory } = req.body;

    if (!message || !userId)
        return res.status(400).json({ error: 'Message and userId required' });

    const session = driver.session();
    try {
        // Get user's existing cards for context (limited to 8 to optimize speed)
        const cardsResult = await session.run(
            `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
       RETURN c.front AS front, c.back AS back,
              c.topic AS topic, c.repetitions AS reps
       ORDER BY c.createdAt DESC LIMIT 8`,
            { userId }
        );

        const existingCards = cardsResult.records.map(r => ({
            front: r.get('front'),
            back: r.get('back'),
            topic: r.get('topic'),
            reps: r.get('reps')
        }));

        const knownTopics = [...new Set(existingCards.map(c => c.topic))];
        const cardContext = existingCards.length > 0
            ? `User already knows: ${knownTopics.join(', ')} (${existingCards.length} cards total).`
            : 'User has no cards yet — this is their first topic.';

        // Check if API key is configured
        const isApiKeyset = apiKey && apiKey.trim().length > 0 && !apiKey.includes('your_api_key');

        if (!isApiKeyset || !genAI) {
            console.log('⚠️ GEMINI_API_KEY is missing or empty. Running in high-fidelity simulation mode.');
            const simulatedData = generateSimulatedResponse(message, existingCards);
            return res.json(simulatedData);
        }

        // Build structured JSON schema
        const responseSchema = {
            type: "OBJECT",
            properties: {
                explanation: {
                    type: "STRING",
                    description: "Clear explanation of the topic in 3-5 sentences with a simple analogy and one real-world example."
                },
                cards: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            front: { type: "STRING", description: "A query, term or concept on the front of the flashcard." },
                            back: { type: "STRING", description: "The concise description or definition on the back (1-2 sentences max)." },
                            topic: { type: "STRING", description: "The specific topic or category name." }
                        },
                        required: ["front", "back", "topic"]
                    }
                },
                suggestions: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "3 highly related study topic suggestions for the user to explore next."
                }
            },
            required: ["explanation", "cards", "suggestions"]
        };

        // Build full prompt with system instructions
        const systemPrompt = `You are an expert AI tutor inside RecallIQ, a spaced repetition learning app.
${cardContext}

STRICT RULES — follow exactly:
1. Explain the topic clearly in 3-5 sentences with a simple analogy and a real-world example inside the 'explanation' field.
2. Generate 4-6 highly relevant flashcards inside the 'cards' field.
3. Generate 3 further topics of study inside the 'suggestions' field.
4. Keep card answers short — 1-2 sentences max.
5. Be friendly and encouraging.`;

        // Initialize dynamic model with system instructions and JSON structured output schema (tokens optimized for fast reply speed)
        const modelInstance = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            systemInstruction: systemPrompt,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.7,
                maxOutputTokens: 350,
            }
        });

        // 1. Map roles to what Gemini expects ('user' and 'model')
        let safeHistory = (conversationHistory || [])
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            role:  m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content || '' }]
          }));

        // 2. Clean up: Ensure it doesn't start with a model/assistant message
        while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
          safeHistory.shift();
        }

        // 3. Clean up: Force strict alternation (no double user or double model messages)
        const validHistory = [];
        let nextExpectedRole = 'user'; // Must start with user

        for (const msg of safeHistory) {
          if (msg.role === nextExpectedRole) {
            validHistory.push(msg);
            // Flip the expected role for the next iteration
            nextExpectedRole = nextExpectedRole === 'user' ? 'model' : 'user';
          }
        }

        // Start chat with history
        const chat = modelInstance.startChat({
            history: validHistory,
        });

        console.log('🤖 Sending structured request to Gemini:', message);
        // Send message
        const result = await chat.sendMessage(message);

        // TEMP DEBUG — remove after fixing
        console.log('📦 Full Gemini result:', JSON.stringify(result, null, 2).substring(0, 500));

        // ✅ Handle different SDK response formats
        let aiText = '';

        try {
            // Method 1 — standard
            aiText = result.response.text();
            if (typeof aiText !== 'string') throw new Error('Not a string');
        } catch (e1) {
            try {
                // Method 2 — candidates array
                aiText = result.response.candidates[0].content.parts[0].text;
            } catch (e2) {
                try {
                    // Method 3 — direct text
                    aiText = result.response.candidates[0].content.parts[0].text;
                } catch (e3) {
                    // Method 4 — stringify and check
                    const raw = JSON.stringify(result.response);
                    console.log('🔍 Raw Gemini response:', raw);
                    aiText = 'Sorry, could not parse AI response. Raw: ' + raw.substring(0, 200);
                }
            }
        }

        console.log('🤖 AI text type:', typeof aiText);
        console.log('🤖 AI text preview:', String(aiText).substring(0, 100));
        console.log('✅ Gemini responded with structured JSON');

        let data;
        try {
            data = JSON.parse(aiText);
        } catch (parseErr) {
            console.error('❌ Failed to parse Gemini structured JSON, using backup wrapper:', parseErr.message);
            data = {
                explanation: aiText,
                cards: [],
                suggestions: []
            };
        }

        const cleanText = data.explanation || '';
        const cards = data.cards || [];
        const suggestions = data.suggestions || [];

        res.json({
            message: cleanText,
            reply: cleanText,
            content: cleanText,
            cards: cards,
            suggestions: suggestions,
            hasCards: cards.length > 0,
            simulated: false
        });

    } catch (err) {
        console.error('❌ Tutor error:', err.message);

        // Handle common Gemini authentication/quota errors gracefully
        if (err.message.includes('API key') || err.message.includes('API_KEY') || err.message.includes('403') || err.message.includes('identity')) {
            console.log('⚠️ Invalid/unauthorized Gemini key. Falling back to high-fidelity simulation mode.');

            // Re-fetch existing cards for the fallback generator
            let existingCards = [];
            try {
                const sessionRetry = driver.session();
                const cardsResult = await sessionRetry.run(
                    `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
                     RETURN c.front AS front, c.back AS back, c.topic AS topic
                     LIMIT 20`,
                    { userId }
                );
                existingCards = cardsResult.records.map(r => ({
                    front: r.get('front'),
                    back: r.get('back'),
                    topic: r.get('topic')
                }));
                await sessionRetry.close();
            } catch (e) {
                // Ignore error in fallback retry
            }

            const simulatedData = generateSimulatedResponse(message, existingCards);
            simulatedData.message = `⚠️ **Gemini API Error:** *${err.message}*\n\n` + simulatedData.message;
            simulatedData.reply = simulatedData.message;
            simulatedData.content = simulatedData.message;
            return res.json(simulatedData);
        }

        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

// ── POST /tutor/save-cards ─────────────────────────────
router.post('/save-cards', async (req, res) => {
  const { cards, userId, deckId } = req.body;

  if (!cards || !userId)
    return res.status(400).json({ error: 'Cards and userId required' });

  const session = driver.session();
  try {
    let saved = 0;
    for (const card of cards) {
      if (deckId) {
        // Save to specific deck
        await session.run(
          `MERGE (u:User {id: $userId})
           MERGE (t:Topic {name: $topic})
           MATCH (d:Deck {id: $deckId})
           CREATE (c:Card {
             id:             randomUUID(),
             front:          $front,
             back:           $back,
             topic:          $topic,
             interval:       1,
             easeFactor:     2.5,
             repetitions:    0,
             nextReviewDate: date(),
             createdAt:      datetime(),
             source:         'ai'
           })
           CREATE (u)-[:OWNS]->(c)
           CREATE (c)-[:TAGGED]->(t)
           CREATE (d)-[:HAS_CARD]->(c)`,
          { userId, deckId, front: card.front,
            back: card.back, topic: card.topic }
        );
      } else {
        // Save without deck
        await session.run(
          `MERGE (u:User {id: $userId})
           MERGE (t:Topic {name: $topic})
           CREATE (c:Card {
             id:             randomUUID(),
             front:          $front,
             back:           $back,
             topic:          $topic,
             interval:       1,
             easeFactor:     2.5,
             repetitions:    0,
             nextReviewDate: date(),
             createdAt:      datetime(),
             source:         'ai'
           })
           CREATE (u)-[:OWNS]->(c)
           CREATE (c)-[:TAGGED]->(t)`,
          { userId, front: card.front,
            back: card.back, topic: card.topic }
        );
      }
      saved++;
    }
    res.json({ message: `${saved} cards saved!`, count: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── POST /tutor/quiz ───────────────────────────────────
router.post('/quiz', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    const session = driver.session();
    try {
        // Get user's weakest cards
        const result = await session.run(
            `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
       WHERE c.repetitions <= 2
       RETURN c.front AS front, c.back AS back, c.topic AS topic
       ORDER BY c.easeFactor ASC LIMIT 10`,
            { userId }
        );

        const weakCards = result.records.map(r => ({
            front: r.get('front'),
            back: r.get('back'),
            topic: r.get('topic')
        }));

        if (weakCards.length === 0) {
            return res.json({
                message: "You don't have enough cards yet! Add some cards first then I'll quiz you. 😊",
                cards: [], suggestions: [], hasCards: false
            });
        }

        const isApiKeyset = apiKey && apiKey.trim().length > 0 && !apiKey.includes('your_api_key');

        if (!isApiKeyset || !genAI) {
            console.log('⚠️ GEMINI_API_KEY is missing. Generating a high-fidelity simulated quiz.');

            const sampleCards = weakCards.slice(0, 3);
            let quizText = "📝 **RecallIQ Simulated MCQ Quiz**\n\n";
            sampleCards.forEach((c, idx) => {
                quizText += `**Question ${idx + 1}:** In topic *${c.topic}*, ${c.front}\n`;
                quizText += `A) ${c.back}\n`;
                quizText += `B) An unrelated concept\n`;
                quizText += `C) None of the above\n`;
                quizText += `D) All of the above\n\n`;
                quizText += `*Correct Answer:* A\n\n`;
            });
            quizText += "*(Configure GEMINI_API_KEY in .env to unlock real AI-generated multi-choice quizzes based on your spaced repetition history!)*";

            return res.json({
                message: quizText,
                cards: [],
                suggestions: [],
                hasCards: false,
                simulated: true
            });
        }

        const quizPrompt = `You are a friendly tutor. Generate a quiz based on these cards:
${JSON.stringify(weakCards, null, 2)}

Create exactly 3 multiple choice questions.
For each: write the question, 4 options (A B C D), and mark the correct answer.
Be encouraging and friendly!`;

        const modelInstance = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const quizResult = await modelInstance.generateContent(quizPrompt);
        const quizText = quizResult.response.text();

        res.json({
            message: quizText,
            cards: [],
            suggestions: [],
            hasCards: false,
            simulated: false
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

module.exports = router;
