import { Text } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';

import {
  BRAILLE_SPINNER_FRAMES,
  BRAILLE_SPINNER_INTERVAL_MS,
  RAINBOW_TEXT_SPINNER_FRAMES,
  RAINBOW_TEXT_PHASE_INTERVAL_MS,
  RAINBOW_TEXT_FRAME_INTERVAL_MS,
} from '#/tui/constant/rendering';
import { getDanceRainbowPalette, rainbowText } from '#/tui/easter-eggs/dance';

export type SpinnerStyle = 'braille' | 'rainbow-text';

export class MoonLoader extends Text {
  private currentFrame = 0;
  private phase = 0;
  private ticks = 0;
  private ticksPerFrame = 1;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ui: TUI;
  private frames: string[];
  private interval: number;
  private style: SpinnerStyle;
  private colorFn?: (s: string) => string;
  private label: string;
  private displayText = '';

  constructor(
    ui: TUI,
    style: SpinnerStyle = 'rainbow-text',
    colorFn?: (s: string) => string,
    label: string = '',
  ) {
    super('', 1, 0);
    this.ui = ui;
    this.style = style;
    if (style === 'braille') {
      this.frames = [...BRAILLE_SPINNER_FRAMES];
      this.interval = BRAILLE_SPINNER_INTERVAL_MS;
      this.ticksPerFrame = 1;
    } else {
      this.frames = [...RAINBOW_TEXT_SPINNER_FRAMES];
      this.interval = RAINBOW_TEXT_PHASE_INTERVAL_MS;
      this.ticksPerFrame = Math.ceil(RAINBOW_TEXT_FRAME_INTERVAL_MS / RAINBOW_TEXT_PHASE_INTERVAL_MS);
    }
    this.colorFn = colorFn;
    this.label = label;
    this.start();
  }

  start(): void {
    this.updateDisplay();
    this.intervalId = setInterval(() => {
      this.ticks += 1;
      if (this.ticks >= this.ticksPerFrame) {
        this.ticks = 0;
        this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      }
      this.updateDisplay();
    }, this.interval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setLabel(label: string): void {
    this.label = label;
    this.updateDisplay();
  }

  setColorFn(colorFn: (s: string) => string): void {
    this.colorFn = colorFn;
    this.updateDisplay();
  }

  renderInline(): string {
    return this.displayText;
  }

  private updateDisplay(): void {
    if (this.style === 'rainbow-text') {
      const text = this.frames[this.currentFrame] ?? '';
      this.displayText = rainbowText(text, getDanceRainbowPalette(), this.phase, true);
      this.phase += 1;
    } else {
      const frame = this.frames[this.currentFrame]!;
      const coloredFrame = this.colorFn ? this.colorFn(frame) : frame;
      this.displayText = this.label ? `${coloredFrame} ${this.label}` : coloredFrame;
    }
    this.setText(this.displayText);
    this.ui.requestRender();
  }
}
