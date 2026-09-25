/**
 * Theme detection script that runs synchronously before React hydration
 * Always defaults to light theme unless user has previously selected dark
 */
export const getThemeScript = () => {
  return `
    (function() {
      try {
        // Only use dark theme if explicitly saved by user
        const savedTheme = localStorage.getItem('theme');
        const isDark = savedTheme === 'dark';

        // Apply theme immediately before React renders
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        // Fail silently - defaults to light
        console.log('Theme initialization failed:', e);
      }
    })();
  `;
};
