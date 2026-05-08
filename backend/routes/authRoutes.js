const express = require("express")
const router = express.Router()

const supabase = require("../config/supabaseClient")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const rateLimit = require("express-rate-limit")

const sendEmail = require("../utils/sendEmail")

// ==============================
// 🔒 RATE LIMIT
// ==============================
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        message: "Too many password reset requests. Try again later."
    }
})

// ==============================
// 🔐 PASSWORD CHECK
// ==============================
const isStrongPassword = (password) => {
    return password.length >= 6
}


// ==============================
// ✅ FACULTY SIGNUP
// ==============================
router.post("/signup", async (req, res) => {

    const { name, email, password, department_id, organization_id } = req.body

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            message: "Password too weak (min 6 chars)"
        })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data, error } = await supabase
        .from("users")
        .insert([{
            name,
            email,
            password: hashedPassword,
            role: "faculty",
            department_id,
            organization_id
        }])
        .select()
        .single()

    if (error) {
        console.log("Supabase error:", error)
        return res.status(400).json(error)
    }

    // 🔔 ORG BASED NOTIFICATION
    await supabase
        .from("notifications")
        .insert([{
            message: `New faculty signup: ${name}`,
            type: "signup",
            organization_id // ✅ IMPORTANT
        }])

    // ===========================
    // 📧 EMAIL TO ORG ADMINS
    // ===========================
    try {
        let orgId = organization_id

        // fallback from department
        if (!orgId && department_id) {
            const { data: dept } = await supabase
                .from("departments")
                .select("organization_id")
                .eq("id", department_id)
                .single()

            orgId = dept?.organization_id
        }

        const { data: admins } = await supabase
            .from("users")
            .select("email")
            .eq("role", "admin")
            .eq("organization_id", orgId)

        if (admins && admins.length > 0) {
            for (const admin of admins) {
                await sendEmail(
                    admin.email,
                    "New Faculty Signup",
                    `
                    <h2>New Faculty Signup</h2>
                    <p><b>Name:</b> ${name}</p>
                    <p><b>Email:</b> ${email}</p>
                    <p>Waiting for your approval</p>
                    `
                )
            }
        } else {
            await sendEmail(
                process.env.ADMIN_EMAIL,
                "No Admin Found - Faculty Signup",
                `${name} signed up but no organization admin exists.`
            )
        }

    } catch (err) {
        console.log("Email error:", err.message)
    }

    res.json({
        message: "Signup successful. Wait for admin approval."
    })
})


// ==============================
// ✅ LOGIN (UPDATED 🔥)
// ==============================
router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body

        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single()

        if (error || !data) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        const match = await bcrypt.compare(password.trim(), data.password)

        if (!match) {
            return res.status(401).json({
                message: "Wrong password"
            })
        }

        if (!data.is_approved) {
            return res.status(403).json({
                message: "Admin approval required"
            })
        }

        // 🔥 FIXED JWT (VERY IMPORTANT)
        const token = jwt.sign(
            {
                id: data.id,
                role: data.role,
                organization_id: data.organization_id,   // ✅ ADDED
                department_id: data.department_id        // ✅ ADDED
            },
            "SECRET_KEY",
            { expiresIn: "1h" }
        )

        // 🔥 UPDATED RESPONSE
        res.json({
            token,
            user: {
                id: data.id,
                name: data.name,
                email: data.email,
                role: data.role,
                organization_id: data.organization_id,   // ✅ ADDED
                department_id: data.department_id        // ✅ ADDED
            }
        })

    } catch (err) {
        res.status(500).json({
            message: err.message
        })
    }
})


// ==============================
// 🔐 FORGOT PASSWORD
// ==============================
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({ message: "Email is required" })
        }

        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single()

        if (!user) {
            return res.json({
                message: "If email exists, reset link has been sent"
            })
        }

        const rawToken = crypto.randomBytes(32).toString("hex")

        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex")

        const expiry = Date.now() + 15 * 60 * 1000

        await supabase
            .from("users")
            .update({
                reset_token: hashedToken,
                reset_token_expiry: expiry
            })
            .eq("id", user.id)

        const resetLink = `http://localhost:5173/reset-password/${rawToken}`

        await sendEmail(
            email,
            "Reset Password",
            `Click here to reset your password: ${resetLink}`
        )

        res.json({ message: "Reset link sent to email 📩" })

    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "Server error" })
    }
})


// ==============================
// 🔐 RESET PASSWORD
// ==============================
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params
        const { password } = req.body

        if (!password) {
            return res.status(400).json({ message: "Password required" })
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                message: "Password too weak (min 6 chars)"
            })
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex")

        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("reset_token", hashedToken)
            .single()

        if (!user) {
            return res.status(400).json({ message: "Invalid token" })
        }

        if (user.reset_token_expiry < Date.now()) {
            return res.status(400).json({
                message: "Token expired"
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await supabase
            .from("users")
            .update({
                password: hashedPassword,
                reset_token: null,
                reset_token_expiry: null
            })
            .eq("id", user.id)

        res.json({ message: "Password reset successful ✅" })

    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "Server error" })
    }
})

module.exports = router