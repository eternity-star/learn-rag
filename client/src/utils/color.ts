import { composite } from 'seemly';

export function createHoverColor(color: string, overlayAlpha = 0.15) {
  return composite(color, [255, 255, 255, overlayAlpha]);
}
export function createPressedColor(color: string, overlayAlpha = 0.15) {
  return composite(color, [0, 0, 0, overlayAlpha]);
}
