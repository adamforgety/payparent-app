import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PayParent',
    short_name: 'PayParent',
    description: 'Child Support & Expense Tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#8f66e0',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      }
    ],
  };
}
