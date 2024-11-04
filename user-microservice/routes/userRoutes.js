const express = require("express");
const router = express.Router();

const {
  signin,
  signup,
  logoutUser,
  getUserById,
  deleteUser,
} = require("../controller/userController.js");
const { validateUser } = require("../middleware/validateUser.js");

router.post("/signin", signin);
router.post("/signup", validateUser, signup);
router.post("/logout", logoutUser);
router.get("/:id", getUserById);
router.post("/delete/:id", deleteUser);

module.exports = router;
