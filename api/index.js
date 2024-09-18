const express = require("express");
const app = express();
// const port = process.env.PORT;
const port = 8080;
const cors = require("cors");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

app.use(express.json());
app.use(
  cors({
    origin: `${process.env.REACT_APP_FAPI_URL}`,
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri =
  "mongodb+srv://andywong3111:2IqMocgkbOwg7eAc@parties.5dssi5j.mongodb.net/?appName=Parties";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB once at startup
client
  .connect()
  .then(() => {
    console.log("Connected to MongoDB");

    // Start the server after connecting to the database
    app.listen(port, () => {
      console.log(`Server is running on ${process.env.REACT_APP_API_URL}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });

////////////////////Events Data/////////////////////////

async function events() {
  try {
    const db = client.db("Parties");
    const getUsersResult = await db.collection("events").find({}).toArray();
    return getUsersResult;
  } catch (err) {
    console.error(err);
  }
}

app.get("/", async (req, res) => {
  try {
    const result = await events();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred" });
  }
});

////////////////////Users Data/////////////////////////

async function getUsers(email) {
  try {
    const db = client.db("Parties");
    const options = {
      projection: {
        _id: 1,
        user_id: 1,
        first_name: 1,
        last_name: 1,
        phone: 1,
        sex: 1,
        mbti: 1,
        email: 1,
        password: 1,
      },
    };
    const getUsersResult = await db
      .collection("users")
      .findOne({ email: email }, options);
    return getUsersResult;
  } catch (err) {
    console.error(err);
  }
}

app.get("/user", async (req, res) => {
  const result = await getUsers(req.query.email);
  res.json(result);
});

////////////////////Check Users Valid/////////////////////////
async function getUserValid(id) {
  try {
    const db = client.db("Parties");

    // Convert the id string to ObjectId
    const obj_id = new ObjectId(id); // Changed to `new ObjectId(id)`

    // Log the ObjectId for debugging
    // console.log("Searching for ObjectId:", obj_id);

    // Search the user by ObjectId
    const getUserValidResult = await db
      .collection("users")
      .findOne({ _id: obj_id });

    // Log the result for debugging
    // console.log("Query Result:", getUserValidResult);

    return getUserValidResult;
  } catch (err) {
    console.error("Error in getUserValid:", err);
    throw err; // Rethrow the error so the caller can handle it
  }
}

app.get("/user_valid", async (req, res) => {
  try {
    // Check if _id is provided in the query
    if (!req.query._id) {
      return res.status(400).json({ error: "Missing _id parameter" });
    }

    // Retrieve user information
    const result = await getUserValid(req.query._id);
    ////http://localhost:8080/user_valid?_id=669ddd88dd5303e516871ca6 query string
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log for debugging purposes
    // console.log("User found:", result);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
///////////sign up page////////////

app.post("/signup", async (req, res) => {
  const { firstName, lastName, phone, sex, mbti, email, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  try {
    const db = client.db("Parties");
    const collection = db.collection("users");

    // Check if user already exists
    const existingUser = await collection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user document
    const result = await collection.insertOne({
      firstName,
      lastName,
      phone,
      sex,
      mbti,
      email,
      password: hashedPassword,
      isValid: true,
      event_taken: [],
    });

    res.status(201).json({ message: "User created successfully", result });
  } catch (error) {
    console.error("Error creating user:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the user" });
  }
});

///////////log in page////////////

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = client.db("Parties");
    const collection = db.collection("users");

    // Find the user by email
    const user = await collection.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare the password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Set the cookie
    res.cookie("user_id", user._id.toString(), {
      httpOnly: false,
      secure: true, // Use 'true' in production
      sameSite: "none",
      maxAge: 3600000, // 1 hour
    });
    return res.json({ message: "Logged in" });
  } catch (error) {
    console.error("Error logging in:", error);
  }
});

// Gracefully close the MongoDB client on process termination
process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});

// Define the API Route
app.get("/events", async (req, res) => {
  const { event_category } = req.query; // Get the category from query parameters
  console.log(req.query.event_category);
  console.log("event_category: ", event_category); // Log the category

  try {
    const db = client.db("Parties");

    // Fetch events based on the query
    const eventsCursor = db
      .collection("events")
      .find({ event_catagory: event_category }); // Use event_category here

    const events = await eventsCursor.toArray(); // Convert the cursor to an array

    console.log(events); // Log the fetched events
    res.json(events); // Send the events as the response
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred" });
  }
});

///////////Payment part/////////////
// This is your test secret API key.
const stripe = require("stripe")(
  "sk_test_51Pfc73RpMFJ5xHHffz4Ij93e9y03YiNyi8pXHQAAo0wsgMU2OAzvexRp63L4fMT9dkPtjUzjDr4dp6yYedCpEqMe00QiOFI2Vz"
);

app.use(express.static("public"));

const calculateOrderAmount = (items) => {
  // Replace this constant with a calculation of the order's amount
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return 1400;
};

app.post("/create-payment-intent", async (req, res) => {
  const { items } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: calculateOrderAmount(items),
    currency: "hkd",
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

//add userid back MongoDB eventDatabase
app.post("/addUserToEvent", async (req, res) => {
  try {
    const { userId, event_id } = req.body;
    console.log(userId);
    console.log(event_id);

    const db = client.db("Parties");
    const event = await db
      .collection("events")
      .findOne({ event_id: Number(event_id) });

    db.collection("events").updateOne(
      { event_id: Number(event_id) },
      { $push: { event_attendees: "" + userId } },
      (err, result) => {
        if (err) {
          console.error("Error updating document:", err);
          res.status(500).send("Error updating database");
        } else {
          console.log("User ID added to event_attendees successfully");
          res.status(200).send("User added to event_attendees");
        }
      }
    );

    const obj_id = new ObjectId(userId); // Changed to `new ObjectId(id)`

    // Log the ObjectId for debugging
    // console.log("Searching for ObjectId:", obj_id);
    // Search the user by ObjectId
    db.collection("users").updateOne(
      { _id: obj_id },
      { $push: { event_taken: "" + event_id } },
      (err, result) => {
        if (err) {
          console.error("Error updating document:", err);
          res.status(500).send("Error updating database");
        } else {
          console.log("added to user's event_taken successfully");
          res.status(200).send("added to user's event_taken");
        }
      }
    );
  } catch (err) {
    console.error("Error updating document:", err);
    res.status(500).send("Error updating database");
  }
});

// Gracefully close the MongoDB client on process termination
process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});
