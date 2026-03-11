module.exports = {
  apps: [
    {
      name: "openclaw-web",
      cwd: "__OPENCLAW_APP_DIR__",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "openclaw-publish-queue-worker",
      cwd: "__OPENCLAW_APP_DIR__",
      script: "npm",
      args: "run publish-queue:worker",
      env: {
        NODE_ENV: "production",
        OPENCLAW_APP_URL: "__OPENCLAW_APP_URL__",
        OPENCLAW_QUEUE_INTERVAL_MS: "3000",
        OPENCLAW_QUEUE_SECRET: "__OPENCLAW_QUEUE_SECRET__",
      },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
