import express from "express";
import request from "supertest";

import { cacheJsonResponse } from "../middleware/responseCache.js";

describe("response cache middleware", () => {
  test("serves a cached JSON payload on repeated reads", async () => {
    const app = express();
    const cacheKey = `response-cache-test:${Date.now()}:hit`;
    let hits = 0;

    app.get(
      "/cached",
      cacheJsonResponse({
        ttlSeconds: 60,
        key: () => cacheKey,
      }),
      (_req, res) => {
        hits += 1;
        res.json({ hits });
      }
    );

    const first = await request(app).get("/cached");
    const second = await request(app).get("/cached");

    expect(first.status).toBe(200);
    expect(first.headers["x-afya-response-cache"]).toBe("MISS");
    expect(first.body.hits).toBe(1);

    expect(second.status).toBe(200);
    expect(second.headers["x-afya-response-cache"]).toBe("HIT");
    expect(second.body.hits).toBe(1);
    expect(hits).toBe(1);
  });

  test("bypasses the cache when the client asks for a refresh", async () => {
    const app = express();
    const cacheKey = `response-cache-test:${Date.now()}:bypass`;
    let hits = 0;

    app.get(
      "/cached",
      cacheJsonResponse({
        ttlSeconds: 60,
        key: () => cacheKey,
      }),
      (_req, res) => {
        hits += 1;
        res.json({ hits });
      }
    );

    const first = await request(app).get("/cached");
    const second = await request(app).get("/cached").set("Cache-Control", "no-cache");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers["x-afya-response-cache"]).toBe("BYPASS");
    expect(second.body.hits).toBe(2);
    expect(hits).toBe(2);
  });
});
