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

// JWT Verification
const verifyJwt = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const reviewCollection = client.db("AlliedParts").collection("reviews");
    const orderCollection = client.db("AlliedParts").collection("orders");

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

    // Get all Review
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection
        .find({})
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Get 6 review
    app.get("/review/6", async (req, res) => {
      const result = await reviewCollection
        .find({})
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Get single item
    app.get("/item/:itemId", verifyJwt, async (req, res) => {
      const itemId = req.params.itemId;
      const query = { _id: { $in: [ObjectId(itemId)] } };
      const item = await partsCollection.findOne(query);
      res.send(item);
    });

    // Create an order
    app.post("/order/:itemId", async (req, res) => {
      const itemId = req.params.itemId;
      const details = req.body;
      const result = await orderCollection.insertOne(details);
      res.send(result);
    });

    // Get an user orders
    app.get("/my-order", verifyJwt, async (req, res) => {
      const uid = req.query.uid;
      const query = { uid };
      const result = await orderCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Delete an order
    app.delete("/delete/:orderId", verifyJwt, async (req, res) => {
      const orderId = req.params.orderId;
      const query = { _id: ObjectId(orderId) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // Add Review
    app.post("/add-review/:uid", verifyJwt, async (req, res) => {
      const uid = req.params.uid;
      const review = req.body.review;
      console.log(uid, review);
      const exist = await reviewCollection.findOne({ uid });
      console.log("exist", exist);
      if (exist) {
        return res.send({
          success: false,
          message: "Your Review Already exist !",
        });
      } else {
        const result = await reviewCollection.insertOne(review);
        return res.send({ success: true, result });
      }
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
