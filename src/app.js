import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("batepapo-uol");
});

app.get("/participants", (req, res)=>{
    db.collection("participants").find().toArray().then(data => {
        res.send(data);
    })
});

app.listen(5000, () => {
  console.log("listen on port 5000");
});