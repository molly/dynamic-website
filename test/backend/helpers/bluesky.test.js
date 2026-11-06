import { makeSkeet } from '../../../backend/helpers/bluesky.js';

describe('bluesky', () => {
  it('makeSkeet should properly represent one custom link', async () => {
    const post = {
      text: 'this is a post with a <a href="https://example.com/">custom link</a>!',
      images: [],
    };
    const result = await makeSkeet(post);
    expect(result.text).toEqual('this is a post with a custom link!');
    expect(result.facets.length).toEqual(1);
    expect(result.facets[0].features.length).toEqual(1);
    expect(result.facets[0].features[0].uri).toEqual('https://example.com/');
    expect(result.facets[0].index.byteStart).toEqual(22);
    expect(result.facets[0].index.byteEnd).toEqual(33);
  });

  it('makeSkeet should properly represent two custom links', async () => {
    const post = {
      text: 'this is a post with a <a href="https://example.com/">custom link</a>! and then there\'s <a href="https://example2.com/">another custom link</a>!',
      images: [],
    };
    const result = await makeSkeet(post);
    expect(result.text).toEqual(
      "this is a post with a custom link! and then there's another custom link!",
    );
    expect(result.facets.length).toEqual(2);
    expect(result.facets[0].features.length).toEqual(1);
    expect(result.facets[0].features[0].uri).toEqual('https://example.com/');
    expect(result.facets[0].index.byteStart).toEqual(22);
    expect(result.facets[0].index.byteEnd).toEqual(33);
    expect(result.facets[1].features.length).toEqual(1);
    expect(result.facets[1].features[0].uri).toEqual('https://example2.com/');
    expect(result.facets[1].index.byteStart).toEqual(52);
    expect(result.facets[1].index.byteEnd).toEqual(71);
  });

  it('makeSkeet should decode HTML entities rather than posting them literally', async () => {
    const post = {
      text: 'a&nbsp;post &amp; i &lt;3 it',
      images: [],
    };
    const result = await makeSkeet(post, {});
    expect(result.text).toEqual('a\u00A0post & i <3 it');
  });

  it('makeSkeet should place custom links correctly after HTML entities', async () => {
    const post = {
      text: 'a&nbsp;&amp; <a href="https://example.com/">custom link</a>!',
      images: [],
    };
    const result = await makeSkeet(post);
    expect(result.text).toEqual('a\u00A0& custom link!');
    expect(result.facets.length).toEqual(1);
    expect(result.facets[0].features[0].uri).toEqual('https://example.com/');
    // "a" (1 byte) + non-breaking space (2 bytes) + "& " (2 bytes)
    expect(result.facets[0].index.byteStart).toEqual(5);
    expect(result.facets[0].index.byteEnd).toEqual(16);
  });
});
