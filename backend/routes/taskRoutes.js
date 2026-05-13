const express = require("express")
const router = express.Router()

const supabase = require("../config/supabaseClient")
const verifyToken = require("../middleware/verifyToken")

const multer = require("multer")

// const storage = multer.diskStorage({
//     destination: "uploads/",
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + "-" + file.originalname)
//     }
// })

// const upload = multer({ storage })
const upload = multer({
    storage: multer.memoryStorage()
})

// Create task
router.post("/create", verifyToken, upload.single("document"), async (req, res) => {

    try {

        const { title, description, priority, due_date, visibility } = req.body

        if (!title || !due_date) {
            return res.status(400).json({
                message: "Title and due date are required"
            })
        }

        // const documentPath = req.file ? req.file.filename : null

        let documentPath = null

        if (req.file) {
            const file = req.file
            const fileName = `${Date.now()}-${file.originalname}`

            const { error: uploadError } = await supabase.storage
                .from("uploads") // your bucket name
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                })

            if (uploadError) throw uploadError

            documentPath = fileName
        }

        const { data, error } = await supabase
            .from("tasks")
            .insert([{
                title,
                description,
                assigned_by: req.user.id,
                priority,
                due_date,
                visibility: visibility || "private",
                document: documentPath,
                organization_id: req.user.organization_id,
                department_id: req.user.department_id,
                created_at: new Date()
            }])
            .select()
            .single()

        if (error) throw error

        res.json(data)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})


// Assign task to faculty
const sendEmail = require("../utils/sendEmail")

router.post("/assign", verifyToken, async (req, res) => {

    try {

        const { task_id, faculty_id } = req.body

        if (!task_id || !faculty_id) {
            return res.status(400).json({
                message: "task_id and faculty_id required"
            })
        }

        const { data: taskCheck } = await supabase
            .from("tasks")
            .select("organization_id, department_id")
            .eq("id", task_id)
            .single()

        if (taskCheck.organization_id !== req.user.organization_id) {
            return res.status(403).json({ message: "Invalid org" })
        }

        const { data: facultyCheck } = await supabase
            .from("users")
            .select("organization_id, department_id")
            .eq("id", faculty_id)
            .single()

        if (
            facultyCheck.organization_id !== req.user.organization_id ||
            facultyCheck.department_id !== taskCheck.department_id
        ) {
            return res.status(403).json({ message: "Invalid department" })
        }

        const { data: existing } = await supabase
            .from("task_assignments")
            .select("*")
            .eq("task_id", task_id)
            .eq("faculty_id", faculty_id)
            .eq("organization_id", req.user.organization_id)
            .eq("department_id", req.user.department_id)

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Task already assigned to this faculty"
            })
        }

        const { error } = await supabase
            .from("task_assignments")
            .insert([{
                task_id,
                faculty_id,
                status: "pending",
                assigned_at: new Date(),
                organization_id: req.user.organization_id,
                department_id: req.user.department_id
            }])

        if (error) throw error


        const { data: task } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", task_id)
            .single()

        const { data: faculty } = await supabase
            .from("users")
            .select("email,name")
            .eq("id", faculty_id)
            .single()


        const message = `
Hello ${faculty.name},

A new task has been assigned to you.

Title: ${task.title}
Description: ${task.description}
Priority: ${task.priority}
Due Date: ${new Date(task.due_date).toLocaleDateString()}

Please login to the system to view details.
        `

        let attachments = []


        // attachments.push({
        //     filename: task.document,
        //     path: `uploads/${task.document}`
        // })
        if (task.document) {
            const { data, error } = await supabase.storage
                .from("uploads")
                .createSignedUrl(task.document, 300) // 5 minutes

            if (error) throw error

            attachments.push({
                filename: task.document,
                path: data.signedUrl
            })
        }


        try {
     sendEmail(
        faculty.email,
        `New Task Assigned: ${task.title}`,
        message,
        attachments
    )
} catch (mailErr) {
    console.error("Email failed:", mailErr.message)
}
res.json({
    message: "Task assigned successfully"
})
    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})

router.delete("/delete/:id", verifyToken, async (req, res) => {

    try {

        const { id } = req.params;

        // verify ownership
        const { data: task, error: fetchError } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        // only creator can delete
        if (task.assigned_by !== req.user.id) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        // delete assignments first
        await supabase
            .from("task_assignments")
            .delete()
            .eq("task_id", id);

        // delete task
        const { error } = await supabase
            .from("tasks")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.json({
            message: "Task deleted successfully"
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });
    }
});
router.get("/file/:name", verifyToken, async (req, res) => {
    try {
        const { name } = req.params

        const { data, error } = await supabase.storage
            .from("uploads")
            .createSignedUrl(name, 300)

        if (error) throw error

        res.json({ url: data.signedUrl })

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Faculty marks task complete
router.put("/complete/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: assignment, error: fetchError } = await supabase
            .from("task_assignments")
            .select("task_id")
            .eq("id", id)
            .eq("organization_id", req.user.organization_id)
            .single();

        if (fetchError) throw fetchError;

        const taskId = assignment.task_id;

        const { error: assignError } = await supabase
            .from("task_assignments")
            .update({ status: "completed" })
            .eq("id", id)
            .eq("faculty_id", req.user.id)
            .eq("organization_id", req.user.organization_id);

        if (assignError) throw assignError;

        const { data: remaining, error: checkError } = await supabase
            .from("task_assignments")
            .select("id")
            .eq("task_id", taskId)
            .eq("organization_id", req.user.organization_id)
            .neq("status", "completed");

        if (checkError) throw checkError;

        if (remaining.length === 0) {
            await supabase
                .from("tasks")
                .update({
                    status: "completed",
                    completed_at: new Date()
                })
                .eq("id", taskId)
                .eq("organization_id", req.user.organization_id);
        }

        res.json({
            message: "Task progress updated"
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});


// Faculty dashboard statistics
router.get("/stats", verifyToken, async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("task_assignments")
            .select("*")
            .eq("faculty_id", req.user.id)
            .eq("organization_id", req.user.organization_id)

        if (error) throw error

        const total = data.length
        const completed = data.filter(t => t.status === "completed").length
        const pending = data.filter(t => t.status === "pending").length

        res.json({
            total,
            completed,
            pending
        })

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})


router.put("/reassign", verifyToken, async (req, res) => {

    try {

        const { assignment_id, new_faculty_id, due_date } = req.body

        if (!assignment_id || !new_faculty_id) {
            return res.status(400).json({
                message: "assignment_id and new_faculty_id required"
            })
        }

        const { data: assignment, error: fetchError } = await supabase
            .from("task_assignments")
            .select(`
                id,
                faculty_id,
                task_id,
                tasks(assigned_by, department_id)
            `)
            .eq("id", assignment_id)
            .eq("organization_id", req.user.organization_id)
            .single()

        if (fetchError || !assignment) {
            return res.status(404).json({
                message: "Assignment not found"
            })
        }

        if (assignment.tasks.assigned_by !== req.user.id) {
            return res.status(403).json({
                message: "Only task creator can reassign"
            })
        }

        const { data: facultyCheck } = await supabase
            .from("users")
            .select("organization_id, department_id")
            .eq("id", new_faculty_id)
            .single()

        if (
            facultyCheck.organization_id !== req.user.organization_id ||
            facultyCheck.department_id !== assignment.tasks.department_id
        ) {
            return res.status(403).json({ message: "Invalid department" })
        }

        const { data: existing } = await supabase
            .from("task_assignments")
            .select("*")
            .eq("task_id", assignment.task_id)
            .eq("faculty_id", new_faculty_id)
            .neq("id", assignment_id)
            .eq("organization_id", req.user.organization_id)

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Task already assigned to this faculty"
            })
        }

        const { error } = await supabase
            .from("task_assignments")
            .update({
                faculty_id: new_faculty_id,
                status: "pending",
                assigned_at: new Date()
            })
            .eq("id", assignment_id)
            .eq("organization_id", req.user.organization_id)

        if (due_date) {
            await supabase
                .from("tasks")
                .update({ due_date })
                .eq("id", assignment.task_id)
                .eq("organization_id", req.user.organization_id)
        }

        const { data: newFaculty } = await supabase
            .from("users")
            .select("email,name")
            .eq("id", new_faculty_id)
            .single()

        if (error) throw error

         sendEmail(
            newFaculty.email,
            "Task Reassigned to You",
            `Hello ${newFaculty.name},

A task has been reassigned to you.

Please check your dashboard.

Task Management System`
        )

        res.json({
            message: "Task reassigned successfully"
        })

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})

router.post("/run-reminders", async (req, res) => {

    try {
        const apiKey = req.headers["apikey"]

        if (apiKey !== process.env.CRON_SECRET) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        const {
            sendBulkReminder,
            sendBulkOverdue
        } = require("../utils/reminderService")



        const { data, error } = await supabase
            .from("task_assignments")
            .select(`
                status,
                task_id,
                users(email,name),
                tasks(
                    id,
                    title,
                    description,
                    priority,
                    due_date,
                    reminder_48_ready,
                    reminder_24_ready,
                    overdue_ready,
                    reminder_48_sent,
                    reminder_24_sent,
                    overdue_sent,
                    users!tasks_assigned_by_fkey(email,name)
                )
            `)
            .neq("status", "completed")


        if (error) throw error

        const taskMap = {}

        data.forEach(row => {
            const task = row.tasks

            if (!taskMap[task.id]) {
                taskMap[task.id] = {
                    ...task,
                    faculties: []
                }
            }

            taskMap[task.id].faculties.push(row.users)
        })

        for (const task of Object.values(taskMap)) {

            const sender = task.users

            if (task.reminder_48_ready && !task.reminder_48_sent) {

                await sendBulkReminder(task, sender, "48")

                await supabase
                    .from("tasks")
                    .update({
                        reminder_48_ready: false,
                        reminder_48_sent: true
                    })
                    .eq("id", task.id)
            }

            if (task.reminder_24_ready && !task.reminder_24_sent) {

                await sendBulkReminder(task, sender, "24")

                await supabase
                    .from("tasks")
                    .update({
                        reminder_24_ready: false,
                        reminder_24_sent: true
                    })
                    .eq("id", task.id)
            }

            if (task.overdue_ready && !task.overdue_sent) {

                await sendBulkOverdue(task, sender)

                await supabase
                    .from("tasks")
                    .update({
                        overdue_ready: false,
                        overdue_sent: true
                    })
                    .eq("id", task.id)

            }
        }

        res.json({ message: "Reminders processed" })

    } catch (err) {

        console.log("Reminder error:", err.message)

        res.status(500).json({ error: err.message })
    }
})

// Get faculty notifications
router.get("/notifications", verifyToken, async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", req.user.id)
            .eq("organization_id", req.user.organization_id)
            .order("created_at", { ascending: false })

        if (error) throw error

        res.json(data)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})


// Faculty view assigned tasks
router.get("/mytasks", verifyToken, async (req, res) => {

    try {


        const { data, error } = await supabase
            .from("task_assignments")
            .select(`
                *,
                tasks (*)
            `)
            .eq("faculty_id", req.user.id)
            .eq("organization_id", req.user.organization_id)
            .order("assigned_at", { ascending: false })

        if (error) throw error

        res.json(data)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})


// Productivity analytics
router.get("/productivity", verifyToken, async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("task_assignments")
            .select(`
                *,
                tasks (*)
            `)
            .eq("faculty_id", req.user.id)
            .eq("organization_id", req.user.organization_id)

        if (error) throw error

        const total = data.length

        const completed = data.filter(
            t => t.status === "completed"
        ).length

        const pending = data.filter(
            t => t.status === "pending"
        ).length

        const overdue = data.filter(t => {

            if (!t.tasks?.due_date) return false

            const due = new Date(t.tasks.due_date)
            const now = new Date()

            return due < now && t.status !== "completed"

        }).length

        const completionRate = total === 0
            ? 0
            : Math.round((completed / total) * 100)

        res.json({
            total_tasks: total,
            completed_tasks: completed,
            pending_tasks: pending,
            overdue_tasks: overdue,
            completion_rate: completionRate
        })

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})

// Upcoming tasks (next 48 hours)

router.get("/upcoming", verifyToken, async (req, res) => {

    try {

        const now = new Date()
        const next48 = new Date()
        next48.setHours(next48.getHours() + 48)

        const { data, error } = await supabase
            .from("task_assignments")
            .select(`
                *,
                tasks (*)
            `)
            .eq("faculty_id", req.user.id)
            .eq("organization_id", req.user.organization_id)

        if (error) throw error

        const upcoming = data.filter(t => {

            if (!t.tasks?.due_date) return false

            const due = new Date(t.tasks.due_date)

            return due >= now && due <= next48 && t.status !== "completed"

        })

        res.json(upcoming)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})

router.get("/faculties", verifyToken, async (req, res) => {

    const { department_id } = req.query

    let query = supabase
        .from("users")
        .select("id,name,department_id")
        .eq("role", "faculty")
        .eq("is_approved", true)
        .eq("organization_id", req.user.organization_id)

    if (department_id) {

        const deptArray = department_id.split(",")

        query = query.in("department_id", deptArray)

    }

    const { data, error } = await query

    if (error) {
        return res.status(500).json(error)
    }

    res.json(data)

})
router.get("/departments", verifyToken, async (req, res) => {

    const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("organization_id", req.user.organization_id)

    if (error) return res.status(500).json(error)

    res.json(data)
})

// Report endpoint (used for PDF generation in frontend)
router.get("/report", verifyToken, async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("task_assignments")
            .select(`
                status,
                assigned_at,
                tasks(
                    title,
                    description,
                    due_date,
                    priority
                )
            `)
            .eq("faculty_id", req.user.id)
            .eq("organization_id", req.user.organization_id)

        if (error) throw error

        res.json(data)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

})
router.get("/assigned-analytics", verifyToken, async (req, res) => {
    try {
        const facultyId = req.user.id;

        const { data, error } = await supabase
            .from("task_assignments")
            .select(`
                status,
                users ( name ),
                tasks (
                    id,
                    title,
                    assigned_by,
                    due_date
                )
            `)
            .eq("tasks.assigned_by", facultyId)
            .eq("organization_id", req.user.organization_id);

        if (error) throw error;

        const today = new Date();

        /* ---------------- OLD (for charts - KEEP SAME) ---------------- */
        let completed = [];
        let pending = [];
        let overdue = [];

        /* ---------------- NEW (task-wise with LISTS) ---------------- */
        const taskMap = {};

        data.forEach((t) => {
            if (!t.tasks) return;

            const name = t.users?.name || "Unknown";
            const taskId = t.tasks.id;
            const due = new Date(t.tasks.due_date);

            /* ---------- CHART DATA (UNCHANGED) ---------- */
            if (t.status === "completed") {
                completed.push(name);
            } else if (due < today) {
                overdue.push(name);
            } else {
                pending.push(name);
            }

            /* ---------- TASK-WISE LIST STRUCTURE ---------- */
            if (!taskMap[taskId]) {
                taskMap[taskId] = {
                    task_title: t.tasks.title,
                    due_date: t.tasks.due_date,
                    pending: [],
                    completed: [],
                    overdue: [],
                };
            }

            if (t.status === "completed") {
                taskMap[taskId].completed.push(name);
            } else if (due < today) {
                taskMap[taskId].overdue.push(name);
            } else {
                taskMap[taskId].pending.push(name);
            }
        });

        res.json({
            /* ✅ Charts remain SAME */
            completed,
            pending,
            overdue,
            assigned_total: data.length,

            /* ✅ New UI data */
            tasks: Object.values(taskMap),
        });

    } catch (err) {
        console.log("ASSIGNED ANALYTICS ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});
module.exports = router
