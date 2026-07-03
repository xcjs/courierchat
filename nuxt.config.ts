// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  devServer: {
    https: true
  },

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

  vite: {
    plugins: [
      {
        name: 'suppress-json-sourcemap-warning',
        enforce: 'post',
        configResolved (config) {
          const logger = config.logger;
          const original = logger.warn.bind(logger);
          logger.warn = (msg, ...rest) => {
            // Vite emits a "Could not read source map for ... lucide-icons.json"
            // warning in dev because the flat single-line JSON asset imported by
            // IconPicker.vue has no associated source map. The warning is cosmetic
            // (the import itself works fine), so suppress only this message and
            // leave all other Vite warnings intact.
            if (typeof msg === 'string' && msg.includes('lucide-icons.json')) { return; }
            original(msg, ...rest);
          };
        }
      }
    ]
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
