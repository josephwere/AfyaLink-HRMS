import { describe, expect, it } from "@jest/globals";
import { shouldAutoFallbackToMemoryMongo, shouldUseMemoryMongo } from "../config/db.js";

describe("shouldUseMemoryMongo", () => {
  it("enables memory Mongo fallback for tests when the default local URI is in use", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousMongoUri = process.env.MONGO_URI;
    const previousUseMemoryMongo = process.env.USE_MEMORY_MONGO;
    process.env.NODE_ENV = "test";
    process.env.MONGO_URI = "mongodb://127.0.0.1:27017/afyalink";
    delete process.env.USE_MEMORY_MONGO;

    try {
      expect(shouldUseMemoryMongo()).toBe(true);
    } finally {
      if (previousEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnv;
      if (previousMongoUri === undefined) delete process.env.MONGO_URI;
      else process.env.MONGO_URI = previousMongoUri;
      if (previousUseMemoryMongo === undefined) delete process.env.USE_MEMORY_MONGO;
      else process.env.USE_MEMORY_MONGO = previousUseMemoryMongo;
    }
  });

  it("disables memory Mongo fallback in production", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousMongoUri = process.env.MONGO_URI;
    const previousUseMemoryMongo = process.env.USE_MEMORY_MONGO;
    process.env.NODE_ENV = "production";
    process.env.MONGO_URI = "mongodb://127.0.0.1:27017/afyalink";
    delete process.env.USE_MEMORY_MONGO;

    try {
      expect(shouldUseMemoryMongo()).toBe(false);
    } finally {
      if (previousEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnv;
      if (previousMongoUri === undefined) delete process.env.MONGO_URI;
      else process.env.MONGO_URI = previousMongoUri;
      if (previousUseMemoryMongo === undefined) delete process.env.USE_MEMORY_MONGO;
      else process.env.USE_MEMORY_MONGO = previousUseMemoryMongo;
    }
  });

  it("allows an explicit memory Mongo override outside production-like database URLs", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousMongoUri = process.env.MONGO_URI;
    const previousUseMemoryMongo = process.env.USE_MEMORY_MONGO;
    process.env.NODE_ENV = "development";
    process.env.MONGO_URI = "mongodb://127.0.0.1:27017/afyalink";
    process.env.USE_MEMORY_MONGO = "true";

    try {
      expect(shouldUseMemoryMongo()).toBe(true);
    } finally {
      if (previousEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnv;
      if (previousMongoUri === undefined) delete process.env.MONGO_URI;
      else process.env.MONGO_URI = previousMongoUri;
      if (previousUseMemoryMongo === undefined) delete process.env.USE_MEMORY_MONGO;
      else process.env.USE_MEMORY_MONGO = previousUseMemoryMongo;
    }
  });

  it("auto-falls back to memory Mongo for local development when the default local URI is in use", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousMongoUri = process.env.MONGO_URI;
    const previousUseMemoryMongo = process.env.USE_MEMORY_MONGO;
    process.env.NODE_ENV = "development";
    process.env.MONGO_URI = "mongodb://127.0.0.1:27017/afyalink";
    delete process.env.USE_MEMORY_MONGO;

    try {
      expect(shouldAutoFallbackToMemoryMongo()).toBe(true);
    } finally {
      if (previousEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnv;
      if (previousMongoUri === undefined) delete process.env.MONGO_URI;
      else process.env.MONGO_URI = previousMongoUri;
      if (previousUseMemoryMongo === undefined) delete process.env.USE_MEMORY_MONGO;
      else process.env.USE_MEMORY_MONGO = previousUseMemoryMongo;
    }
  });
});
