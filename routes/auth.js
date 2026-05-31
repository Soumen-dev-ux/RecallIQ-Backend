// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const driver = require('../db');
require('dotenv').config();

// ── SIGNUP ─────────────────────────────────────────────
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: 'Email and password required' });

    if (password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const session = driver.session();
    try {
        // Check if email already exists
        const exists = await session.run(
            'MATCH (u:User {email: $email}) RETURN u',
            { email: email.toLowerCase() }
        );

        if (exists.records.length > 0)
            return res.status(400).json({ error: 'Email already registered' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user node in Neo4j
        const result = await session.run(
            `CREATE (u:User {
        id:        randomUUID(),
        email:     $email,
        password:  $hashedPassword,
        createdAt: datetime()
      }) RETURN u`,
            { email: email.toLowerCase(), hashedPassword }
        );

        const user = result.records[0].get('u').properties;
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log('✅ Signup:', user.email, '| userId:', user.id);

        res.status(201).json({
            message: 'Account created!',
            token,
            userId: user.id,
            email: user.email
        });

    } catch (err) {
        console.error('❌ Signup error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

// ── LOGIN ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: 'Email and password required' });

    const session = driver.session();
    try {
        // Find user by email
        const result = await session.run(
            'MATCH (u:User {email: $email}) RETURN u',
            { email: email.toLowerCase() }
        );

        if (result.records.length === 0)
            return res.status(400).json({ error: 'No account found with this email' });

        const user = result.records[0].get('u').properties;

        // Verify password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(400).json({ error: 'Wrong password' });

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log('✅ Login:', user.email, '| userId:', user.id);

        res.json({
            message: 'Logged in!',
            token,
            userId: user.id,
            email: user.email
        });

    } catch (err) {
        console.error('❌ Login error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

module.exports = router;
