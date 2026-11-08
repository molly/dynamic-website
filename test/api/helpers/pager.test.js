import { pagerItems } from '../../../api/helpers/pager';

describe('pagerItems', () => {
  it('shows the first pages as a run, then the last', () => {
    expect(pagerItems(1, 35)).toEqual([1, 2, 3, null, 35]);
    expect(pagerItems(3, 35)).toEqual([1, 2, 3, 4, null, 35]);
  });

  it('shows the current page with its neighbours in the middle', () => {
    expect(pagerItems(10, 35)).toEqual([1, null, 9, 10, 11, null, 35]);
  });

  it('shows the last pages as a run at the end', () => {
    expect(pagerItems(35, 35)).toEqual([1, null, 33, 34, 35]);
  });

  it('shows a single missing page rather than a gap', () => {
    expect(pagerItems(4, 35)).toEqual([1, 2, 3, 4, 5, null, 35]);
    expect(pagerItems(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('shows nothing to choose for one page', () => {
    expect(pagerItems(1, 1)).toEqual([1]);
    expect(pagerItems(1, 0)).toEqual([]);
  });
});
