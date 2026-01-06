const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  pwa: {
    name: 'Family Sync',
    themeColor: '#6366f1',
    msTileColor: '#6366f1',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent',
    
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
    },
    
    manifestOptions: {
      name: 'Family Sync App',
      short_name: 'Family Sync',
      description: 'Sincroniza listas de compras y calendarios con tu familia',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#6366f1',
      icons: [
        {
          src: './img/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: './img/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
  },

  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
