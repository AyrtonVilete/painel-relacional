-- ============================================================================
-- 0004_fix_layout_preferences_policies.sql
-- Fixes a copy-paste bug from 0003: the "update" policy on
-- layout_preferences was accidentally created as an INSERT policy, and the
-- DELETE policy was missing entirely.
-- ============================================================================

drop policy "users can update own layout preferences" on layout_preferences;

create policy "users can update own layout preferences"
  on layout_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete own layout preferences"
  on layout_preferences for delete
  using (user_id = auth.uid());
