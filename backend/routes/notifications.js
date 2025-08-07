const express = require('express');
const authenticate = require('../middleware/auth');
const Notification = require('../models/Notification');
const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: User notifications }
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { userId } = req.user;
        const notifications = await Notification.find({ userId })
            .populate('fromUserId', 'username profilePicture')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;