import { Db, MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const mongoUriDirect = process.env.MONGODB_URI_DIRECT;
const dbName = process.env.MONGODB_DB ?? "small-farmland";

function getMongoUri() {
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  return mongoUri;
}

declare global {
  // Reuse a single MongoClient in development to avoid creating many connections on HMR.
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoClientPromiseDirect: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
let clientPromiseDirect: Promise<MongoClient> | undefined;

function isSrvDnsError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /querySrv\s+ECONNREFUSED|querySrv\s+ENOTFOUND|querySrv\s+ETIMEOUT/i.test(
    error.message,
  );
}

function connectWithUri(uri: string, useDirect: boolean) {
  const developmentSlot = useDirect
    ? "_mongoClientPromiseDirect"
    : "_mongoClientPromise";
  const productionSlot = useDirect ? "clientPromiseDirect" : "clientPromise";

  if (process.env.NODE_ENV === "development") {
    if (!global[developmentSlot]) {
      global[developmentSlot] = new MongoClient(uri).connect();
    }

    return global[developmentSlot] as Promise<MongoClient>;
  }

  if (productionSlot === "clientPromise" && !clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }

  if (productionSlot === "clientPromiseDirect" && !clientPromiseDirect) {
    clientPromiseDirect = new MongoClient(uri).connect();
  }

  return productionSlot === "clientPromise"
    ? (clientPromise as Promise<MongoClient>)
    : (clientPromiseDirect as Promise<MongoClient>);
}

async function getClientPromise() {
  const uri = getMongoUri();

  try {
    return await connectWithUri(uri, false);
  } catch (error) {
    if (!mongoUriDirect || !isSrvDnsError(error)) {
      throw error;
    }

    return connectWithUri(mongoUriDirect, true);
  }
}

export async function getDb(): Promise<Db> {
  const mongoClient = await getClientPromise();
  return mongoClient.db(dbName);
}
