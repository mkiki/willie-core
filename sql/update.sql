--------------------------------------------------------------------------------
-- Core - Update database structure
--
-- Run with database user
-- Example: psql -U willie -d willie  < sql/update.sql
--------------------------------------------------------------------------------

DO $$
DECLARE
  ver varchar;
BEGIN
  BEGIN
    EXECUTE 'SELECT value FROM core_options WHERE name = ''core.databaseVersion''' INTO ver;
  EXCEPTION
    WHEN OTHERS
    THEN
      ver = '0.0';
  END;



  LOOP

    RAISE NOTICE 'Database version is %', ver;

  --------------------------------------------------------------------------------
  -- Version 1, options
  --------------------------------------------------------------------------------
    IF ver IS NULL or ver = '0.0' THEN
      CREATE TABLE core_options (
        name            varchar(64) primary key,            -- name of the option
        value           varchar(4096),                      -- value as a serialized string
        builtin         boolean default false
    );
    ver = '0.1';
    ELSIF ver = '0.1' THEN
      INSERT INTO core_options (name, value, builtin) VALUES ('core.databaseVersion', '0.1', true);
      ver = '0.2';
    ELSIF ver = '0.2' THEN
      INSERT INTO core_options (name, value, builtin) VALUES ('core.databaseId', uuid_generate_v4(), true);
      ver = '0.3';
    ELSIF ver = '0.3' THEN
      CREATE UNIQUE INDEX core_o_name ON core_options (name);
      ver = '1.0';

  --------------------------------------------------------------------------------
  -- Version 2, create users
  --------------------------------------------------------------------------------
    ELSIF ver = '1.0' THEN
    CREATE TABLE core_users (
        id              uuid primary key default uuid_generate_v4(),
        login           varchar(64),                        -- unique login
        hashedPassword  varchar(256),                     -- hashed password
        salt      varchar(256),           -- Store salt and hased password: hashedPassword = sha256(salt + password)
        name            varchar(256),                       -- user-friendly name
        canLogin        boolean default false,              -- this user can log-in
        isAdmin     boolean NOT NULL DEFAULT false,
        avatar      varchar(256),
        email       varchar(256),
        builtin     boolean default false
    );
    ver = '1.1';
  ELSIF ver = '1.1' THEN
    CREATE UNIQUE INDEX core_u_name ON core_users (name);
    ver = '1.2';
  ELSIF ver = '1.2' THEN
    CREATE UNIQUE INDEX core_u_login ON core_users (login); 
    ver = '2.0';
  

  --------------------------------------------------------------------------------
  -- Version 3, create sessions
  --------------------------------------------------------------------------------
    ELSIF ver = '2.0' THEN
    CREATE TABLE core_sessions (
        id              uuid primary key default uuid_generate_v4(),
        login           varchar(64) REFERENCES core_users(login),       -- user login
        accessToken     varchar(1024),                                  -- valid access token
        validUntil      timestamp with time zone                        -- date after which the access token is not valid anymore
    );
    ver = '2.1';
    ELSIF ver = '2.1' THEN
      CREATE UNIQUE INDEX core_s_accessToken ON core_sessions (accessToken);
    ver = '2.2';
    ELSIF ver = '2.2' THEN
      CREATE INDEX core_s_login ON core_sessions (login);
    ver = '3.0';


  --------------------------------------------------------------------------------
  -- Version 4, create jobs
  --------------------------------------------------------------------------------
    ELSIF ver = '3.0' THEN
    CREATE TABLE core_jobs (
        id              uuid primary key default uuid_generate_v4(),
        name            varchar(256),
        type            varchar(64),
        status          varchar(64),
        context         jsonb,
        progress        jsonb,
        started         timestamp with time zone,
        updated         timestamp with time zone
    );
    ver = '3.1';
    ELSIF ver = '3.1' THEN
      CREATE INDEX core_jobs_name ON core_jobs (name);
      ver = '3.2';
    ELSIF ver = '3.2' THEN
      CREATE INDEX core_jobs_started ON core_jobs (started);
      ver = '3.3';
    ELSIF ver = '3.3' THEN
      CREATE INDEX core_jobs_updated ON core_jobs (updated);
      ver = '4.0';


    ELSE
      EXIT;
    END IF;


  END LOOP;

  UPDATE core_options SET value = ver WHERE name = 'core.databaseVersion';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '% - %', SQLSTATE, SQLERRM;
  UPDATE core_options SET value = ver WHERE name = 'core.databaseVersion';
END $$;

