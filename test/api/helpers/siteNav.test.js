import { navState, SITE_BAR, SITE_MENU } from '../../../api/helpers/siteNav';

describe('site navigation', () => {
  it('underlines the parent below desktop for pages whose bar link drops out there', () => {
    expect(navState('press')).toEqual({
      current: 'press',
      parent: 'work',
      parentFrom: 'narrow',
    });
    expect(navState('contact')).toMatchObject({
      parent: 'about',
      parentFrom: 'narrow',
    });
  });

  it('always underlines the parent for pages that are only in the Menu', () => {
    expect(navState('speaking')).toEqual({
      current: 'speaking',
      parent: 'work',
      parentFrom: 'always',
    });
  });

  it('has no parent for top-level pages and pages outside the navigation', () => {
    expect(navState('feed')).toMatchObject({ parent: null });
    expect(navState('entities')).toMatchObject({ parent: null });
    expect(navState(null)).toEqual({
      current: null,
      parent: null,
      parentFrom: null,
    });
  });

  it('keys internal pages by their first path segment, and has every bar page in the Menu', () => {
    const keys = SITE_MENU.flat().flatMap((top) => [
      top.key,
      ...(top.children || []).map((child) => child.key),
    ]);
    expect(keys).toEqual(
      expect.arrayContaining(['home', 'verify', 'projects', 'micro']),
    );
    SITE_BAR.forEach((link) => expect(keys).toContain(link.key));
  });
});
