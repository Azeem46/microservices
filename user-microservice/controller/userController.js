const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const UserModal = require("../models/userSchema");
const { publishMessage } = require("../utils/rabbitmq");

const secret = process.env.JWT_SECRET || "test"; // Use environment variable for secret
const tokenExpiry = "1y"; // Token expiration set to one year

// Utility function for email validation
const isValidEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

// Signin function
const signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Find user by email
    const oldUser = await UserModal.findOne({ email });

    if (!oldUser) {
      return res.status(404).json({ message: "User doesn't exist" });
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(password, oldUser.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign({ email: oldUser.email, id: oldUser._id }, secret, {
      expiresIn: tokenExpiry,
    });

    // Respond with success message and user details
    res.status(200).json({
      message: "User signed in successfully",
      user: {
        email: oldUser.email,
        id: oldUser._id,
        name: oldUser.name,
        joinDate: oldUser.joinDate,
        postCount: oldUser.postCount,
        token,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Utility function for password validation
const isValidPassword = (password) => {
  const passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{6,15}$/;
  return passwordPattern.test(password);
};

// Utility function for name validation
const isValidName = (name) => {
  return typeof name === "string" && name.length >= 3 && name.length <= 15;
};

// Signup function

const signup = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Validate email
    if (!email || !email.includes("@") || !isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate name
    if (!isValidName(name)) {
      return res
        .status(400)
        .json({ message: "Name must be between 3 and 15 characters long" });
    }

    // Validate password
    if (!isValidPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be between 6 and 15 characters long, include at least one letter, one number, and one special character",
      });
    }

    // Check if user with the same email already exists
    const existingUserByEmail = await UserModal.findOne({ email });
    if (existingUserByEmail) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Check if user with the same name already exists
    const existingUserByName = await UserModal.findOne({ name });
    if (existingUserByName) {
      return res
        .status(400)
        .json({ message: "User with this name already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const result = await UserModal.create({
      email,
      password: hashedPassword,
      name,
    });

    // Publish message to RabbitMQ queue
    const message = {
      userId: result._id,
      email: result.email,
      name: result.name,
      event: "user_signup",
    };
    await publishMessage("user_events", message);

    // Respond with user data
    res.status(201).json({ result });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// @desc Logging out
// route POST /api/users/logout
// @access public
const logoutUser = asyncHandler(async (req, res) => {
  try {
    res.cookie("jwt", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    res.status(200).json({ message: "User logged out" });
  } catch (error) {
    res.status(404).json({ message: "something went wrong" });
  }
});

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModal.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// In user service: deleteUser controller
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user exists
    const user = await UserModal.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete the user
    await UserModal.findByIdAndDelete(id);

    // Publish user_delete event to RabbitMQ
    const message = {
      userId: id, // Use `userId` for consistency
      event: "user_delete",
    };
    await publishMessage("user_events", message);

    // Send response
    res.status(200).json({ message: "User deleted successfully" });
    console.log(`User ${id} deleted and event published to queue.`);
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { signin, signup, logoutUser, getUserById, deleteUser };