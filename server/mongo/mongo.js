import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import dns from "dns";
import dotenv from "dotenv";
dotenv.config();


dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
app.use(express.json());

const uri =process.env.MONGO_URI;

const client = new MongoClient(uri, {
  tls: true,
  family: 4,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

export let db;

export async function connectDB(){
 await client.connect();
 console.log("🟢 Mongo connected");

 db = client.db("todoApp");
}
