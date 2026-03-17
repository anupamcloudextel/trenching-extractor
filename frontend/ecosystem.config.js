module.exports = {
  apps: [{
    name: 'trenching-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/root/trenching-extractor-fresh/frontend',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
