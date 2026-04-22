#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Postgres.");
  }

  const schemaPath = path.join(__dirname, "..", "db", "schema", "postgres.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const pool = new Pool({ connectionString, max: 5 });

  try {
    await pool.query(schemaSql);
    console.log(`[db:init:postgres] schema applied using ${connectionString}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[db:init:postgres] ${error.message}`);
  process.exit(1);
});
