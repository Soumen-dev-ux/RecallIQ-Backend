const express = require('express');
const router  = express.Router();
const driver  = require('../db');

// ── POST /decks — Create a new deck ───────────────────
router.post('/', async (req, res) => {
  const { userId, name, description } = req.body;

  if (!userId || !name)
    return res.status(400).json({ error: 'userId and name required' });

  const session = driver.session();
  try {
    const result = await session.run(
      `MERGE (u:User {id: $userId})
       CREATE (d:Deck {
         id:          randomUUID(),
         name:        $name,
         description: $description,
         createdAt:   datetime(),
         cardCount:   0
       })
       CREATE (u)-[:OWNS_DECK]->(d)
       RETURN d`,
      { userId, name, description: description || '' }
    );

    const deck = result.records[0].get('d').properties;
    console.log('✅ Deck created:', deck.name);
    res.status(201).json({ message: 'Deck created!', deck });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── GET /decks/:userId — Get all decks with card count
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:OWNS_DECK]->(d:Deck)
       OPTIONAL MATCH (d)-[:HAS_CARD]->(c:Card)
       OPTIONAL MATCH (d)-[:HAS_CARD]->(due:Card)
         WHERE due.nextReviewDate <= date()
       RETURN d,
              count(DISTINCT c)   AS totalCards,
              count(DISTINCT due) AS dueCards
       ORDER BY d.createdAt DESC`,
      { userId }
    );

    const decks = result.records.map(r => ({
      ...r.get('d').properties,
      totalCards: r.get('totalCards').toNumber(),
      dueCards:   r.get('dueCards').toNumber(),
    }));

    res.json({ decks, count: decks.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── GET /decks/cards/:deckId — Get all cards in a deck
router.get('/cards/:deckId', async (req, res) => {
  const { deckId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (d:Deck {id: $deckId})-[:HAS_CARD]->(c:Card)
       RETURN c ORDER BY c.createdAt DESC`,
      { deckId }
    );

    const cards = result.records.map(r => r.get('c').properties);
    res.json({ cards, count: cards.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── GET /decks/due/:deckId — Get due cards in a deck
router.get('/due/:deckId', async (req, res) => {
  const { deckId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (d:Deck {id: $deckId})-[:HAS_CARD]->(c:Card)
       WHERE c.nextReviewDate <= date()
       RETURN c ORDER BY c.nextReviewDate ASC`,
      { deckId }
    );

    const cards = result.records.map(r => r.get('c').properties);
    res.json({ cards, count: cards.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── DELETE /decks/:deckId — Delete a deck ─────────────
router.delete('/:deckId', async (req, res) => {
  const { deckId } = req.params;
  const session = driver.session();

  try {
    await session.run(
      `MATCH (d:Deck {id: $deckId})
       OPTIONAL MATCH (d)-[:HAS_CARD]->(c:Card)
       DETACH DELETE d, c`,
      { deckId }
    );
    res.json({ message: 'Deck deleted!' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── GET /decks/topics/:userId — Get all topics grouped
router.get('/topics/:userId', async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
       RETURN c.topic AS topic,
              count(c) AS cardCount,
              sum(CASE WHEN c.nextReviewDate <= date() THEN 1 ELSE 0 END) AS dueCount
       ORDER BY cardCount DESC`,
      { userId }
    );

    const topics = result.records.map(r => ({
      topic:     r.get('topic'),
      cardCount: r.get('cardCount').toNumber(),
      dueCount:  r.get('dueCount').toNumber(),
    }));

    res.json({ topics, count: topics.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

module.exports = router;
