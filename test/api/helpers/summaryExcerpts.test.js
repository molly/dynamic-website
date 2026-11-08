import { summaryToExcerpts } from '../../../api/helpers/summaryExcerpts';

describe('summaryToExcerpts', () => {
  it('makes plain-text passages, one per line', () => {
    expect(
      summaryToExcerpts(
        'In interviews with <i>The Times</i>, three former employees spoke.<br/>A second passage.',
      ),
    ).toEqual([
      'In interviews with The Times, three former employees spoke.',
      'A second passage.',
    ]);
    expect(summaryToExcerpts('<ol><li>One</li><li>Two</li></ol>')).toEqual([
      'One',
      'Two',
    ]);
  });

  it('drops quote marks around a whole passage, but not around part of one', () => {
    expect(summaryToExcerpts('“The last straw for me.”')).toEqual([
      'The last straw for me.',
    ]);
    expect(summaryToExcerpts('"Workism" is when work is central')).toEqual([
      '"Workism" is when work is central',
    ]);
    expect(summaryToExcerpts('“A,” she said, “and B.”')).toEqual([
      '“A,” she said, “and B.”',
    ]);
  });

  it('has nothing for an empty summary', () => {
    expect(summaryToExcerpts('')).toEqual([]);
    expect(summaryToExcerpts('<br>')).toEqual([]);
  });
});
