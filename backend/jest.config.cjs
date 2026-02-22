module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/jest.env.js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/tests/e2e_offline_merge.test.js",
  ],
};
