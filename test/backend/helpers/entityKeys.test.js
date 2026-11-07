import {
  accountKey,
  nameKey,
  normalizeDomain,
} from '../../../backend/helpers/entityKeys';

describe('nameKey', () => {
  it('ignores case, punctuation and legal suffixes', () => {
    expect(nameKey('Coinbase Global, Inc.')).toEqual('coinbase global');
    expect(nameKey('coinbase global')).toEqual('coinbase global');
    expect(nameKey('FTX Trading Ltd.')).toEqual('ftx trading');
  });

  it('strips accents and reads & as and', () => {
    expect(nameKey('Société Générale')).toEqual('societe generale');
    expect(nameKey('Johnson & Johnson')).toEqual('johnson and johnson');
  });

  it('ignores a trailing possessive', () => {
    expect(nameKey('Taylor Lorenz’s')).toEqual('taylor lorenz');
    expect(nameKey("Casey Newton's")).toEqual('casey newton');
  });

  it('drops a leading "the"', () => {
    expect(nameKey('The Verge')).toEqual(nameKey('Verge'));
  });

  it('never reduces a name to nothing', () => {
    expect(nameKey('The')).toEqual('the');
    expect(nameKey('Company')).toEqual('company');
  });
});

describe('accountKey', () => {
  it('ignores case and a leading @', () => {
    expect(accountKey('bluesky', '@Molly.Wiki')).toEqual('bluesky:molly.wiki');
    expect(accountKey('mastodon', 'molly0xfff@hachyderm.io')).toEqual(
      'mastodon:molly0xfff@hachyderm.io',
    );
  });
});

describe('normalizeDomain', () => {
  it('strips protocol, www and path', () => {
    expect(normalizeDomain('https://www.NYTimes.com/section/tech')).toEqual(
      'nytimes.com',
    );
    expect(normalizeDomain('theverge.com')).toEqual('theverge.com');
  });
});
