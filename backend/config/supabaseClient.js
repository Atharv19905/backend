const { createClient } = require("@supabase/supabase-js")


const supabase = createClient(process.env.SUPABASE_URL, process.env.CRON_SECRET)
module.exports = supabase