process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception detected:', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

const express    = require('express');
const cors       = require('cors');
require('dotenv').config();


const cardRoutes = require('./routes/cards');
const authRoutes = require('./routes/auth');
const tutorRoutes = require('./routes/tutor');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/cards', cardRoutes);
app.use('/auth', authRoutes);
app.use('/tutor', tutorRoutes);

app.get('/', (req, res) => {
  res.json({ status: '🚀 RecallIQ backend running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});