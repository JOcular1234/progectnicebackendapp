const mongoose = require('mongoose');
const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    mediaId: { type: String, required: true }, // Cloudinary public_id
    caption: { type: String },
    hashtags: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
});
postSchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('Post', postSchema);