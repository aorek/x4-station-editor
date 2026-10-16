import type { Locale } from "./index";

/**
 * Flag shown next to each language in the selector, as inline SVG so it looks
 * the same everywhere (emoji flags do not render on Windows).
 */
export const FLAGS: Record<Locale, string> = {
  // United Kingdom
  en: `<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <clipPath id="flag-uk-t"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>
    <path d="M0,0v30h60v-30z" fill="#012169"/>
    <path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>
    <path d="M0,0L60,30M60,0L0,30" clip-path="url(#flag-uk-t)" stroke="#c8102e" stroke-width="4"/>
    <path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>
    <path d="M30,0v30M0,15h60" stroke="#c8102e" stroke-width="6"/>
  </svg>`,
  // Spain (civil flag, without the coat of arms)
  es: `<svg viewBox="0 0 3 2" aria-hidden="true">
    <rect width="3" height="2" fill="#aa151b"/>
    <rect y="0.5" width="3" height="1" fill="#f1bf00"/>
  </svg>`,
};
