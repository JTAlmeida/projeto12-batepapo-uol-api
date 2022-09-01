import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
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
  .catch((err) => {
    console.error(`Error ${err} while trying to connect to database`);
  });

app.get("/participants", async (req, res) => {
  try {
    const data = await db.collection("participants").find().toArray();
    return res.send(data);
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  try {
    if (!name) {
      return res.status(422).send({ message: "Please insert a name." });
    }

    const checkName = await db
      .collection("participants")
      .findOne({ name: name });

    if (checkName && checkName.name === name) {
      return res.status(429).send({
        message: "Name already being used, pleased insert a different one.",
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
    console.error(error);
    return res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;

  try {
    if (!to || !text || !type || !from) {
      return res.status(422).send({ message: "Please fill all fields." });
    }

    if (type !== "message" && type !== "private_message") {
      return res.status(422).send({ message: "Message type is invalid." });
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
    console.error(error);
    return res.sendStatus(500);
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
    console.error(error);
    return res.sendStatus(500);
  }
});

app.listen(5000, () => {
  console.log("listen on port 5000");
});
