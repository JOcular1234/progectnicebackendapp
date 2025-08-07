const express = require('express');
const { body, query } = require('express-validator');
const authenticate = require('../middleware/auth');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const Follow = require('../models/Follow');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit
const router = express.Router();

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a post
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media: { type: string, format: binary }
 *               caption: { type: string }
 *               hashtags: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Post created }
 */
router.post(
    '/',
    authenticate,
    upload.single('media'),
    [body('caption').optional().trim(), body('hashtags').optional().isArray()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { userId } = req.user;
            const { caption, hashtags } = req.body;

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: `posts/${userId}`,
                resource_type: 'auto', // Handles images and videos
                allowed_formats: ['jpg', 'png', 'mp4'],
                transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
            });

            const post = new Post({
                userId,
                mediaUrl: result.secure_url,
                mediaId: result.public_id,
                caption,
                hashtags,
            });
            await post.save();

            res.status(201).json(post);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a post
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Post details }
 *       404: { description: Post not found }
 */
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('userId', 'username profilePicture');
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @swagger
 * /api/posts/feed:
 *   get:
 *     summary: Get posts feed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Posts feed }
 */
router.get(
    '/feed',
    authenticate,
    [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { userId } = req.user;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const follows = await Follow.find({ followerId: userId }).select('followedId');
            const followedIds = follows.map(f => f.followedId);

            const posts = await Post.find({ userId: { $in: followedIds } })
                .populate('userId', 'username profilePicture')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            res.json(posts);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Post deleted }
 *       403: { description: Unauthorized }
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { userId } = req.user;
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await cloudinary.uploader.destroy(post.mediaId);
        await post.remove();
        res.json({ message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;