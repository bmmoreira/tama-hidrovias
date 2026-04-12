'use strict';

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DEFAULT_USERS = [
  {
    kind: 'analyst',
    emailEnv: 'DEV_BOOTSTRAP_ANALYST_EMAIL',
    passwordEnv: 'DEV_BOOTSTRAP_ANALYST_PASSWORD',
    usernameEnv: 'DEV_BOOTSTRAP_ANALYST_USERNAME',
    roleEnv: 'DEV_BOOTSTRAP_ANALYST_ROLE',
    defaults: {
      email: 'dev.analyst@local.test',
      password: 'devpass123',
      username: 'dev-analyst',
      role: 'analyst',
    },
  },
  {
    kind: 'viewer',
    emailEnv: 'DEV_BOOTSTRAP_VIEWER_EMAIL',
    passwordEnv: 'DEV_BOOTSTRAP_VIEWER_PASSWORD',
    usernameEnv: 'DEV_BOOTSTRAP_VIEWER_USERNAME',
    roleEnv: 'DEV_BOOTSTRAP_VIEWER_ROLE',
    defaults: {
      email: 'dev.viewer@local.test',
      password: 'devviewer123',
      username: 'dev-viewer',
      role: 'viewer',
    },
  },
];

function getEnv(name, fallback) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getDatabaseConfig() {
  return {
    host: getEnv('DATABASE_HOST', getEnv('POSTGRES_HOST', 'localhost')),
    port: Number(getEnv('DATABASE_PORT', '5432')),
    database: getEnv('DATABASE_NAME', getEnv('POSTGRES_DB', 'tama_hidrovias')),
    user: getEnv('DATABASE_USERNAME', getEnv('POSTGRES_USER', 'strapi')),
    password: getEnv('DATABASE_PASSWORD', getEnv('POSTGRES_PASSWORD', 'strapi_password')),
    ssl: getEnv('DATABASE_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : false,
  };
}

function getBootstrapUsers() {
  return DEFAULT_USERS.map((entry) => ({
    kind: entry.kind,
    email: getEnv(entry.emailEnv, entry.defaults.email).toLowerCase(),
    password: getEnv(entry.passwordEnv, entry.defaults.password),
    username: getEnv(entry.usernameEnv, entry.defaults.username),
    roleType: getEnv(entry.roleEnv, entry.defaults.role),
  }));
}

async function getRoleId(client, roleType) {
  const roleResult = await client.query(
    'SELECT id FROM up_roles WHERE type = $1 LIMIT 1',
    [roleType],
  );

  if (!roleResult.rows[0]) {
    throw new Error(
      `Role "${roleType}" was not found. Start Strapi once so role bootstrap can create it.`,
    );
  }

  return roleResult.rows[0].id;
}

async function upsertUser(client, user) {
  const roleId = await getRoleId(client, user.roleType);
  const passwordHash = await bcrypt.hash(user.password, 10);

  const userResult = await client.query(
    'SELECT id FROM up_users WHERE lower(email) = lower($1) LIMIT 1',
    [user.email],
  );

  let userId;
  let action;

  if (userResult.rows[0]) {
    userId = userResult.rows[0].id;
    action = 'updated';

    await client.query(
      `UPDATE up_users
       SET username = $1,
           email = $2,
           password = $3,
           confirmed = true,
           blocked = false,
           updated_at = NOW()
       WHERE id = $4`,
      [user.username, user.email, passwordHash, userId],
    );
  } else {
    action = 'created';

    const insertResult = await client.query(
      `INSERT INTO up_users (
         username,
         email,
         provider,
         password,
         confirmed,
         blocked,
         created_at,
         updated_at
       )
       VALUES ($1, $2, 'local', $3, true, false, NOW(), NOW())
       RETURNING id`,
      [user.username, user.email, passwordHash],
    );

    userId = insertResult.rows[0].id;
  }

  await client.query('DELETE FROM up_users_role_links WHERE user_id = $1', [userId]);
  await client.query(
    `INSERT INTO up_users_role_links (user_id, role_id, user_order)
     VALUES ($1, $2, 1)`,
    [userId, roleId],
  );

  return { action, ...user };
}

async function main() {
  const client = new Client(getDatabaseConfig());
  const users = getBootstrapUsers();

  await client.connect();

  try {
    await client.query('BEGIN');
    const results = [];

    for (const user of users) {
      results.push(await upsertUser(client, user));
    }

    await client.query('COMMIT');

    for (const result of results) {
      console.log(`Dev ${result.kind} user ${result.action}.`);
      console.log(`email=${result.email}`);
      console.log(`password=${result.password}`);
      console.log(`role=${result.roleType}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});