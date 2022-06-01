const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
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
  await jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
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
    const blogCollection = client.db("AlliedParts").collection("blogs");

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const requesterUid = req.decoded.uid;
      const requesterAccount = await userCollection.findOne({
        uid: requesterUid,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(401).send({ message: "Unauthorized Access" });
      }
    };

    // Create a payment Intent
    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

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

    // Get a single user orders
    app.get("/my-order", verifyJwt, async (req, res) => {
      const uid = req.query.uid;
      const query = { uid };
      const result = await orderCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Get an order Details
    app.get("/order/:orderId", verifyJwt, async (req, res) => {
      const orderId = req.params.orderId;
      const query = { _id: ObjectId(orderId) };
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    // Paid an order
    app.put("/payment/:orderId", verifyJwt, async (req, res) => {
      const orderId = req.params.orderId;
      const transactionId = req.body.transactionId;
      const query = { _id: ObjectId(orderId) };
      const options = { upsert: false };
      const updatePayment = { $set: { status: "Pending", transactionId } };
      const result = await orderCollection.updateOne(
        query,
        updatePayment,
        options
      );
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
      const exist = await reviewCollection.findOne({ uid });
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

    // Check Admin
    app.get("/admin/:uid", async (req, res) => {
      const uid = req.params.uid;
      const user = await userCollection.findOne({ uid });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    // Get All Orders
    app.get("/orders", verifyJwt, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // Status Update
    app.put("/shift/:orderId", verifyJwt, verifyAdmin, async (req, res) => {
      const orderId = req.params.orderId;
      const query = { _id: ObjectId(orderId) };
      const options = { upsert: false };
      const update = { $set: { status: "Shifted" } };
      const result = await orderCollection.updateOne(query, update, options);
      res.send(result);
    });

    // Get All user
    app.get("/users", verifyJwt, async (req, res) => {
      const query = {};
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });

    // Delete an user
    app.delete(
      "/delete-user/:uid",
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const uid = req.params.uid;
        const query = { _id: ObjectId(uid) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Add an item
    app.post("/add-item", verifyJwt, verifyAdmin, async (req, res) => {
      const item = req.body.item;
      const result = await partsCollection.insertOne(item);
      res.send(result);
    });

    // Delete an Item
    app.delete(
      "/delete-item/:itemId",
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const itemId = req.params.itemId;
        const query = { _id: ObjectId(itemId) };
        const result = await partsCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Make Admin
    app.put("/make-admin/:uid", verifyJwt, verifyAdmin, async (req, res) => {
      const uid = req.params.uid;
      const query = { _id: ObjectId(uid) };
      const options = { upsert: false };
      const update = { $set: { role: "admin" } };
      const result = await userCollection.updateOne(query, update, options);
      res.send(result);
    });

    // Get Blogs
    app.get("/blogs", async (req, res) => {
      const query = {};
      const result = await blogCollection.find(query).toArray();
      res.send(result);
    });

    // Get user Details
    app.get("/profile/:uid", verifyJwt, async (req, res) => {
      const uid = req.params.uid;
      const query = { uid };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // UPdate user data
    app.put("/profile-update/:uid", async (req, res) => {
      const uid = req.params.uid;
      const details = req.body.details;
      const query = { uid };
      const options = { upsert: false };
      const update = { $set: details };
      const result = await userCollection.updateOne(query, update, options);
      res.send(result);
    });
  } finally {
    // client.close()
  }
};

run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Let's Explore Allied Server");
});

app.listen(port, () => {
  console.log("Allied server is running on : ", port);
});
