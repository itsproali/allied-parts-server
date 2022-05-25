const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@alliedcluster.blmq2.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const partsCollection = client.db("AlliedParts").collection("parts");

    // Get all parts
    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find({}).sort({ _id: -1 }).toArray();
      res.send(result);
    });
    // Get 3 parts
    app.get("/parts/3", async (req, res) => {
      const result = await partsCollection
        .find({})
        .sort({ _id: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });
  } finally {
    // client.close()
  }
};

run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("This is Turbo Server");
});

app.listen(port, () => {
  console.log("Turbo server is running on : ", port);
});
