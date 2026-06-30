import type { Config } from 'tailwindcss';

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        'background-primary': 'rgb(35, 178, 143)',
        'background-interactive': 'rgb(255, 138, 101)',
        'text-primary': 'rgb(255, 138, 101)',
        'text-content': 'rgb(51, 51, 51)',
        'text-content-inverted': 'rgb(255, 255, 255)',
        'text-error': 'rgb(165, 61, 61)'
      },
      boxShadow: {
        'courier-drop': '0px 4px 5px 0px rgba(0, 0, 0, 0.5)'
      },
      animation: {
        'nav-hover': 'navHover 250ms ease-out',
        slower: 'slower 1.5s ease-out',
        faster: 'faster 750ms ease-out'
      },
      keyframes: {
        navHover: {
          '0%': {
            'transform-origin': 'left center',
            transform: 'rotate3d(0, 0, 1, 90deg)',
            opacity: '0'
          },
          '100%': {
            'transform-origin': 'left center',
            transform: 'none',
            opacity: '1'
          }
        }
      }
    }
  }
};
