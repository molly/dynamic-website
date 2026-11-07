import { DateTime } from 'luxon';
import { getPressDetails, isUpcoming } from '../../../api/helpers/press';
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
  const now = DateTime.fromISO('2026-11-07T12:00:00', {
    zone: 'America/New_York',
  });

  it('takes its verb from the medium, and your role for the sentence', () => {
    expect(getPressDetails({ kind: 'podcast', role: 'interviewed' })).toEqual({
      icon: 'speaker',
      verb: 'Appeared on',
      rolePhrase: 'Interviewed in',
    });
    expect(getPressDetails({ kind: 'article', role: 'quoted' })).toMatchObject({
      verb: 'In the press',
      rolePhrase: 'Quoted in',
    });
    expect(getPressDetails({ kind: 'freelance' }).verb).toEqual('Published');
    expect(getPressDetails({})).toEqual({
      icon: 'newspaper',
      verb: 'In the press',
      rolePhrase: null,
    });
  });

  it('calls a talk that hasn’t happened yet upcoming', () => {
    expect(isUpcoming({ kind: 'talk', date: '2026-11-20' }, { now })).toBe(
      true,
    );
    expect(isUpcoming({ kind: 'talk', date: '2026-11-07' }, { now })).toBe(
      false,
    );
    expect(isUpcoming({ kind: 'podcast', date: '2026-11-20' }, { now })).toBe(
      false,
    );
    expect(
      getPressDetails({ kind: 'talk', date: '2026-11-20' }, { now }).verb,
    ).toEqual('Speaking');
  });
});
