const neo4j = require('neo4j-driver');
require('dotenv').config();

let driver;
let useMockDb = false;

// Global in-memory database store
const inMemoryDb = {
  users: [],
  cards: [],
  relations: [],
};

// Mock Session Class mimicking Neo4j session
class MockSession {
  async run(query, params) {
    const q = query.trim().replace(/\s+/g, ' ');
    
    // 1. MATCH (u:User {email: $email}) RETURN u
    if (q.includes('MATCH (u:User {email: $email}) RETURN u')) {
      const email = (params.email || '').toLowerCase();
      const user = inMemoryDb.users.find(u => u.email === email);
      return {
        records: user ? [{
          get: (key) => ({ properties: user })
        }] : []
      };
    }
    
    // 2. CREATE (u:User { id: randomUUID(), email: $email, password: $hashedPassword, createdAt: datetime() }) RETURN u
    if (q.includes('CREATE (u:User')) {
      const user = {
        id: Math.random().toString(36).substring(2, 15),
        email: (params.email || '').toLowerCase(),
        password: params.hashedPassword,
        createdAt: new Date().toISOString()
      };
      inMemoryDb.users.push(user);
      return {
        records: [{
          get: (key) => ({ properties: user })
        }]
      };
    }
    
    // 3. CREATE Card or MERGE Card
    if (q.includes('CREATE (c:Card') || q.includes('MERGE (c:Card')) {
      const card = {
        id: params.cardId || Math.random().toString(36).substring(2, 15),
        userId: params.userId,
        front: params.front,
        back: params.back,
        topic: params.topic,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        nextReviewDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        source: params.source || 'user'
      };
      inMemoryDb.cards.push(card);
      return {
        records: [{
          get: (key) => ({ properties: card })
        }]
      };
    }

    // 4. c.nextReviewDate <= date() (Today's due cards)
    if (q.includes('c.nextReviewDate <= date()')) {
      const today = new Date().toISOString().split('T')[0];
      const userCards = inMemoryDb.cards.filter(c => c.userId === params.userId && c.nextReviewDate <= today);
      return {
        records: userCards.map(c => ({
          get: (key) => ({ properties: c })
        }))
      };
    }

    // 5. MATCH (c:Card {id: $cardId}) RETURN c.interval as interval, c.easeFactor as easeFactor...
    if (q.includes('MATCH (c:Card {id: $cardId}) RETURN c.interval')) {
      const card = inMemoryDb.cards.find(c => c.id === params.cardId);
      if (!card) {
        return { records: [] };
      }
      return {
        records: [{
          get: (key) => {
            if (key === 'interval') return { toNumber: () => card.interval };
            if (key === 'easeFactor') return card.easeFactor;
            if (key === 'repetitions') return { toNumber: () => card.repetitions };
            return null;
          }
        }]
      };
    }

    // 6. MATCH (c:Card {id: $cardId}) SET ... (Updating card review details)
    if (q.includes('MATCH (c:Card {id: $cardId}) SET')) {
      const card = inMemoryDb.cards.find(c => c.id === params.cardId);
      if (card) {
        card.interval = params.newInterval.toNumber ? params.newInterval.toNumber() : params.newInterval;
        card.easeFactor = params.newEase;
        card.repetitions = params.newReps.toNumber ? params.newReps.toNumber() : params.newReps;
        
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + card.interval);
        card.nextReviewDate = nextDate.toISOString().split('T')[0];
        card.lastReviewed = new Date().toISOString();
      }
      return { records: [] };
    }

    // 7. MATCH (u:User {id: $userId})-[:OWNS]->(c:Card) RETURN c / c.front...
    if (q.includes('MATCH (u:User {id: $userId})-[:OWNS]->(c:Card)')) {
      const userCards = inMemoryDb.cards.filter(c => c.userId === params.userId);
      // Sort descending by createdAt
      userCards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // If requesting front, back, topic for tutor or quiz
      if (q.includes('c.front AS front')) {
        const sliced = userCards.slice(0, 20);
        return {
          records: sliced.map(c => ({
            get: (key) => {
              if (key === 'front') return c.front;
              if (key === 'back') return c.back;
              if (key === 'topic') return c.topic;
              if (key === 'reps') return c.repetitions;
              return null;
            }
          }))
        };
      }

      if (q.includes('c.repetitions <= 2')) {
        const weakCards = userCards.filter(c => c.repetitions <= 2);
        weakCards.sort((a, b) => a.easeFactor - b.easeFactor);
        const sliced = weakCards.slice(0, 10);
        return {
          records: sliced.map(c => ({
            get: (key) => {
              if (key === 'front') return c.front;
              if (key === 'back') return c.back;
              if (key === 'topic') return c.topic;
              return null;
            }
          }))
        };
      }

      // Default GET all cards
      return {
        records: userCards.map(c => ({
          get: (key) => ({ properties: c })
        }))
      };
    }

    // 8. OPTIONAL MATCH (c)-[:RELATED_TO]->(related:Card) (Knowledge graph nodes & edges)
    if (q.includes('OPTIONAL MATCH (c)-[:RELATED_TO]->(related:Card)')) {
      const userCards = inMemoryDb.cards.filter(c => c.userId === params.userId);
      return {
        records: userCards.map(c => {
          const connections = inMemoryDb.relations
            .filter(r => r.cardId1 === c.id)
            .map(r => r.cardId2);
          return {
            get: (key) => {
              if (key === 'c') return { properties: c };
              if (key === 'connections') return connections;
              return null;
            }
          };
        })
      };
    }

    // 9. Link two cards as related
    if (q.includes('RELATED_TO')) {
      const relationExists = inMemoryDb.relations.some(
        r => r.cardId1 === params.cardId1 && r.cardId2 === params.cardId2
      );
      if (!relationExists) {
        inMemoryDb.relations.push({
          cardId1: params.cardId1,
          cardId2: params.cardId2
        });
      }
      return { records: [] };
    }

    return { records: [] };
  }

  async close() {}
}

class MockDriver {
  session() {
    return new MockSession();
  }
  async verifyConnectivity() {
    return true;
  }
  async close() {}
}

try {
  driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
  );
} catch (e) {
  console.warn('⚠️ Error initializing Neo4j driver:', e.message);
  driver = new MockDriver();
  useMockDb = true;
}

// Test the connection
async function testConnection() {
  try {
    if (useMockDb) return;
    await driver.verifyConnectivity();
    console.log('✅ Neo4j connected successfully!');
  } catch (error) {
    console.error('❌ Neo4j connection failed. Switching to resilient in-memory fallback database!');
    driver = new MockDriver();
    useMockDb = true;
  }
}

testConnection();

module.exports = driver;