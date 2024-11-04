// consumer.js
const UserModel = require("../models/UserModel"); // Assumes User schema exists in Post Service
const { consumeMessages } = require("../utils/rabbitmq");

const handleUserEvent = async (message) => {
  const { userId, email, name, event } = message;

  try {
    if (event === "user_signup") {
      // Create a user record in Post Service's database
      await UserModel.create({ _id: userId, email, name });
      console.log("User created in Post Service:", name);
    } else if (event === "user_delete") {
      // Delete the user record
      await UserModel.findOneAndDelete({ _id: userId });
      console.log("User deleted in Post Service:", userId);
    }
  } catch (error) {
    console.error("Error handling user event:", error);
  }
};

// Start consuming messages
consumeMessages(handleUserEvent);
