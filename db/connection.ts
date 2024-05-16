import { MongoClient, ServerApiVersion } from "mongodb";

const mongoDbUrl = process.env.MONGODB_URI || "mongodb://localhost:27017";
console.log("mongoDbUrl", mongoDbUrl);
const client = new MongoClient(mongoDbUrl);
console.log("Connecting to MongoDB");
const mongoDbName = process.env.MONGODB_NAME;
try {
  await client.connect();

  console.log("Connected to MongoDB");
  await client.db(mongoDbName).command({ ping: 1 });
  console.log("Ping command executed");
} catch (err) {
  console.log(err);
}

let db = client.db(mongoDbName);
export default db;
