Here's a detailed README to guide through the setup of both the User service and Post service using RabbitMQ for inter-service communication. This README includes step-by-step instructions and explanations of each part.

---

# Microservices Setup with RabbitMQ: User and Post Services

This README provides a comprehensive guide for setting up two microservices, **User Service** and **Post Service**, that communicate using **RabbitMQ** for message passing. The **User Service** handles user creation and deletion, while the **Post Service** manages posts associated with users and reacts to user creation and deletion events from the **User Service**.

## Prerequisites

- **Node.js** and **npm** installed on your machine.
- **MongoDB** database instance (local or cloud).
- **RabbitMQ** server running (locally or on a cloud service).

## Table of Contents

1. [Project Structure](#project-structure)
2. [Environment Setup](#environment-setup)
3. [User Service Setup](#user-service-setup)
   - Installing Dependencies
   - Configuring RabbitMQ
   - Creating User Model and Routes
   - Implementing RabbitMQ Publisher
4. [Post Service Setup](#post-service-setup)
   - Installing Dependencies
   - Configuring RabbitMQ Consumer
   - Creating Post Schema and Routes
5. [Testing and Running the Services](#testing-and-running-the-services)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

### Project Structure

The directory structure for both services is shown below:

```
project-root/
├── user-service/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── app.js
│   └── .env
└── post-service/
    ├── models/
    ├── routes/
    ├── utils/
    ├── consumer.js
    └── app.js
```

Each service contains:

- **models/**: Database schemas.
- **routes/**: Express routes.
- **utils/**: Utility files for RabbitMQ setup.
- **app.js**: Main entry point for each service.
- **consumer.js**: Only in Post Service to handle RabbitMQ message consumption.

---

### Environment Setup

Create `.env` files in both `user-service` and `post-service` directories with the following configuration details:

```plaintext
# MongoDB URI
DB_URI=mongodb://localhost:27017/{database_name}

# RabbitMQ URL
RABBITMQ_URL=amqp://localhost
```

---

## Project Setup

Let's create our project structure:

```bash
# Create project directory
mkdir my-microservices
cd my-microservices

# Create service directories
mkdir auth-service post-service

# Initialize both services
cd auth-service
npm init -y
cd ../post-service
npm init -y
```

Install required packages for both services:

```bash
# In auth-service directory
npm install express mongoose amqplib bcryptjs cors dotenv

# In post-service directory
npm install express mongoose amqplib cors dotenv
```

## Step-by-Step Implementation

### 1. Setting Up RabbitMQ

```bash
# Run RabbitMQ container
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

---

## User Service Setup

### 1. Installing Dependencies

Navigate to the `user-service` directory and install the required packages:

```bash
npm init -y
npm install express body-parser mongoose dotenv amqplib bcryptjs
```

### 2. Configuring RabbitMQ in `user-service/utils/rabbitmq.js`

Create a file `rabbitmq.js` inside `utils` directory. This file will connect to RabbitMQ and publish messages:

```javascript
const amqp = require("amqplib");

let channel, connection;

const connectQueue = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue("user_events"); // Define the queue
    console.log("RabbitMQ connection established");
  } catch (error) {
    console.error("RabbitMQ connection error:", error);
  }
};

const publishMessage = async (queueName, message) => {
  try {
    if (!channel) {
      await connectQueue();
    }
    await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    console.log("Message sent:", message);
  } catch (error) {
    console.error("Error publishing message:", error);
  }
};

module.exports = { connectQueue, publishMessage };
```

### 3. Creating the User Model in `models/UserModel.js`

Define the `UserModel` with basic fields for storing user data:

```javascript
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
});

module.exports = mongoose.model("User", userSchema);
```

### 4. Creating User Routes in `routes/userRoutes.js`

Create two routes:

- **POST /signup** for creating users and sending a message to RabbitMQ.
- **DELETE /delete/:id** for deleting users and notifying the Post Service.

```javascript
const express = require("express");
const router = express.Router();
const { signup, deleteUser } = require("../controllers/userController");

router.post("/signup", signup);
router.delete("/delete/:id", deleteUser);

module.exports = router;
```

### 5. Implementing Signup and Delete Controllers

In `controllers/userController.js`:

```javascript
const UserModel = require("../models/UserModel");
const bcrypt = require("bcryptjs");
const { publishMessage } = require("../utils/rabbitmq");

const signup = async (req, res) => {
  const { email, name, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
      email,
      name,
      password: hashedPassword,
    });

    const message = { userId: user._id, email, name, event: "user_signup" };
    await publishMessage("user_events", message);

    res.status(201).json({ message: "User created", user });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Could not create user" });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const message = { userId: id, event: "user_delete" };
    await publishMessage("user_events", message);

    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Could not delete user" });
  }
};

module.exports = { signup, deleteUser };
```

### 6. Setting Up `app.js` in User Service

```javascript
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const { connectQueue } = require("./utils/rabbitmq");

dotenv.config();
const app = express();

connectQueue();

app.use(express.json());
app.use("/user", userRoutes);

mongoose
  .connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() =>
    app.listen(5000, () => console.log("User Service running on port 5000"))
  )
  .catch((error) => console.log("MongoDB connection error:", error));
```

---

## Post Service Setup

### 1. Installing Dependencies

```bash
cd ../post-service
npm init -y
npm install express body-parser mongoose dotenv amqplib
```

### 2. Configuring RabbitMQ Consumer in `post-service/utils/rabbitmq.js`

```javascript
const amqp = require("amqplib");

let channel;

const connectQueue = async (handleUserEvent) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue("user_events");

    channel.consume("user_events", handleUserEvent, { noAck: true });
    console.log("RabbitMQ consumer connected");
  } catch (error) {
    console.error("RabbitMQ connection error:", error);
  }
};

module.exports = { connectQueue };
```

### 3. Creating the Consumer Logic in `consumer.js`

```javascript
const { connectQueue } = require("./utils/rabbitmq");
const UserModel = require("./models/UserModel");

const handleUserEvent = async (message) => {
  const { userId, email, name, event } = JSON.parse(message.content.toString());

  if (event === "user_signup") {
    await UserModel.create({ _id: userId, email, name });
    console.log("User created in Post Service:", name);
  } else if (event === "user_delete") {
    await UserModel.findByIdAndDelete(userId);
    console.log("User deleted in Post Service:", userId);
  }
};

connectQueue(handleUserEvent);
```

### 4. Setting Up `app.js` in Post Service

```javascript
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
require("./consumer"); // Initialize the consumer

dotenv.config();
const app = express();

mongoose
  .connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() =>
    app.listen(5001, () => console.log("Post Service running on port 5001"))
  )
  .catch((error) => console.log("MongoDB connection error:", error));
```

---

## Testing and Running the Services

1. **Run RabbitMQ** on localhost or specify its connection URL in `.env`.
2. **Start User Service**:
   ```bash
   cd user-service
   node app.js
   ```
3. **Start Post Service**:
   ```bash
   cd ../post-service
   node app.js
   ```

---

Certainly! Here’s a continuation and elaboration on the README for your microservices architecture, focusing on debugging common issues and a summary of the overall setup.

---

## Troubleshooting Common Issues

#### Connection Errors

- **MongoDB Connection**: Ensure that your MongoDB service is running. You can verify this by connecting to your MongoDB instance using a MongoDB client or by checking logs in the MongoDB service.

  - Make sure the connection string in your `.env` file is correct.
  - Check for any network-related issues that may prevent your Node.js application from connecting to MongoDB.

- **RabbitMQ Connection**: Similarly, confirm that your RabbitMQ service is up and running. You can access the RabbitMQ management interface at `http://localhost:15672` and log in (default username/password: `guest/guest`).
  - Ensure that the RabbitMQ server URL in your `.env` file is correct.
  - If you encounter connection refused errors, verify that the RabbitMQ service is indeed running and accessible on the specified port.

#### Validation Errors

- **User Creation**: When creating users, ensure that the request payload conforms to the validation rules you've established in your `signup` controller.

  - Check that the payload includes all required fields (e.g., `email`, `password`, `name`) and that they meet the specified format and criteria.
  - Use tools like Postman or curl to manually test the endpoints with valid and invalid payloads to confirm that validation logic is functioning as expected.

- **Post Creation**: If you're adding posts linked to users, ensure that the user ID is correctly referenced and that the corresponding user exists in the database before creating a post.

#### Message Not Received

- **Queue Names**: Double-check that the queue names specified in both the publisher and consumer match exactly, including case sensitivity. For instance, ensure both are using `"user_events"`.

- **Consumer Status**: In the RabbitMQ management interface, confirm that your consumer is active and consuming messages from the specified queue. Look for the number of messages ready and unacknowledged.

  - Check your consumer logs to ensure that it is processing messages correctly. If it’s not, there may be issues with the message format or parsing logic in the consumer.

- **Error Handling in Consumers**: Make sure you have adequate error handling in your consumers to catch any issues that arise while processing messages. This will help you diagnose problems when events fail to process.

### Summary of the Architecture

By following the steps outlined in this README, you will have established a basic microservices architecture using Node.js, Express, MongoDB, and RabbitMQ. The key components include:

1. **User Service**: Responsible for managing user registrations, deletions, and other user-related operations. This service publishes events to RabbitMQ whenever a user is created or deleted.
2. **Post Service**: This service listens for events published by the User Service. It creates references to user IDs in the Post documents when a user is created and removes any associated posts when a user is deleted.

3. **RabbitMQ**: Acts as the message broker, facilitating communication between the User Service and Post Service. It ensures that events are published and consumed reliably.

4. **MongoDB**: Both services use MongoDB to persist data, including user information and posts. Each service manages its own database collection, maintaining separation of concerns.

### Additional Considerations

- **Security**: Implement authentication and authorization to protect your endpoints. Consider using JSON Web Tokens (JWT) for securing user-related routes.

- **Environment Variables**: Store sensitive information such as database URIs and RabbitMQ URLs in a `.env` file. Ensure that this file is not included in version control (add it to `.gitignore`).

- **Scalability**: As your application grows, consider how you will scale your services. You may want to look into Docker for containerization or Kubernetes for orchestration.

- **Testing**: Write unit tests for your services to ensure reliability and maintainability as you add new features.

- **Documentation**: Keep your API documented, using tools like Swagger or Postman, to facilitate onboarding for new developers and ease integration with other services.

By adhering to these practices and troubleshooting guidelines, you can maintain a robust microservices architecture that can grow and evolve with your application's needs.

---

Feel free to adjust or expand upon any section to better fit your project's specific details and requirements!
