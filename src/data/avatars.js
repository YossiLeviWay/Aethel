// Professional avatar selection system with SVG-based designs
// 16 unique avatar options with distinct color schemes

export const AVATAR_OPTIONS = [
  {
    id: 'avatar-1',
    name: 'כחול קלאסי',
    bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-2',
    name: 'סגול עמוק',
    bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-3',
    name: 'ירוק אמרלד',
    bg: 'linear-gradient(135deg, #10b981, #047857)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-4',
    name: 'אדום חם',
    bg: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-5',
    name: 'כתום שקיעה',
    bg: 'linear-gradient(135deg, #f97316, #c2410c)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-6',
    name: 'ורוד מודרני',
    bg: 'linear-gradient(135deg, #ec4899, #be185d)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-7',
    name: 'טורקיז',
    bg: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-8',
    name: 'אינדיגו',
    bg: 'linear-gradient(135deg, #6366f1, #4338ca)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-9',
    name: 'זהב חם',
    bg: 'linear-gradient(135deg, #f59e0b, #b45309)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-10',
    name: 'אפור אלגנטי',
    bg: 'linear-gradient(135deg, #6b7280, #374151)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-11',
    name: 'שחר ורוד',
    bg: 'linear-gradient(135deg, #f472b6, #a855f7)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-12',
    name: 'אוקיינוס',
    bg: 'linear-gradient(135deg, #06b6d4, #2563eb)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-13',
    name: 'יער',
    bg: 'linear-gradient(135deg, #22c55e, #15803d)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-14',
    name: 'לבנדר',
    bg: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-15',
    name: 'פחם כהה',
    bg: 'linear-gradient(135deg, #475569, #1e293b)',
    textColor: '#ffffff',
  },
  {
    id: 'avatar-16',
    name: 'קורל',
    bg: 'linear-gradient(135deg, #fb7185, #e11d48)',
    textColor: '#ffffff',
  },
];

// SVG path data for the default user silhouette displayed when no initial is available
export const AVATAR_SVG_PATHS = {
  // Person silhouette (head and shoulders)
  user: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z',
};

/**
 * Generate an inline SVG string for a given avatar option.
 * If `initial` is provided, it renders the letter on the gradient background.
 * Otherwise, it renders the default user silhouette icon.
 *
 * @param {object} avatar - An avatar option from AVATAR_OPTIONS
 * @param {string} [initial] - A single character to display (e.g. first letter of name)
 * @param {number} [size=48] - Width and height of the SVG in pixels
 * @returns {string} An inline SVG markup string
 */
export function generateAvatarSVG(avatar, initial = null, size = 48) {
  const gradientId = `grad-${avatar.id}`;

  // Parse gradient colors from the bg string
  const colorMatch = avatar.bg.match(/#[0-9a-fA-F]{6}/g);
  const color1 = colorMatch?.[0] || '#3b82f6';
  const color2 = colorMatch?.[1] || '#1d4ed8';

  const content = initial
    ? `<text x="12" y="12" dominant-baseline="central" text-anchor="middle"
        fill="${avatar.textColor}" font-family="Arial, sans-serif" font-weight="600"
        font-size="11">${initial.toUpperCase()}</text>`
    : `<path d="${AVATAR_SVG_PATHS.user}" fill="${avatar.textColor}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
  </defs>
  <rect width="24" height="24" rx="12" fill="url(#${gradientId})"/>
  ${content}
</svg>`;
}

/**
 * Get an avatar option by its id.
 * @param {string} id - The avatar id (e.g. 'avatar-1')
 * @returns {object|undefined} The matching avatar option
 */
export function getAvatarById(id) {
  return AVATAR_OPTIONS.find((a) => a.id === id);
}

/**
 * Get the default avatar (first option).
 * @returns {object} The default avatar option
 */
export function getDefaultAvatar() {
  return AVATAR_OPTIONS[0];
}
