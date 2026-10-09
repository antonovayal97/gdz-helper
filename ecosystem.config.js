// PM2 process file: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "gdz",
      script: "npm",
      args: "run start",
      // Путь на сервере; __dirname позволяет запускать файл из любой папки проекта.
      cwd: __dirname,
      // fork (не cluster): rate limiting в проекте in-memory — несколько инстансов
      // одновременно мультиплицировали бы лимиты и плодили бы конфликты seed/логов.
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "600M",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1", // публикация только через Nginx, не наружу
      },
    },
  ],
};
