--------------------------------------------------------------------------------
-- willie-core - Builtin data for the willie-core module
--------------------------------------------------------------------------------

-- Create or update the 'nobody' user who represents an anonymous, non logged user
INSERT INTO core_users (id, login, name, canLogin, isAdmin, avatar, email, builtin)
  VALUES ('ab8f87ea-ad93-4365-bdf5-045fee58ee3b', 'nobody', 'Nobody', false, false, '/core/images/anonymous.jpg', NULL, true)
  ON CONFLICT(id) DO NOTHING;
