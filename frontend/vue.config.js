const { defineConfig } = require('@vue/cli-service');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = defineConfig({
  transpileDependencies: true,
  
  // Configurar webpack para copiar service-worker.js manualmente
  configureWebpack: {
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public/service-worker.js',
            to: 'service-worker.js',
          },
        ],
      }),
    ],
  },
  
  pwa: {
    name: 'Family Sync',
    themeColor: '#6366f1',
    msTileColor: '#6366f1',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent',
    
    // Deshabilitar completamente Workbox
    workboxPluginMode: 'GenerateSW',
    workboxOptions: {
      // No generar service worker
      exclude: [/.*/],
      skipWaiting: false,
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
