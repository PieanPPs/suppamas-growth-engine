-- ============================================================
-- Public-read policies for the parent Happiness Report
-- (shareable web link — /report/[studentId] — has no auth)
-- Run AFTER supabase-schema.sql
--
-- NOTE: This exposes assessment + homework rows to anyone with
-- the link. Acceptable for a pilot where the student UUID acts as
-- an unguessable key. For production, replace with a per-student
-- signed token or a server-side route using the service role key.
-- ============================================================

CREATE POLICY "Public read assessments for report"
  ON student_assessments FOR SELECT USING (true);

CREATE POLICY "Public read homework for report"
  ON homework_submissions FOR SELECT USING (true);
