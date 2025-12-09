// database.js
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

const envConfig = dotenv.config({ path: path.resolve(__dirname, 'variables.env') });
const PG_URL = process.env.DATABASE_URL;
const SQLITE_PATH = './school.db';

// --- SQL Schema Definitions ---
const SCHEMAS = {
  postgres: [
    `CREATE TABLE IF NOT EXISTS settings (id SERIAL PRIMARY KEY, setting_name TEXT UNIQUE NOT NULL, setting_value TEXT)`,
    `CREATE TABLE IF NOT EXISTS carousel_images (id SERIAL PRIMARY KEY, image_url TEXT NOT NULL, link_url TEXT, alt_text TEXT, file_name TEXT, display_order INTEGER)`,
    `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS services (id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT, image_url TEXT, icon_class TEXT)`,
    `CREATE TABLE IF NOT EXISTS testimonials (id SERIAL PRIMARY KEY, name TEXT NOT NULL, role TEXT, message TEXT NOT NULL)`
  ],
  sqlite: [
    `CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, setting_name TEXT UNIQUE NOT NULL, setting_value TEXT)`,
    `CREATE TABLE IF NOT EXISTS carousel_images (id INTEGER PRIMARY KEY AUTOINCREMENT, image_url TEXT NOT NULL, link_url TEXT, alt_text TEXT, file_name TEXT, display_order INTEGER)`,
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, image_url TEXT, icon_class TEXT)`,
    `CREATE TABLE IF NOT EXISTS testimonials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT, message TEXT NOT NULL)`
  ]
};

const dbManager = {
  mode: null, pgPool: null, sqliteDb: null,

  async initialize() {
    if (PG_URL) {
      try {
        this.pgPool = new Pool({ connectionString: PG_URL, ssl: { require: true, rejectUnauthorized: false } });
        await this.pgPool.query('SELECT NOW()');
        this.mode = 'postgres';
        console.log('✅ Connected to PostgreSQL.');
      } catch (err) { console.warn('⚠️ Postgres failed. Using SQLite.'); }
    }
    if (!this.mode) {
      this.mode = 'sqlite';
      this.sqliteDb = new sqlite3.Database(SQLITE_PATH);
      console.log('✅ Connected to SQLite.');
    }
    await this.syncSchema();
    await this.runMigrations(); // <--- FIXES YOUR ERROR
  },

  async syncSchema() {
    for (const query of SCHEMAS[this.mode]) await this.run(query);
  },

  async runMigrations() {
    console.log("Checking DB structure...");
    try {
      if (this.mode === 'postgres') {
        await this.run(`ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS role TEXT`);
        await this.run(`ALTER TABLE services ADD COLUMN IF NOT EXISTS icon_class TEXT`);
      } else {
        try { await this.run(`ALTER TABLE testimonials ADD COLUMN role TEXT`); } catch(e) {}
        try { await this.run(`ALTER TABLE services ADD COLUMN icon_class TEXT`); } catch(e) {}
      }
    } catch (err) { console.error("Migration check:", err.message); }
  },

  _prepareQuery(sql, params = []) {
    if (this.mode === 'sqlite') return { sql, params };
    let paramIndex = 1;
    return { sql: sql.replace(/\?/g, () => `$${paramIndex++}`), params };
  },

  async run(sql, params = []) {
    const { sql: pSql, params: pParams } = this._prepareQuery(sql, params);
    if (this.mode === 'postgres') {
      let query = pSql;
      if (query.trim().toUpperCase().startsWith('INSERT') && !query.toUpperCase().includes('RETURNING')) query += ' RETURNING id';
      const result = await this.pgPool.query(query, pParams);
      return { changes: result.rowCount, lastID: result.rows[0]?.id };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(pSql, pParams, function (err) { if (err) return reject(err); resolve({ changes: this.changes, lastID: this.lastID }); });
      });
    }
  },

  async get(sql, params = []) {
    const { sql: pSql, params: pParams } = this._prepareQuery(sql, params);
    if (this.mode === 'postgres') { const res = await this.pgPool.query(pSql, pParams); return res.rows[0]; }
    return new Promise((resolve, reject) => { this.sqliteDb.get(pSql, pParams, (err, row) => err ? reject(err) : resolve(row)); });
  },

  async all(sql, params = []) {
    const { sql: pSql, params: pParams } = this._prepareQuery(sql, params);
    if (this.mode === 'postgres') { const res = await this.pgPool.query(pSql, pParams); return res.rows; }
    return new Promise((resolve, reject) => { this.sqliteDb.all(pSql, pParams, (err, rows) => err ? reject(err) : resolve(rows)); });
  },
  
  async close() { if(this.pgPool) await this.pgPool.end(); if(this.sqliteDb) this.sqliteDb.close(); }
};

module.exports = dbManager;