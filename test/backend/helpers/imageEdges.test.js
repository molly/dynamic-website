import sharp from 'sharp';

import {
  bufferHasLightEdges,
  hasLightEdges,
} from '../../../backend/helpers/imageEdges';

// A plain image of one color, with an optional rectangle of another drawn on it
const image = async (background, { rect, rectColor, alpha = false } = {}) => {
  const base = sharp({
    create: {
      width: 400,
      height: 300,
      channels: alpha ? 4 : 3,
      background,
    },
  });
  const composite = rect
    ? [
        {
          input: await sharp({
            create: {
              width: rect.w,
              height: rect.h,
              channels: 3,
              background: rectColor,
            },
          })
            .png()
            .toBuffer(),
          left: rect.x,
          top: rect.y,
        },
      ]
    : [];
  return base.composite(composite).png().toBuffer();
};

describe('images with white edges', () => {
  it('finds a screenshot of a document: white all round, text in the middle', async () => {
    const screenshot = await image('#ffffff', {
      rect: { x: 40, y: 40, w: 320, h: 220 },
      rectColor: '#333333',
    });
    expect(await bufferHasLightEdges(screenshot)).toBe(true);
    // Off-white, as screenshots often are, counts too
    expect(await bufferHasLightEdges(await image('#f4f4f2'))).toBe(true);
  });

  it('finds a logo on a transparent background', async () => {
    expect(
      await bufferHasLightEdges(
        await image({ r: 0, g: 0, b: 0, alpha: 0 }, { alpha: true }),
      ),
    ).toBe(true);
  });

  it('leaves a photo, or a screenshot with a dark bar along one side', async () => {
    expect(await bufferHasLightEdges(await image('#4a6b8a'))).toBe(false);
    const withHeader = await image('#ffffff', {
      rect: { x: 0, y: 0, w: 400, h: 60 },
      rectColor: '#1d1d1f',
    });
    expect(await bufferHasLightEdges(withHeader)).toBe(false);
  });

  it('reads a clone of an image that’s going elsewhere too', async () => {
    const source = sharp(await image('#ffffff')).rotate();
    expect(await hasLightEdges(source.clone())).toBe(true);
    expect((await source.png().toBuffer()).length).toBeGreaterThan(0);
  });
});
