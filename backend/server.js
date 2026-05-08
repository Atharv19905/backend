require("dotenv").config()
// require("./cron/reminder")

const express = require("express")
const cors = require("cors")

const adminRequestsRoutes = require("./routes/adminRequestsRoutes");
const authRoutes = require("./routes/authRoutes")
const adminRoutes = require("./routes/adminRoutes")
const taskRoutes = require("./routes/taskRoutes")

const app = express()

app.set("trust proxy", 1);

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json())

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/tasks", taskRoutes)
app.use("/api/admin-request", adminRequestsRoutes)

// Health check
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});