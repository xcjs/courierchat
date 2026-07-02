// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    '@nuxtjs/color-mode'
  ],

  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'courierchat-color-mode'
  },

  nitro: {
    experimental: {
      websocket: true
    }
  },

  runtimeConfig: {
    stun: {
      enabled: true,
      port: 3478,
      host: '0.0.0.0'
    },
    public: {
      stunEnabled: true,
      stunHost: '',
      stunPort: 3478
    }
  },

  imports: {
    dirs: [
      'composables',
      'features/*/composables'
    ]
  },

  typescript: {
    strict: true,
    typeCheck: true
  },

  css: [
    '~/assets/css/base.css',
    '~/assets/css/animations.css'
  ],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'CourierChat',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#23b28f' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/courierchat.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.json' }
      ]
    }
  }
});
