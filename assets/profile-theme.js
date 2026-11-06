/* Shared profile colors for public pages, icons, and the editor. */
(() => {
  'use strict';
  const valid = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  function colors(profile = {}) {
    const fallback = [profile.backgroundTint, profile.accent].find(valid) || '#aeb4bc';
    const left = valid(profile.backgroundLeft) ? profile.backgroundLeft : valid(profile.backgroundRight) ? profile.backgroundRight : fallback;
    const right = valid(profile.backgroundRight) ? profile.backgroundRight : valid(profile.backgroundLeft) ? profile.backgroundLeft : fallback;
    return { left, right };
  }
  const rgb = hex => hex.slice(1).match(/../g).map(part => parseInt(part, 16));
  const hex = channels => '#' + channels.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
  function luminance(channels) {
    const linear = channels.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }
  function readableAccent(color, light) {
    const channels = rgb(color);
    const background = luminance(rgb(light ? '#eceef0' : '#22272b'));
    for (let step = 0; step <= 100; step++) {
      const amount = step / 100;
      const candidate = channels.map(value => value + ((light ? 0 : 255) - value) * amount);
      const brightness = luminance(candidate);
      if ((Math.max(background, brightness) + .05) / (Math.min(background, brightness) + .05) >= 4.5) return hex(candidate);
    }
    return light ? '#000000' : '#ffffff';
  }
  const patterns = new Map();
  function pixelPattern(tint) {
    if (!tint) return '';
    if (!patterns.has(tint)) {
      const source = getComputedStyle(document.documentElement).getPropertyValue('--laylist-pixel-pattern');
      const encoded = source.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
      if (!encoded) return '';
      const channels = rgb(tint);
      const svg = atob(encoded).replace(/fill="#([0-9a-f]{2})\1\1"/gi, (_, gray) => {
        const shade = parseInt(gray, 16) / 0x4e;
        return 'fill="' + hex(channels.map(channel => Math.min(255, channel * shade))) + '"';
      });
      patterns.set(tint, `url(data:image/svg+xml;base64,${btoa(svg)})`);
    }
    return patterns.get(tint);
  }
  function imageUrl(profile, prefix = '') {
    if (!profile || !/^[a-z0-9-]+$/.test(profile.id || '') || profile.backgroundImage !== 'background.webp') return '';
    const version = /^[a-f0-9]{64}$/.test(profile.backgroundImageVersion || '') ? '?v=' + profile.backgroundImageVersion : '';
    return prefix + 'players/' + profile.id + '/background.webp' + version;
  }
  function applyImageMask(layer, source, inverted) {
    const mask = source ? `url(${JSON.stringify(source)})` : 'none';
    layer.style.maskImage = inverted && source ? `linear-gradient(white,white), ${mask}` : mask;
    layer.style.webkitMaskImage = layer.style.maskImage;
    layer.style.maskMode = inverted ? 'alpha, luminance' : 'luminance';
    layer.style.maskComposite = inverted ? 'exclude' : 'add';
    layer.style.webkitMaskComposite = inverted ? 'xor' : 'source-over';
  }
  function applyBackground(profile, options) {
    const source = Object.hasOwn(options, 'backgroundUrl') ? options.backgroundUrl : imageUrl(profile, options.prefix || '');
    let layer = document.getElementById('profile-background');
    if (!source) { layer?.remove(); return; }
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'profile-background';
      layer.setAttribute('aria-hidden', 'true');
      document.body.prepend(layer);
    }
    applyImageMask(layer, source, options.light ? profile?.backgroundInvertLight === true : profile?.backgroundInvertDark === true);
  }
  function apply(profile, theme, options = {}) {

    const light = theme === 'light';
    const { left, right } = colors(profile || {});
    document.body.classList.toggle('light-mode', light);
    const accent = readableAccent(right, light);
    const properties = {
      '--profile-left': left, '--profile-right': right,
      '--profile-background-opacity': (Number.isInteger(profile?.backgroundOpacity) && profile.backgroundOpacity >= 5 && profile.backgroundOpacity <= 50 ? profile.backgroundOpacity : 15) / 100,
      '--player-pixel-pattern': profile ? pixelPattern(left) : '',
      '--player-pixel-pattern-right': profile ? pixelPattern(right) : '',
      '--wordmark-tint': accent, '--accent': accent, '--accent-strong': accent,
      '--accent-button': accent, '--accent-button-hover': `color-mix(in srgb, ${accent} 82%, ${light ? 'black' : 'white'})`
    };
    for (const [key, value] of Object.entries(properties)) document.body.style.setProperty(key, value);
    applyBackground(profile, { ...options, light });
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#fff' : '#1b1e22');
  }
  window.PlayerListsTheme = { colors, readableAccent, imageUrl, applyImageMask, apply };
})();
