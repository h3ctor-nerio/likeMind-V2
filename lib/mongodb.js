import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "likeminds";

// Reuse one client across hot reloads in development.
const cache = globalThis._likemindsMongo || (globalThis._likemindsMongo = { promise: null, indexed: false });

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and add your connection string.");
  }
  if (!cache.promise) cache.promise = new MongoClient(uri).connect();
  let client;
  try {
    client = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  const db = client.db(dbName);
  if (!cache.indexed) {
    cache.indexed = true;
    ensureIndexes(db).catch((err) => {
      cache.indexed = false;
      console.error("Index creation failed:", err);
    });
  }
  return db;
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ displayName: 1 }, { unique: true }),
    db.collection("thoughts").createIndex({ location: "2dsphere" }),
    db.collection("thoughts").createIndex({ status: 1, createdAt: -1 }),
    db.collection("thoughts").createIndex({ tags: 1 }),
    db.collection("replies").createIndex({ thoughtId: 1, createdAt: 1 }),
    db.collection("connections").createIndex({ pairKey: 1 }, { unique: true }),
    db.collection("messages").createIndex({ connectionId: 1, createdAt: 1 }),
    db.collection("messages").createIndex({ groupId: 1, createdAt: 1 }),
    db.collection("events").createIndex({ startsAt: 1 }),
    db.collection("events").createIndex({ location: "2dsphere" }),
    db.collection("reports").createIndex({ status: 1, createdAt: -1 }),
    db.collection("ui_translations").createIndex({ lang: 1, source: 1 }, { unique: true }),
  ]);
}
