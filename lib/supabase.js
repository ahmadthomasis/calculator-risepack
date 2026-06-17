import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ycwacahngbletmqafwac.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljd2FjYWhuZ2JsZXRtcWFmd2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTg5MzMsImV4cCI6MjA5NzI3NDkzM30.DIPBtZHZz6zQsqUn8U0c0cAssa6NPLoUOeNwQJZFQac'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
