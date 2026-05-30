const express = require('express');
const router = express.Router();
const driver = require('../db');

// ── GET /graph/:userId — Get knowledge graph data ──────
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)
       OPTIONAL MATCH (c)-[:RELATED_TO]->(related:Card)
       RETURN c, collect(related.id) as connections`,
      { userId }
    );

    const nodes = [];
    const edges = [];

    result.records.forEach(record => {
      const card = record.get('c').properties;
      const connections = record.get('connections');

      nodes.push({
        id: card.id,
        label: card.front,
        topic: card.topic,
        mastery: card.repetitions
      });

      connections.forEach(relatedId => {
        if (relatedId) {
          edges.push({ from: card.id, to: relatedId });
        }
      });
    });

    res.json({ nodes, edges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// ── POST /graph/relate — Link two cards as related ─────
router.post('/relate', async (req, res) => {
  const { cardId1, cardId2 } = req.body;
  const session = driver.session();

  try {
    await session.run(
      `MATCH (c1:Card {id: $cardId1})
       MATCH (c2:Card {id: $cardId2})
       MERGE (c1)-[:RELATED_TO]->(c2)`,
      { cardId1, cardId2 }
    );

    res.json({ message: 'Cards linked successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

module.exports = router;