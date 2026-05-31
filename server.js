const express = require('express');
const cors = require('cors');
require('dotenv').config();

const cardRoutes = require('./routes/cards');
const authRoutes = require('./routes/auth');
const tutorRoutes = require('./routes/tutor'); // ← must exist
const deckRoutes = require('./routes/decks');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/cards', cardRoutes);
app.use('/tutor', tutorRoutes); // ← must exist
app.use('/decks', deckRoutes);

app.get('/', (req, res) => {
  res.json({ status: '🚀 RecallIQ backend running!' });
});

app.get('/ping', (req, res) => {
  res.json({ status: 'alive' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
