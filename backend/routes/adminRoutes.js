const express = require("express");
const router = express.Router();

const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const sendEmail = require("../utils/sendEmail");


// ==============================
// ✅ GET PENDING FACULTY (ORG + DEPT BASED)
// ==============================
router.get("/pending", verifyToken, verifyAdmin, async (req, res) => {

    const { organization_id, department_id } = req.user;

    let query = supabase
        .from("users")
        .select("*")
        .eq("role", "faculty")
        .eq("is_approved", false);

    if (organization_id) {
        query = query.eq("organization_id", organization_id);
    }

    if (department_id) {
        query = query.eq("department_id", department_id);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json(error);

    res.json(data);
});


// ==============================
// ✅ GET NOTIFICATIONS (OPTIONAL FILTER)
// ==============================
router.get("/notifications", verifyToken, verifyAdmin, async (req, res) => {

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return res.status(400).json(error);

    res.json(data);
});


// ==============================
// ✅ MARK NOTIFICATION AS READ
// ==============================
router.put("/notifications/read/:id", verifyToken, verifyAdmin, async (req, res) => {

    const { id } = req.params;

    await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

    res.json({ message: "Notification read" });
});


// ==============================
// ✅ APPROVE FACULTY (SECURED)
// ==============================
router.post("/approve/:id", verifyToken, verifyAdmin, async (req, res) => {

    const { id } = req.params;
    const { organization_id, department_id } = req.user;

    const { data: faculty } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

    if (!faculty) {
        return res.status(404).json({ message: "Faculty not found" });
    }

    // 🔒 SECURITY CHECK (VERY IMPORTANT)
    if (
        faculty.organization_id !== organization_id ||
        (department_id && faculty.department_id !== department_id)
    ) {
        return res.status(403).json({
            message: "Not allowed to approve this faculty"
        });
    }

    await supabase
        .from("users")
        .update({ is_approved: true })
        .eq("id", id);

    // 📧 Email
    await sendEmail(
        faculty.email,
        "Faculty Account Approved",
        `Hello ${faculty.name},

Your account has been approved.

Login here:
http://localhost:5173/login`
    );

    res.json({
        message: "Faculty approved and email sent"
    });
});


// ==============================
// ✅ GET APPROVED FACULTY (ORG + DEPT BASED)
// ==============================
router.get("/faculty", verifyToken, verifyAdmin, async (req, res) => {

    const { organization_id, department_id } = req.user;

    let query = supabase
        .from("users")
        .select("*")
        .eq("role", "faculty")
        .eq("is_approved", true);

    if (organization_id) {
        query = query.eq("organization_id", organization_id);
    }

    if (department_id) {
        query = query.eq("department_id", department_id);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json(error);

    res.json(data);
});


// ==============================
// ✅ GET DEPARTMENTS (FILTERED)
// ==============================
router.get("/departments", async (req, res) => {

    const { organization_id } = req.query;

    let query = supabase
        .from("departments")
        .select("*");

    if (organization_id) {
        query = query.eq("organization_id", organization_id);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json(error);

    res.json(data);
});


// ==============================
// ✅ GET ORGANISATIONS
// ==============================
router.get("/organisations", async (req, res) => {

    const { data, error } = await supabase
        .from("organizations")
        .select("*");

    if (error) return res.status(400).json(error);

    res.json(data);
});

module.exports = router;