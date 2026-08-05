/**
 * config/supabase.ts throws at import time when these are missing, so they must
 * be set before any module under src/ is required. Values are dummies — every
 * test mocks the Supabase clients rather than talking to a real project.
 */
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
// Keep cron jobs from starting during tests.
process.env.RUN_SCHEDULER = 'false';
