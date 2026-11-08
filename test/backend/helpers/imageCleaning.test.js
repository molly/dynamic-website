import sharp from 'sharp';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import {
  MAX_IMAGE_WIDTH,
  imageCleaner,
  stripJpegMetadata,
  stripStoredImage,
} from '../../../backend/helpers/imageCleaning';

const clean = (input, type) =>
  buffer(Readable.from([input]).pipe(imageCleaner(type)));

const solid = (width, height) =>
  sharp({
    create: { width, height, channels: 3, background: '#5b3cc4' },
  });

describe('imageCleaner', () => {
  it('turns a phone photo upright and strips its EXIF', async () => {
    // Stored sideways, with EXIF saying to turn it a quarter turn clockwise
    const photo = await solid(3000, 1000)
      .jpeg()
      .withExif({ IFD0: { Make: 'Phone', Copyright: 'someone' } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const meta = await sharp(await clean(photo, 'image/jpeg')).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 1000, height: 3000 });
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it(`shrinks wide images to ${MAX_IMAGE_WIDTH}px wide, keeping their shape`, async () => {
    const wide = await solid(4000, 3000).png().toBuffer();
    const meta = await sharp(await clean(wide, 'image/png')).metadata();
    expect(meta).toMatchObject({ format: 'png', width: 2000, height: 1500 });
  });

  it('leaves tall screenshots and small images at their size', async () => {
    const tall = await solid(1200, 4000).png().toBuffer();
    expect(
      await sharp(await clean(tall, 'image/png')).metadata(),
    ).toMatchObject({ width: 1200, height: 4000 });
    const small = await solid(300, 200).webp().toBuffer();
    expect(
      await sharp(await clean(small, 'image/webp')).metadata(),
    ).toMatchObject({ format: 'webp', width: 300, height: 200 });
  });

  it('keeps every frame of an animated GIF', async () => {
    const frames = await Promise.all(
      ['#ff0000', '#00ff00', '#0000ff'].map((background) =>
        sharp({ create: { width: 100, height: 100, channels: 3, background } })
          .png()
          .toBuffer(),
      ),
    );
    const gif = await sharp(frames, { join: { animated: true } })
      .gif()
      .toBuffer();
    expect((await sharp(gif).metadata()).pages).toBe(3);

    const meta = await sharp(await clean(gif, 'image/gif')).metadata();
    expect(meta).toMatchObject({ format: 'gif', pages: 3, width: 100 });
  });

  it('leaves files that aren’t photos alone, and refuses HEIC', () => {
    expect(imageCleaner('video/mp4')).toBeNull();
    expect(imageCleaner('image/svg+xml')).toBeNull();
    expect(imageCleaner('application/pdf')).toBeNull();
    expect(imageCleaner('image/jpeg; charset=binary')).not.toBeNull();
    expect(() => imageCleaner('image/heic')).toThrow(/HEIC/);
  });
});

describe('stripStoredImage', () => {
  // Everything from the start of the image data on: the picture itself
  const imageData = (jpeg) =>
    jpeg.subarray(jpeg.indexOf(Buffer.from([0xff, 0xda])));

  it('strips an upright JPEG without re-encoding it, keeping its color profile', async () => {
    const photo = await solid(400, 300)
      .jpeg()
      .withExif({ IFD0: { Make: 'Phone', Copyright: 'someone' } })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')
      .withIccProfile('p3')
      .toBuffer();
    const withComment = Buffer.concat([
      photo.subarray(0, 2),
      Buffer.from([0xff, 0xfe, 0x00, 0x07]),
      Buffer.from('hello'),
      photo.subarray(2),
    ]);
    const before = await sharp(withComment).metadata();
    expect(before.exif && before.xmp && before.icc).toBeTruthy();
    // sharp doesn't report JPEG comment segments, but they go along with the rest
    expect(withComment.includes('hello')).toBe(true);

    const result = await stripStoredImage(withComment);
    expect(result.removed).toEqual(['EXIF', 'XMP']);
    expect(result.reencoded).toBe(false);
    const after = await sharp(result.output).metadata();
    expect(after).toMatchObject({ format: 'jpeg', width: 400, height: 300 });
    expect(after.exif || after.xmp).toBeFalsy();
    expect(result.output.includes('hello')).toBe(false);
    expect(after.icc).toBeDefined();
    expect(imageData(result.output).equals(imageData(withComment))).toBe(true);
  });

  it('turns a sideways JPEG upright, re-encoding it', async () => {
    const photo = await solid(300, 100)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await stripStoredImage(photo);
    expect(result.reencoded).toBe(true);
    const after = await sharp(result.output).metadata();
    expect(after).toMatchObject({ format: 'jpeg', width: 100, height: 300 });
    expect(after.exif).toBeUndefined();
  });

  it('cleans other formats in their own format', async () => {
    const png = await solid(50, 50)
      .png()
      .withExif({ IFD0: { Make: 'Phone' } })
      .toBuffer();
    const result = await stripStoredImage(png);
    const after = await sharp(result.output).metadata();
    expect(after).toMatchObject({ format: 'png', width: 50 });
    expect(after.exif).toBeUndefined();
  });

  it('leaves images with nothing to remove alone', async () => {
    expect(
      await stripStoredImage(await solid(20, 20).jpeg().toBuffer()),
    ).toBeNull();
    expect(
      await stripStoredImage(await solid(20, 20).png().toBuffer()),
    ).toBeNull();
  });

  it('refuses things that aren’t JPEGs', () => {
    expect(() => stripJpegMetadata(Buffer.from('nope'))).toThrow('Not a JPEG');
  });
});
