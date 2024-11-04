const amqp = require("amqplib");

let channel, connection;

const connectQueue = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Ensure queue exists
    await channel.assertQueue("user_events");

    console.log("RabbitMQ connection established");
    return channel;
  } catch (error) {
    console.error("RabbitMQ connection error:", error);
    throw error;
  }
};

const publishMessage = async (queueName, message) => {
  try {
    if (!channel) {
      channel = await connectQueue();
    }
    await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    console.log("Message sent:", message);
  } catch (error) {
    console.error("Error publishing message:", error);
    throw error;
  }
};

module.exports = {
  connectQueue,
  publishMessage,
};
