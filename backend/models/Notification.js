const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'comment', 'follow', 'story_view'], required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Notification', notificationSchema);