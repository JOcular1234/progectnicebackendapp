const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    profilePictureId: { type: String }, // Cloudinary public_id
    bio: { type: String },
    createdAt: { type: Date, default: Date.now },
});
userSchema.index({ username: 'text', email: 'text' });
module.exports = mongoose.model('User', userSchema);