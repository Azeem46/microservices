const express = require("express");

const {
  getLatestPosts,
  getPostsByCreator,
  getPostsBySearch,
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  incrementViews,
  likePost,
} = require("../controllers/postController.js");

const router = express.Router();

router.get("/latest", getLatestPosts);
router.get("/creator", getPostsByCreator);
router.get("/search", getPostsBySearch);
router.get("/", getPosts);
router.get("/:id", getPost);
router.patch("/:id/view", incrementViews);

// router.post("/:id/commentPost", commentPost);

module.exports = router;
