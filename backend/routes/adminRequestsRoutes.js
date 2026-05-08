const express = require("express");
const router = express.Router();

const supabase = require("../config/supabaseClient");
const bcrypt = require("bcryptjs");

const verifySuperAdmin = require("../middleware/verifySuperAdmin");
const verifyToken = require("../middleware/verifyToken");

const sendEmail = require("../utils/sendEmail");


// ==============================
// ✅ CREATE ADMIN REQUEST (PUBLIC)
// ==============================
router.post("/request-admin", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            organization_name,
            organization_id,
            department
        } = req.body;



        if (!name || !email || !password || (!organization_name && !organization_id) || !department) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // 🔒 prevent duplicate pending request
        const { data: existing } = await supabase
            .from("admin_requests")
            .select("*")
            .eq("email", email)
            .eq("status", "pending")
            .maybeSingle();

        if (existing) {
            return res.status(400).json({
                message: "Request already pending"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { error } = await supabase
            .from("admin_requests")
            .insert([{
                name,
                email,
                password: hashedPassword,
                organization_name: organization_name || null,
                organization_id: organization_id || null,
                department,
                status: "pending"
            }]);

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        // 🔔 Email to super admins
        try {
            const { data: superAdmins } = await supabase
                .from("users")
                .select("email")
                .eq("role", "super_admin");

            for (const admin of superAdmins || []) {
                await sendEmail(
                    admin.email,
                    "New Admin Approval Request",
                    `
                    <h2>New Admin Request 🚀</h2>
                    <p><b>Name:</b> ${name}</p>
                    <p><b>Email:</b> ${email}</p>
                    <p><b>Organization:</b> ${organization_name || "Existing"}</p>
                    <p><b>Department:</b> ${department}</p>
                    `
                );
            }
        } catch (err) {
            console.log("Email error:", err.message);
        }

        res.json({
            message: "Admin request submitted. Wait for approval."
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


// ==============================
// ✅ GET ALL REQUESTS (WITH SORT)
// ==============================
router.get("/admin-requests", verifyToken, verifySuperAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from("admin_requests")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        return res.status(400).json({ message: error.message });
    }

    res.json(data);
});


// ==============================
// 📊 ANALYTICS ENDPOINT
// ==============================
router.get("/stats", verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("admin_requests")
            .select("created_at, status");

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        res.json(data);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


// ==============================
// ✅ APPROVE ADMIN
// ==============================
router.post("/approve-admin/:id", verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: request } = await supabase
            .from("admin_requests")
            .select("*")
            .eq("id", id)
            .single();

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        // 🔒 prevent duplicate user
        const { data: existingUser } = await supabase
            .from("users")
            .select("*")
            .eq("email", request.email)
            .maybeSingle();

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        let org;

        // 🔹 Org logic
        if (request.organization_id) {
            const { data } = await supabase
                .from("organizations")
                .select("*")
                .eq("id", request.organization_id)
                .single();
            org = data;
        } else {
            const { data } = await supabase
                .from("organizations")
                .insert([{ name: request.organization_name }])
                .select()
                .single();
            org = data;
        }

        // 🔹 Department logic
        let dept;

        const { data: existingDept } = await supabase
            .from("departments")
            .select("*")
            .eq("name", request.department)
            .eq("organization_id", org.id)
            .maybeSingle();

        if (existingDept) {
            dept = existingDept;
        } else {
            const { data } = await supabase
                .from("departments")
                .insert([{
                    name: request.department,
                    organization_id: org.id
                }])
                .select()
                .single();
            dept = data;
        }

        // 🔹 Create admin
        await supabase.from("users").insert([{
            name: request.name,
            email: request.email,
            password: request.password,
            role: "admin",
            organization_id: org.id,
            department_id: dept.id,
            is_approved: true
        }]);

        // 🔔 Email to user
        try {
            await sendEmail(
                request.email,
                "Account Approved 🎉",
                `
                <h2>Welcome ${request.name} 🎉</h2>
                <p>Your admin account has been approved.</p>
                <p><b>Organization:</b> ${org.name}</p>
                <p><b>Department:</b> ${dept.name}</p>
                <p>You can now login.</p>
                `
            );
        } catch (err) {
            console.log("Email error:", err.message);
        }

        // ✅ UPDATE status (instead of delete)
        await supabase
            .from("admin_requests")
            .update({ status: "approved" })
            .eq("id", id);

        res.json({ message: "Admin approved successfully" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


// ==============================
// ❌ REJECT ADMIN REQUEST
// ==============================
router.post("/reject-admin/:id", verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const { data: request } = await supabase
            .from("admin_requests")
            .select("*")
            .eq("id", id)
            .single();

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        // 🔔 Email rejection
        try {
            await sendEmail(
                request.email,
                "Admin Request Rejected ❌",
                `
                <h2>Hello ${request.name},</h2>
                <p>Your admin request has been rejected.</p>
                ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ""}
                <p>You may reapply with correct details.</p>
                `
            );
        } catch (err) {
            console.log("Email error:", err.message);
        }

        // ✅ UPDATE status (instead of delete)
        await supabase
            .from("admin_requests")
            .update({
                status: "rejected",
                rejection_reason: reason || null
            })
            .eq("id", id);

        res.json({ message: "Request rejected successfully" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = router;