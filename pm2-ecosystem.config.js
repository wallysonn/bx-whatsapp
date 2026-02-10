//pm2 process
module.exports = {
  apps: [
    {
      name: 'bx-whatsapp',
      script: './app.js', // ou o caminho correto do seu entry point
      interpreter: 'node',
      env_production: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      }
    }
  ]
}
