const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
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
    const userCollection = client.db("AlliedParts").collection("users");

    // Create User
    app.put("/user/:uid", async (req, res) => {
      let updateInfo = {};
      const user = req.body.loggedUser;
      const uid = req.params.uid;
      const query = { uid };
      const options = { upsert: true };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        updateInfo = {
          $set: existUser,
        };
      } else if (!user.role) {
        user.role = "user";
        updateInfo = {
          $set: user,
        };
      } else {
        updateInfo = {
          $set: user,
        };
      }
      const result = await userCollection.updateOne(query, updateInfo, options);
      const token = jwt.sign({ uid }, process.env.SECRET_TOKEN, {
        expiresIn: "12h",
      });
      res.send({ result, token });
    });

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
