// postSchema.js
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", postSchema);
