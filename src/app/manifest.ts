import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PayParent',
    short_name: 'PayParent',
    description: 'Child Support & Expense Tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#e9e6f9',
    theme_color: '#8f80e0',
    icons: [
      {
        src: '/icons/logo-pwa.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
