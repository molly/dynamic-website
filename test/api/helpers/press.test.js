import { getPressDetails } from '../../../api/helpers/press';
import { candidateDomains, domainOf } from '../../../backend/helpers/outlets';

describe('outlet domains', () => {
  it('reads a link’s domain the way outlets store it', () => {
    expect(domainOf('https://www.Bloomberg.com/news/x?y=1')).toEqual(
      'bloomberg.com',
    );
    expect(domainOf('mailto:a@b.com')).toBeNull();
    expect(domainOf('not a url')).toBeNull();
  });

  it('tries the full host, then each parent domain', () => {
    expect(candidateDomains('news.bbc.co.uk')).toEqual([
      'news.bbc.co.uk',
      'bbc.co.uk',
      'co.uk',
    ]);
    expect(candidateDomains('nytimes.com')).toEqual(['nytimes.com']);
  });
});

describe('press in the feed', () => {
  it('describes a piece by your role, then by its medium', () => {
    expect(getPressDetails({ kind: 'podcast', role: 'interviewed' })).toEqual({
      icon: 'speaker',
      verb: 'Interviewed in',
    });
    expect(getPressDetails({ kind: 'tv' })).toEqual({
      icon: 'tv',
      verb: 'Appeared on',
    });
    expect(getPressDetails({})).toEqual({
      icon: 'newspaper',
      verb: 'In the press',
    });
  });
});
