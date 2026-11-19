import { describe, expect, it } from 'vitest';
import { santaPayload } from '../src/campaigns/santa-box/schema.js';

const base = {
  design: { box: 0, ribbon: 0, accents: [], paper: 0, font: 0 },
  card: { message: '' },
  gift: { item: 'orn', coupon: null },
  music: 'silent',
};
const withColours = (box: unknown, ribbon: unknown) => ({ ...base, design: { ...base.design, box, ribbon } });

describe('box and ribbon colours', () => {
  it('takes a preset or a picked #rrggbb colour', () => {
    expect(santaPayload.parse(withColours(5, 2)).design).toMatchObject({ box: 5, ribbon: 2 });
    expect(santaPayload.parse(withColours('#C8A2D4', '#00ff7f')).design).toMatchObject({ box: '#c8a2d4', ribbon: '#00ff7f' });
  });
  it('refuses anything else', () => {
    for (const bad of [6, -1, 1.5, '#fff', 'red', '#12345g', 'url(x)']) {
      expect(santaPayload.safeParse(withColours(bad, 0)).success).toBe(false);
    }
  });
});
