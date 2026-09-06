const themeMap = {
  '--bg': 'bg_color',
  '--surface': 'secondary_bg_color',
  '--ink': 'text_color',
  '--muted': 'hint_color',
  '--line': 'section_separator_color',
  '--accent': 'button_color',
  '--accent-soft': 'secondary_bg_color',
  '--green': 'link_color',
  '--input-bg': 'secondary_bg_color',
  '--accent-contrast': 'button_text_color',
  '--surface-contrast': 'bg_color',
  '--note-text': 'hint_color',
  '--pill-text': 'button_color',
  '--empty-line': 'section_separator_color',
  '--placeholder': 'hint_color'
};

export function initTelegramTheme() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  const applyTheme = () => {
    const root = document.documentElement;
    const params = webApp.themeParams || {};
    Object.entries(themeMap).forEach(([variable, telegramKey]) => {
      if (params[telegramKey]) root.style.setProperty(variable, params[telegramKey]);
    });
    if (webApp.colorScheme) root.style.colorScheme = webApp.colorScheme;
    const themeColor = params.bg_color || params.header_bg_color;
    if (themeColor) document.querySelector('meta[name="theme-color"]').setAttribute('content', themeColor);
  };

  webApp.ready();
  webApp.expand();
  applyTheme();
  webApp.onEvent('themeChanged', applyTheme);
}
