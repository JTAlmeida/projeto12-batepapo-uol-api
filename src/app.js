import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;

mongoClient
  .connect()
  .then(() => {
    db = mongoClient.db("batepapo-uol");
  })
  .catch((error) => {
    return console.error(
      `Error "${error}" while trying to connect to database`
    );
  });

const SEC = 1000;

setInterval(async () => {
  const kickTime = Date.now() - 10 * SEC;

  try {
    const inactiveUsers = await db
      .collection("participants")
      .find({ lastStatus: { $lte: kickTime } })
      .toArray();

    if (inactiveUsers.length > 0) {
      const inactiveKickedMessage = inactiveUsers.map((user) => {
        return {
          from: user.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("hh:mm:ss"),
        };
      });
      await db
        .collection("participants")
        .deleteMany({ lastStatus: { $lte: kickTime } });
      await db.collection("messages").insertMany(inactiveKickedMessage);
    }
  } catch (error) {
    return console.error(
      `Error "${error}" while trying to remove inactive user`
    );
  }
}, 15 * SEC);

app.get("/participants", async (req, res) => {
  try {
    const data = await db.collection("participants").find().toArray();
    return res.send(data);
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      hint: "It's better to check if database is properly connected.",
    });
  }
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participantSchema = joi.object({ name: joi.string().required() });
  const validation = participantSchema.validate({ name });

  try {
    if (validation.error) {
      return res.status(422).send({ message: "Please insert a name." });
    }

    const checkName = await db
      .collection("participants")
      .findOne({ name: name });

    if (checkName && checkName.name === name) {
      return res.status(429).send({
        message: "Name already being used, please insert a different one.",
      });
    }

    await db.collection("participants").insertOne({
      name,
      lastStatus: Date.now(),
    });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("hh:mm:ss"),
    });

    return res.sendStatus(201);
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      hint: "It's better to check if database is properly connected.",
    });
  }
});

app.get("/messages", async (req, res) => {
  const displayLimit = parseInt(req.query.limit);
  const { user } = req.headers;

  try {
    const data = await db.collection("messages").find().toArray();

    const displayFilter = data.filter((message) => {
      return (
        message.to === "Todos" ||
        message.to === user ||
        message.from === user ||
        message.type === "message"
      );
    });

    if (displayLimit) {
      return res.send(displayFilter.slice(-displayLimit));
    }

    return res.send(displayFilter);
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      hint: "It's better to check if database is properly connected.",
    });
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid("message", "private_message"),
    from: joi.string().required(),
  });

  const validation = messageSchema.validate(
    { to, text, type, from },
    { abortEarly: false }
  );

  try {
    if (validation.error) {
      const err = validation.error.details.map((error) => {
        return error.message;
      });
      return res.status(422).send({ message: err });
    }

    const checkFrom = await db
      .collection("participants")
      .findOne({ name: from });

    if (!checkFrom) {
      return res.status(422).send({
        message: "Participant doesn't exist!",
      });
    }

    await db
      .collection("messages")
      .insertOne({ to, text, type, from, time: dayjs().format("hh:mm:ss") });

    return res.sendStatus(201);
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      hint: "It's better to check if database is properly connected.",
    });
  }
});

app.delete("/messages/:id", async (req, res) => {
  const id = req.params.id;
  const { user } = req.headers;

  try {
    const message = await db
      .collection("messages")
      .findOne({ _id: ObjectId(id) });

    if (!message) {
      return res.status(404).send({ message: "Message not found." });
    }

    if (message.from !== user) {
      return res.status(401).send({
        message: "User trying to delete isn't the same that sent the message.",
      });
    }

    await db.collection("messages").deleteOne({ _id: ObjectId(id) });

    return res.status(200).send({ message: "Message deleted successfully." });
  } catch (error) {
    res.status(500).send({
      error: error.message,
      hint: "It's better to check if database is properly connected.",
    });
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: user });

    if (!participant) {
      return res.sendStatus(404);
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });

    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      hint: "It's better to check if database is properly connected.",
    });
  }
});

app.listen(5000);
