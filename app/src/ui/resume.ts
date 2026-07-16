/**
 * The seminar → home "finish your plan" loop (PRD §5.2).
 *
 * The pre-printed seminar card (docs/masa_seminar_blank_stock_card_front_back.png)
 * carries a short resume code and a QR whose target is this app with `?resume=CODE`.
 * Scanning it at home lands the lead on the "finish your plan" flow.
 *
 * In this throwaway prototype there is no backend to look the code up against — the
 * code is a demonstrable token, not a server-side session key. `resumeUrl` is built
 * from the live origin + Vite base so the same code works on localhost and on the
 * deployed GitHub Pages URL without hardcoding either.
 */

import QRCode from 'qrcode';
import type { Profile } from '../domain/profile';

/** Short, human-copyable code shown on the card and accepted via ?resume=. */
export function resumeCode(p: Profile): string {
  return p.sessionId.slice(0, 8).toUpperCase();
}

/** Absolute URL the card's QR encodes. Works on localhost and on Pages. */
export function resumeUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?resume=${encodeURIComponent(code)}`;
}

/** Render a QR for `text` as an inline SVG string (no network, embeds in print HTML). */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#230871', light: '#00000000' } });
}
