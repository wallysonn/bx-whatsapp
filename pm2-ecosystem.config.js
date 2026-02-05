//pm2 process
module.exports = {
  apps: [
    {
      name: 'bx-whatsapp',
      script: 'app.js', // ou o entrypoint real
      interpreter: 'node',
      node_args: '--enable-source-maps',
      env_production: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      }
    }
  ]
}
