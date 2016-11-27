--------------------------------------------------------------------------------
-- Core - Bootstrap data
--
-- Run with database user
-- Example: psql -U willie -d willie  < sql/update.sql
--------------------------------------------------------------------------------

INSERT INTO core_users (id, login, name, canLogin, isAdmin, avatar, email, builtin) VALUES ('ab8f87ea-ad93-4365-bdf5-045fee58ee3b', 'nobody', 'Nobody', false, false, NULL, NULL, true)
  ON CONFLICT(id) DO NOTHING;
