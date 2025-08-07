const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const cron = require('node-cron');
const connectDB = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const storyRoutes = require('./routes/stories');
const interactionRoutes = require('./routes/interactions');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const Story = require('./models/Story');

dotenv.config();
const app = express();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000' })); // Adjust for React app
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

// Story expiration job
cron.schedule('0 0 * * *', async () => {
    try {
        await Story.updateMany(
            { expiresAt: { $lte: new Date() } },
            { isActive: false }
        );
        console.log('Expired stories updated');
    } catch (error) {
        console.error('Error in story expiration job:', error);
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});