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
    console.log(`Error ${err} while trying to connect to database`);
  });

app.get("/participants", async (req, res) => {
  try {
    const data = await db.collection("participants").find().toArray();
    return res.send(data);
  } catch (error) {
    console.log(error);
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

    await db
      .collection("participants")
      .insertOne({ name, lastStatus: Date.now() });

    const newParticipantMessage = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("hh:mm:ss"),
    };

    await db.collection("messages").insertOne(newParticipantMessage);

    return res.sendStatus(201);
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
});

app.listen(5000, () => {
  console.log("listen on port 5000");
});
