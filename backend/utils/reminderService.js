const sendEmail = require("./sendEmail")

async function sendBulkReminder(task, sender, hours) {

    console.log("send reminder hit")

    let color = "#facc15" // yellow default
    let badge = "24 HOURS LEFT"

    if (hours >= 48) {
        color = "#fb923c"
        badge = "48 HOURS LEFT"
    }

    await Promise.all(task.faculties.map(async (faculty) => {

        const message = `
        <div style="
            font-family: Arial, sans-serif;
            background: #f8fafc;
            padding: 30px;
        ">

            <div style="
                max-width: 600px;
                margin: auto;
                background: white;
                border-radius: 16px;
                overflow: hidden;
                border: 1px solid #e2e8f0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            ">

                <div style="
                    background: ${color};
                    color: white;
                    padding: 20px;
                    text-align: center;
                    font-size: 22px;
                    font-weight: bold;
                ">
                    ⏰ ${badge}
                </div>

                <div style="padding: 30px;">

                    <h2 style="margin-top:0;">
                        Hello ${faculty.name},
                    </h2>

                    <p style="
                        color:#475569;
                        line-height:1.7;
                    ">
                        Reminder from <b>${sender.name}</b>
                    </p>

                    <div style="
                        background:#f8fafc;
                        border-radius:12px;
                        padding:20px;
                        margin-top:20px;
                    ">

                        <p>
                            <b>Title:</b> ${task.title}
                        </p>

                        <p>
                            <b>Description:</b> ${task.description}
                        </p>

                        <p>
                            <b>Priority:</b> ${task.priority}
                        </p>

                        <p>
                            <b>Due Date:</b>
                            ${new Date(task.due_date).toLocaleString()}
                        </p>

                    </div>

                    <p style="
                        margin-top:25px;
                        color:#334155;
                        line-height:1.6;
                    ">
                        Please complete the task before the deadline.
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
        <div style="
            font-family: Arial, sans-serif;
            background: #fff1f2;
            padding: 30px;
        ">

            <div style="
                max-width: 600px;
                margin: auto;
                background: white;
                border-radius: 16px;
                overflow: hidden;
                border: 1px solid #fecdd3;
                box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            ">

                <div style="
                    background: #ef4444;
                    color: white;
                    padding: 22px;
                    text-align: center;
                    font-size: 24px;
                    font-weight: bold;
                ">
                    ⚠ TASK OVERDUE
                </div>

                <div style="padding: 30px;">

                    <h2 style="margin-top:0;">
                        Hello ${faculty.name},
                    </h2>

                    <p style="
                        color:#475569;
                        line-height:1.7;
                    ">
                        The following task assigned by
                        <b>${sender.name}</b> is overdue.
                    </p>

                    <div style="
                        background:#fff5f5;
                        border-radius:12px;
                        padding:20px;
                        margin-top:20px;
                        border-left:5px solid #ef4444;
                    ">

                        <p>
                            <b>Title:</b> ${task.title}
                        </p>

                        <p>
                            <b>Priority:</b> ${task.priority}
                        </p>

                        <p>
                            <b>Due Date:</b>
                            ${new Date(task.due_date).toLocaleString()}
                        </p>

                    </div>

                    <p style="
                        margin-top:25px;
                        color:#991b1b;
                        font-weight:600;
                        line-height:1.6;
                    ">
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
