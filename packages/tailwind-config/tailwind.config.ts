import type { Config } from 'tailwindcss';

const config = {
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',
        lg: '25px',
        xl: '40px',
      },
      boxShadow: {
        frosted: '0 8px 32px rgba(0, 0, 0, 0.1)',
        'frosted-lg': '0 20px 64px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        frosted: '24px',
      },
    },
  },
  plugins: [
    function ({ addComponents, theme }: any) {
      addComponents({
        '.bg-frostedglass': {
          borderRadius: theme('borderRadius.frosted'),
          borderWidth: '1px',
          borderColor: 'rgba(255, 255, 255, 0.28)',
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          backgroundImage: 'radial-gradient(60% 60% at 85% 85%, rgba(147, 51, 234, 0.08), rgba(147, 51, 234, 0) 60%)',
          boxShadow: theme('boxShadow.frosted'),
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        },
        '.dark .bg-frostedglass': {
          borderColor: 'rgba(255, 255, 255, 0.18)',
          backgroundColor: 'rgba(18, 18, 18, 0.55)',
          backgroundImage: 'radial-gradient(60% 60% at 85% 85%, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0) 60%)',
          boxShadow: theme('boxShadow.frosted'),
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        },
        '.bg-frostedglass-lg': {
          borderRadius: theme('borderRadius.frosted'),
          borderWidth: '1px',
          borderColor: 'rgba(255, 255, 255, 0.28)',
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          backgroundImage: 'radial-gradient(60% 60% at 85% 85%, rgba(147, 51, 234, 0.08), rgba(147, 51, 234, 0) 60%)',
          boxShadow: theme('boxShadow.frosted-lg'),
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        },
        '.dark .bg-frostedglass-lg': {
          borderColor: 'rgba(255, 255, 255, 0.18)',
          backgroundColor: 'rgba(18, 18, 18, 0.55)',
          backgroundImage: 'radial-gradient(60% 60% at 85% 85%, rgba(147, 51, 234, 0.22), rgba(147, 51, 234, 0) 60%)',
          boxShadow: theme('boxShadow.frosted-lg'),
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        },
        '.frostedwhite': {
          borderRadius: theme('borderRadius.md'),
          borderWidth: '1px',
          borderColor: 'rgba(255, 255, 255, 0.20)',
          backgroundColor: 'rgba(255, 255, 255, 0.20)',
          boxShadow: theme('boxShadow.frosted'),
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        },
        '.dark .frostedwhite': {
          borderColor: 'rgba(255, 255, 255, 0.14)',
          backgroundColor: 'rgba(30, 30, 30, 0.45)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        },
        '.bg-frostedwhite': {
          backgroundColor: 'rgba(255, 255, 255, 0.20)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        },
        '.dark .bg-frostedwhite': {
          backgroundColor: 'rgba(12, 12, 12, 0.32)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
          borderColor: 'rgba(255, 255, 255, 0.14)',
        },
      });
    },
  ],
} as Omit<Config, 'content'>;

export default config;
