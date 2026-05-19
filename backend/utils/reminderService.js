const sendEmail = require("./sendEmail")

async function sendBulkReminder(task, sender, hours) {

    console.log("send reminder hit")

    let color = "#fb923c" // yellow default
    let badge = "24 HOURS LEFT"

    if (hours >= 48) {
        color = "#facc15"
        badge = "48 HOURS LEFT"
    }

    await Promise.all(task.faculties.map(async (faculty) => {

 const message = `
<div style="font-family:Arial;background:#f8fafc;padding:20px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    
    <div style="background:${color};color:white;padding:16px;font-size:20px;font-weight:bold;text-align:center;">
      ⏰ ${badge}
    </div>

    <div style="padding:24px;color:#334155;line-height:1.6;">
      <h2 style="margin-top:0;">Hello ${faculty.name},</h2>

      <p>
        Reminder from <b>${sender.name}</b>
      </p>

      <div style="background:#f8fafc;padding:16px;border-radius:10px;margin-top:16px;">
        <p><b>Title:</b> ${task.title}</p>
        <p><b>Description:</b> ${task.description}</p>
        <p><b>Priority:</b> ${task.priority}</p>
        <p><b>Due Date:</b> ${new Date(task.due_date).toLocaleString()}</p>
      </div>

      <p style="margin-top:20px;">
        Please complete the task before deadline.
      </p>
    </div>

  </div>
</div>
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
<div style="font-family:Arial;background:#fff1f2;padding:20px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;border:1px solid #fecdd3;overflow:hidden;">
    
    <div style="background:#ef4444;color:white;padding:16px;font-size:22px;font-weight:bold;text-align:center;">
      ⚠ TASK OVERDUE
    </div>

    <div style="padding:24px;color:#334155;line-height:1.6;">

      <h2 style="margin-top:0;">Hello ${faculty.name},</h2>

      <p>
        The following task assigned by <b>${sender.name}</b> is overdue.
      </p>

      <div style="background:#fff5f5;padding:16px;border-radius:10px;border-left:4px solid #ef4444;margin-top:16px;">
        <p><b>Title:</b> ${task.title}</p>
        <p><b>Priority:</b> ${task.priority}</p>
        <p><b>Due Date:</b> ${new Date(task.due_date).toLocaleString()}</p>
      </div>

      <p style="margin-top:20px;color:#b91c1c;font-weight:600;">
        Please complete this task immediately.
      </p>

    </div>

  </div>
</div>
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
