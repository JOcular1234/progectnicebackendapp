const express = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/auth');
const Story = require('../models/Story');
const StoryView = require('../models/StoryView');
const Notification = require('../models/Notification');
const Follow = require('../models/Follow');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit
const router = express.Router();

/**
 * @swagger
 * /api/stories:
 *   post:
 *     summary: Create a story
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
 *     responses:
 *       201: { description: Story created }
 */
router.post(
    '/',
    authenticate,
    upload.single('media'),
    [body('caption').optional().trim()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { userId } = req.user;
            const { caption } = req.body;

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: `stories/${userId}`,
                resource_type: 'auto',
                allowed_formats: ['jpg', 'png', 'mp4'],
                transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
            });

            const story = new Story({
                userId,
                mediaUrl: result.secure_url,
                mediaId: result.public_id,
                caption,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });
            await story.save();

            res.status(201).json(story);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/stories/{userId}:
 *   get:
 *     summary: Get user's active stories
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User's stories }
 */
router.get('/:userId', authenticate, async (req, res) => {
    try {
        const stories = await Story.find({
            userId: req.params.userId,
            isActive: true,
            expiresAt: { $gt: new Date() },
        }).populate('userId', 'username profilePicture');
        res.json(stories);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @swagger
 * /api/stories/feed:
 *   get:
 *     summary: Get stories feed
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Stories from followed users }
 */
router.get('/feed', authenticate, async (req, res) => {
    try {
        const { userId } = req.user;
        const follows = await Follow.find({ followerId: userId }).select('followedId');
        const followedIds = follows.map(f => f.followedId);

        const stories = await Story.find({
            userId: { $in: followedIds },
            isActive: true,
            expiresAt: { $gt: new Date() },
        }).populate('userId', 'username profilePicture');

        res.json(stories);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @swagger
 * /api/stories/{id}/view:
 *   post:
 *     summary: Record a story view
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: View recorded }
 */
router.post('/:id/view', authenticate, async (req, res) => {
    try {
        const { userId } = req.user;
        const story = await Story.findById(req.params.id);
        if (!story || !story.isActive || story.expiresAt < new Date()) {
            return res.status(404).json({ error: 'Story not found or expired' });
        }

        await StoryView.create({ storyId: req.params.id, userId });
        await Notification.create({
            userId: story.userId,
            type: 'story_view',
            fromUserId: userId,
            storyId: req.params.id,
        });

        res.json({ message: 'View recorded' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @swagger
 * /api/stories/{id}:
 *   delete:
 *     summary: Delete a story
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Story deleted }
 *       403: { description: Unauthorized }
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { userId } = req.user;
        const story = await Story.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        if (story.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await cloudinary.uploader.destroy(story.mediaId);
        await story.remove();
        res.json({ message: 'Story deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;