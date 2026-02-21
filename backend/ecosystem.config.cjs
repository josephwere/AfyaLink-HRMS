module.exports = {
  apps: [
    {
      name: "afyalink-backend",
      script: "server.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "900M",
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};

