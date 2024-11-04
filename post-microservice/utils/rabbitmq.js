// utils/rabbitmq.js
const amqp = require("amqplib");

let channel, connection;

const connectQueue = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Ensure queue exists
    await channel.assertQueue("user_events");

    console.log("RabbitMQ connection established in Post Service");
    return channel;
  } catch (error) {
    console.error("RabbitMQ connection error in Post Service:", error);
    throw error;
  }
};

// Consume messages from the queue
const consumeMessages = async (handler) => {
  try {
    if (!channel) {
      await connectQueue();
    }
    channel.consume("user_events", (message) => {
      if (message !== null) {
        const content = JSON.parse(message.content.toString());
        console.log("Received message:", content);

        handler(content); // Pass message to handler
        channel.ack(message); // Acknowledge message
      }
    });
  } catch (error) {
    console.error("Error consuming message:", error);
  }
};

module.exports = {
  connectQueue,
  consumeMessages,
};
