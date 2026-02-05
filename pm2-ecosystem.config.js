//pm2 process
module.exports = {
  apps: [
    {
      name: 'bx-whatsapp',
      script: 'yarn start',
      env_production: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      }
    }
  ]
}
