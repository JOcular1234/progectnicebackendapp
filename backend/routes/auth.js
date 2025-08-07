const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit for profile pictures
const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201: { description: User registered }
 *       400: { description: Validation error }
 */
router.post(
    '/register',
    [
        body('username').notEmpty().trim(),
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password } = req.body;

        try {
            let user = await User.findOne({ $or: [{ email }, { username }] });
            if (user) {
                return res.status(400).json({ error: 'User already exists' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = new User({ username, email, password: hashedPassword });
            await user.save();

            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
                expiresIn: '1d',
            });

            res.status(201).json({ token });
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: User logged in }
 *       400: { description: Invalid credentials }
 */
router.post(
    '/login',
    [body('email').isEmail(), body('password').notEmpty()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
                expiresIn: '1d',
            });

            res.json({ token });
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/auth/profile/{username}:
 *   get:
 *     summary: Get user profile
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User profile }
 *       404: { description: User not found }
 */
router.get('/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select(
            '-password'
        );
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               bio: { type: string }
 *               profilePicture: { type: string, format: binary }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/profile', authenticate, upload.single('profilePicture'), async (req, res) => {
    try {
        const { userId } = req.user;
        const { bio } = req.body;
        const updateData = { bio };

        if (req.file) {
            const user = await User.findById(userId);
            if (user.profilePictureId) {
                await cloudinary.uploader.destroy(user.profilePictureId);
            }
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: `profiles/${userId}`,
                resource_type: 'image',
                allowed_formats: ['jpg', 'png'],
                transformation: [{ width: 500, height: 500, crop: 'limit' }],
            });
            updateData.profilePicture = result.secure_url;
            updateData.profilePictureId = result.public_id;
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select(
            '-password'
        );
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;