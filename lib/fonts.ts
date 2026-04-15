import { VT323 } from 'next/font/google'

/**
 * Main menu “BIT” only — tall bitmap terminal face (clearer than 8×8 Press Start 2P at display sizes).
 * Do not use for body copy; keep `MENU_FONT_STACK` as system monospace elsewhere.
 */
export const menuBitTitleFont = VT323({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})
