// =====================================
// BACKEND: js/index.js - MongoDB (Local) - CST3144
// =====================================
console.log("🚀 Starting Express + MongoDB server...");

// Use relative path to demo folder modules
var express = require("../demo/node_modules/express");
var http = require("http");
var path = require("path");
var mongodb = require("../demo/node_modules/mongodb");
var MongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

// Express app
var app = express();
app.use(express.json());


// Enable CORS
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
});

// =====================================
// MongoDB Local Connection (Database: backendlibrary)
// =====================================


async function connectDB() {
  try {
    await client.connect();
    db = client.db("backendlibrary");
    console.log("✅ Connected to MongoDB Database: backendlibrary");

    // Check available collections
    var collections = await db.listCollections().toArray();
    console.log("📁 Available collections:", collections.map(function(c) { return c.name; }));

    // Auto-load sample lessons if 'lessons' collection is empty
    var lessonsCollection = db.collection("lessons");
    var lessonCount = await lessonsCollection.countDocuments();
    console.log("📊 Current lessons count:", lessonCount);
    
    if (lessonCount === 0) {
      console.log("📝 No lessons found. Adding sample data...");
      await addSampleLessons();
    }

    // Check if 'orders' collection exists
    var ordersExists = collections.some(function(c) { return c.name === "orders"; });
    if (!ordersExists) {
      await db.createCollection("orders");
      console.log("✅ Created 'orders' collection");
    } else {
      console.log("✅ 'orders' collection already exists");
    }

    // Test orders collection
    var ordersCount = await db.collection("orders").countDocuments();
    console.log("📦 Current orders count:", ordersCount);

  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}

// Sample lessons if none exist
async function addSampleLessons() {
  try {
    var sampleLessons = [
      { subject: "Mathematics", location: "Hendon", price: 100, spaces: 5, image: "maths.png" },
      { subject: "Physics", location: "Colindale", price: 80, spaces: 5, image: "physic.png" },
      { subject: "Chemistry", location: "Brent Cross", price: 90, spaces: 5, image: "chemistry.png" },
      { subject: "Biology", location: "Golders Green", price: 95, spaces: 5, image: "biology.png" },
      { subject: "History", location: "Camden", price: 70, spaces: 5, image: "history.png" },
      { subject: "English", location: "Ealing", price: 85, spaces: 5, image: "english.png" },
      { subject: "Computer Science", location: "Watford", price: 120, spaces: 5, image: "compsci.png" },
      { subject: "Art", location: "Hackney", price: 60, spaces: 5, image: "artbook.png" },
      { subject: "Music", location: "Stratford", price: 110, spaces: 5, image: "music.png" },
      { subject: "Economics", location: "Islington", price: 130, spaces: 5, image: "economicsbook.png" }
    ];
    await db.collection("lessons").insertMany(sampleLessons);
    console.log("✅ Sample lessons added to backendlibrary database");
  } catch (error) {
    console.error("❌ Error adding sample lessons:", error);
  }
}

// Connect to database
connectDB();

// =====================================
// Middleware - Logger
// =====================================
app.use(function (req, res, next) {
  console.log(new Date().toISOString() + " - " + req.method + " " + req.url);
  next();
});

// =====================================
// ROUTES
// =====================================

// Get all lessons
app.get("/lessons", async function (req, res) {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }
    var lessons = await db.collection("lessons").find({}).toArray();
    console.log("📚 Sent lessons:", lessons.length);
    res.json(lessons);
  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// Search lessons
app.get("/search", async function (req, res) {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }
    
    var query = req.query.q;
    if (!query) return res.status(400).json({ error: "Query required" });

    console.log("🔍 Search query received:", query);

    var lessons = await db.collection("lessons").find({
      $or: [
        { subject: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
        { price: { $regex: query, $options: "i" } },
        { spaces: { $regex: query, $options: "i" } }
      ]
    }).toArray();

    console.log("📊 Search results:", lessons.length);
    res.json(lessons);

  } catch (error) {
    console.error("❌ Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// =====================================
// POST: Save new order to MongoDB - CORRECTED VERSION
// =====================================
app.post("/orders", async function (req, res) {
  try {
    console.log(" ");
    console.log("=".repeat(50));
    console.log("📦 ORDER SUBMISSION RECEIVED");
    console.log("=".repeat(50));
    
    if (!db) {
      console.error("❌ Database not connected");
      return res.status(500).json({ success: false, error: "Database not connected" });
    }

    console.log("📥 Request body:", JSON.stringify(req.body, null, 2));

    var name = req.body.name;
    var phone = req.body.phone;
    var lessonIDs = req.body.lessonIDs;
    var totalPrice = req.body.totalPrice;
    var totalItems = req.body.totalItems;

    // Validation
    if (!name || !phone) {
      console.error("❌ Missing name or phone");
      return res.status(400).json({ success: false, error: "Name and phone are required" });
    }

    if (!lessonIDs || !Array.isArray(lessonIDs) || lessonIDs.length === 0) {
      console.error("❌ Invalid lesson IDs:", lessonIDs);
      return res.status(400).json({ success: false, error: "No valid lessons in cart" });
    }

    console.log("✅ Validation passed");
    console.log("📋 Order details:", {
      name: name,
      phone: phone,
      lessonIDs: lessonIDs,
      totalPrice: totalPrice,
      totalItems: totalItems
    });

    // Create order document
    var order = {
      name: name,
      phone: phone,
      lessonIDs: lessonIDs,
      totalPrice: totalPrice || 0,
      totalItems: totalItems || lessonIDs.length,
      orderDate: new Date(),
      status: "confirmed"
    };

    console.log("💾 Attempting to save order to database...");
    console.log("📄 Order document:", JSON.stringify(order, null, 2));

    // ✅ CRITICAL FIX: ACTUALLY SAVE TO MONGODB
    var result = await db.collection("orders").insertOne(order);
    
    console.log("✅ ORDER SAVED SUCCESSFULLY TO MONGODB!");
    console.log("🆔 MongoDB Insert Result:", result);
    console.log("📦 Order ID:", result.insertedId);
    
    // ✅ UPDATE LESSON SPACES IN DATABASE
    console.log("🔄 Updating lesson spaces in database...");
    for (var i = 0; i < lessonIDs.length; i++) {
      var lessonId = lessonIDs[i];
      try {
        // Since you're using numeric IDs in frontend, we need to handle this
        // First try to find the lesson by your numeric ID
        var lesson = await db.collection("lessons").findOne({ 
          $or: [
            { id: lessonId },
            { _id: lessonId }
          ]
        });
        
        if (lesson) {
          // Update using the correct identifier (_id from MongoDB)
          await db.collection("lessons").updateOne(
            { _id: lesson._id },
            { $inc: { spaces: -1 } }
          );
          console.log("✅ Updated spaces for lesson:", lesson.subject);
        } else {
          console.warn("⚠️ Lesson not found with ID:", lessonId);
        }
      } catch (err) {
        console.warn("⚠️ Failed to update lesson:", lessonId, err);
      }
    }

    console.log("=".repeat(50));
    console.log(" ");

    // Return success response
    res.json({
      success: true,
      message: "Order saved to MongoDB database successfully",
      orderId: result.insertedId,
      order: order
    });

  } catch (error) {
    console.error(" ");
    console.error("❌ ORDER SAVE ERROR:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error(" ");
    
    res.status(500).json({ 
      success: false, 
      error: "Failed to save order: " + error.message 
    });
  }
});

// =====================================
// GET: All orders (for debugging)
// =====================================
app.get("/orders", async function (req, res) {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }
    
    var orders = await db.collection("orders").find({}).toArray();
    console.log("📋 Retrieved orders from database:", orders.length);
    
    res.json({ 
      success: true, 
      count: orders.length, 
      orders: orders 
    });
    
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// =====================================
// PUT: Update lesson spaces
// =====================================
app.put("/lessons/:id", async function (req, res) {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    var lessonId = req.params.id;
    var spaces = req.body.spaces;

    if (spaces === undefined) {
      return res.status(400).json({ error: "Spaces value required" });
    }

    var result = await db.collection("lessons").updateOne(
      { _id: new ObjectId(lessonId) },
      { $set: { spaces: spaces } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({ message: "Lesson updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

// =====================================
// Health check route
// =====================================
app.get("/health", function (req, res) {
  var dbStatus = db ? "Connected" : "Disconnected";
  res.json({
    status: "Server is running",
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// =====================================
// Test data route - to check if MongoDB is working
// =====================================
app.get("/test", async function (req, res) {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }
    
    var lessonsCount = await db.collection("lessons").countDocuments();
    var ordersCount = await db.collection("orders").countDocuments();
    
    res.json({
      message: "✅ Backend is working correctly",
      database: "backendlibrary",
      lessonsCount: lessonsCount,
      ordersCount: ordersCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: "Database test failed: " + error.message });
  }
});

// =====================================
// Default route
// =====================================
app.get("/", function (req, res) {
  res.json({
    message: "📚 Express server running successfully",
    database: "MongoDB - backendlibrary",
    collections: ["lessons", "orders"],
    endpoints: {
      lessons: "GET /lessons",
      search: "GET /search?q=query",
      orders: "POST /orders",
      allOrders: "GET /orders",
      updateLesson: "PUT /lessons/:id",
      health: "GET /health",
      test: "GET /test"
    }
  });
});

// =====================================
// Start the server
// =====================================
var PORT = 8080;
http.createServer(app).listen(PORT, function () {
  console.log(" ");
  console.log("=".repeat(50));
  console.log("🚀 SERVER STARTED SUCCESSFULLY");
  console.log("=".repeat(50));
  console.log("📍 Server URL: http://localhost:" + PORT);
  console.log("🗄️  Database: backendlibrary");
  console.log("📋 Collections: lessons, orders");
  console.log(" ");
  console.log("🔗 Available Endpoints:");
  console.log("   📚 GET  /lessons     - Get all lessons");
  console.log("   🔍 GET  /search?q=   - Search lessons");
  console.log("   📦 POST /orders      - Submit new order");
  console.log("   👀 GET  /orders      - View all orders");
  console.log("   ❤️  GET  /health      - Server health check");
  console.log("   🧪 GET  /test        - Database test");
  console.log("=".repeat(50));
  console.log(" ");
});