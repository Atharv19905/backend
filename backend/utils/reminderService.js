const sendEmail = require("./sendEmail")

async function sendBulkReminder(task, sender, hours) {
    console.log("send reminder hit ")
    await Promise.all(task.faculties.map(async (faculty) => {

        const message = `
Hello ${faculty.name},

Reminder from ${sender.name}

The following task is due in ${hours} hours.

Title: ${task.title}
Description: ${task.description}
Priority: ${task.priority}
Due Date: ${new Date(task.due_date).toLocaleString()}

Please complete it before the deadline.
        `

        await sendEmail(
            faculty.email,
            `Task Reminder (${hours} hrs): ${task.title}`,
            message
        )

    }))
}

async function sendBulkOverdue(task, sender) {
    console.log("overdue hit")
    await Promise.all(task.faculties.map(async (faculty) => {

        const message = `
⚠ TASK OVERDUE

Hello ${faculty.name},

The following task assigned by ${sender.name} is overdue.

Title: ${task.title}
Priority: ${task.priority}
Due Date: ${new Date(task.due_date).toLocaleString()}

Please complete it immediately.
        `

        await sendEmail(
            faculty.email,
            `⚠ Task Overdue: ${task.title}`,
            message
        )

    }))
}

module.exports = {
    sendBulkReminder,
    sendBulkOverdue
}