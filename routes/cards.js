const express = require("express");
const router = express.Router();
const driver = require("../db");

// ── POST /cards — Save card (with optional deckId) ────
router.post('/', async (req, res) => {
  const { userId, front, back, topic, deckId } = req.body;

  if (!userId || !front || !back || !topic)
    return res.status(400).json({ error: 'All fields required' });

  const session = driver.session();
  try {
    let query;
    let params = { userId, front, back, topic };

    if (deckId) {
      // Save card AND link to deck
      query = `
        MERGE (u:User {id: $userId})
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
          createdAt:      datetime()
        })
        CREATE (u)-[:OWNS]->(c)
        CREATE (c)-[:TAGGED]->(t)
        CREATE (d)-[:HAS_CARD]->(c)
        RETURN c`;
      params.deckId = deckId;
    } else {
      // Save card without deck (goes to default)
      query = `
        MERGE (u:User {id: $userId})
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
          createdAt:      datetime()
        })
        CREATE (u)-[:OWNS]->(c)
        CREATE (c)-[:TAGGED]->(t)
        RETURN c`;
    }

    const result = await session.run(query, params);
    const card   = result.records[0].get('c').properties;
    res.status(201).json({ message: 'Card saved!', card });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── GET /cards/due/:userId — Get today's due cards ─────
router.get("/due/:userId", async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
       WHERE c.nextReviewDate <= date()
       RETURN c
       ORDER BY c.nextReviewDate ASC`,
      { userId },
    );

    const cards = result.records.map((r) => r.get("c").properties);
    res.json({ cards, count: cards.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// ── PATCH /cards/review — Update card after review ─────
router.patch("/review", async (req, res) => {
  const { cardId, rating } = req.body;
  // rating: 0=Again, 1=Hard, 2=Good, 3=Easy

  // SM-2 Algorithm
  function calculateNext(rating, interval, easeFactor, repetitions) {
    let newInterval, newEase, newReps;

    if (rating < 2) {
      // Failed — reset
      newInterval = 1;
      newReps = 0;
      newEase = Math.max(1.3, easeFactor - 0.2);
    } else {
      // Passed
      newReps = repetitions + 1;
      newEase =
        easeFactor + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
      newEase = Math.max(1.3, newEase);

      if (newReps === 1) newInterval = 1;
      else if (newReps === 2) newInterval = 6;
      else newInterval = Math.round(interval * newEase);
    }

    return { newInterval, newEase, newReps };
  }

  const session = driver.session();
  try {
    // Get current card data
    const cardResult = await session.run(
      `MATCH (c:Card {id: $cardId})
       RETURN c.interval as interval, 
              c.easeFactor as easeFactor, 
              c.repetitions as repetitions`,
      { cardId },
    );

    if (cardResult.records.length === 0) {
      return res.status(404).json({ error: "Card not found" });
    }

    const rec = cardResult.records[0];
    const interval = rec.get("interval").toNumber();
    const easeFactor = rec.get("easeFactor");
    const repetitions = rec.get("repetitions").toNumber();

    const { newInterval, newEase, newReps } = calculateNext(
      rating,
      interval,
      easeFactor,
      repetitions,
    );

    // Update card in Neo4j
    await session.run(
      `MATCH (c:Card {id: $cardId})
       SET c.interval       = $newInterval,
           c.easeFactor     = $newEase,
           c.repetitions    = $newReps,
           c.nextReviewDate = date() + duration({days: $newInterval}),
           c.lastReviewed   = datetime()`,
      {
        cardId,
        newInterval: neo4j.int(newInterval),
        newEase,
        newReps: neo4j.int(newReps),
      },
    );

    res.json({
      message: "Card updated!",
      nextReviewIn: `${newInterval} day(s)`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// ── GET /cards/all/:userId — Get all cards ─────────────
router.get("/all/:userId", async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
       RETURN c ORDER BY c.createdAt DESC`,
      { userId },
    );

    const cards = result.records.map((r) => r.get("c").properties);
    res.json({ cards, count: cards.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

const neo4j = require("neo4j-driver");
module.exports = router;
