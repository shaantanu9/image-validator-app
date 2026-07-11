module.exports = {
  apps: [
    {
      name: 'image_validator-server',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      time: true,
    },
  ],
};
