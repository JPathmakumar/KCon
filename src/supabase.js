import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yrlozbdslapwonydtyvu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybG96YmRzbGFwd29ueWR0eXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTYwMjUsImV4cCI6MjA4Mzg3MjAyNX0.rLGMUlEyAAYkV9lGnYGS_5RyLacM08ahvzGGeBb297Y';

export const supabase = createClient(supabaseUrl, supabaseKey);