const mongoose = require('mongoose');
const storySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    mediaId: { type: String, required: true }, // Cloudinary public_id
    caption: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
});
storySchema.index({ userId: 1, expiresAt: 1, isActive: 1 });
module.exports = mongoose.model('Story', storySchema);