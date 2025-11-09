import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PayParent',
    short_name: 'PayParent',
    description: 'Child Support & Expense Tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#e0d9f7',
    theme_color: '#e0d9f7',
    icons: [
      {
        src: '/icons/logo-pwa.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
