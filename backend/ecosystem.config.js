module.exports = {
  apps: [{
    name: 'trenching-backend',
    script: '/root/trenching-extractor-fresh/backend/start_backend.sh',
    cwd: '/root/trenching-extractor-fresh/backend',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
