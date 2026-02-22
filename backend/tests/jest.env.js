process.env.NODE_ENV = "test";
process.env.DISABLE_BACKGROUND_JOBS = "1";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_jwt_secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
