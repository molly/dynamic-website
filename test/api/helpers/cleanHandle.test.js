import { cleanHandle } from '../../../api/helpers/socialMedia';

describe('cleanHandle', () => {
  it('drops invisible characters copied along with a handle', () => {
    expect(cleanHandle('bluesky', 'chriscoyier.net\u202C')).toBe(
      'chriscoyier.net',
    );
    expect(cleanHandle('twitter', '\u200Bmolly0xFFF ')).toBe('molly0xFFF');
  });

  it('fixes a Mastodon server written twice', () => {
    expect(
      cleanHandle(
        'mastodon',
        '@cryptadamist@universeodon.com@universeodon.com',
      ),
    ).toBe('@cryptadamist@universeodon.com');
    expect(cleanHandle('mastodon', 'molly0xfff@hachyderm.io')).toBe(
      'molly0xfff@hachyderm.io',
    );
    // Only Mastodon handles have a server
    expect(cleanHandle('website', 'https://a.example@a.example')).toBe(
      'https://a.example@a.example',
    );
  });
});
