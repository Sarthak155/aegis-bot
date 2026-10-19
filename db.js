import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[AEGIS] Missing Supabase env vars. Check your .env file.');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getWarningCount(guildId, targetId) {
  const { data, error } = await supabase
    .from('moderation_logs')
    .select('id')
    .eq('guild_id', guildId)
    .eq('target_id', targetId)
    .eq('action', 'warn');
  if (error) {
    console.error('[AEGIS] Failed to count warnings:', error.message);
    return 0;
  }
  return data ? data.length : 0;
}

export async function getNextCaseNumber(guildId) {
  const { data, error } = await supabase
    .from('moderation_logs')
    .select('case_number')
    .eq('guild_id', guildId)
    .order('case_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[AEGIS] Failed to get next case number:', error.message);
    return 1;
  }
  return data ? data.case_number + 1 : 1;
}

export async function logModeration(entry) {
  const caseNumber = await getNextCaseNumber(entry.guild_id);
  const { data, error } = await supabase
    .from('moderation_logs')
    .insert({ ...entry, case_number: caseNumber })
    .select()
    .single();
  if (error) {
    console.error('[AEGIS] Failed to log moderation action:', error.message);
    return null;
  }
  return data;
}
