const express = require('express');
const { query } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const router = express.Router();

/**
 * @swagger
 * /api/search/users:
 *   get:
 *     summary: Search users
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching users }
 */
router.get(
    '/users',
    [query('q').notEmpty().trim()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { q } = req.query;
            const users = await User.find({
                username: { $regex: q, $options: 'i' },
            })
                .select('username profilePicture')
                .limit(10);
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/search/hashtags:
 *   get:
 *     summary: Search posts by hashtag
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching posts }
 */
router.get(
    '/hashtags',
    [query('q').notEmpty().trim()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { q } = req.query;
            const posts = await Post.find({
                hashtags: { $regex: q, $options: 'i' },
            })
                .populate('userId', 'username profilePicture')
                .limit(10);
            res.json(posts);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

module.exports = router;