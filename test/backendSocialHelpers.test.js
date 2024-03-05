import { processText } from '../backend/helpers/social';

describe('processText', () => {
  it('should replace linebreaks with newlines', () => {
    const text = 'this is a<br/>post';
    const processedText = processText(text);
    expect(processedText).toEqual('this is a\npost');
  });

  it('should replace italics with uppercase', () => {
    const text = '<i>this is a post</i> with less emphasis at the end';
    const processedText = processText(text);
    expect(processedText).toEqual(
      'THIS IS A POST with less emphasis at the end',
    );
  });

  it('should replace bold with uppercase', () => {
    const text = '<b>this is a post</b> with less emphasis at the end';
    const processedText = processText(text);
    expect(processedText).toEqual(
      'THIS IS A POST with less emphasis at the end',
    );
  });

  it('should remove anchor tags', () => {
    const text = '<a href="https://example.com">this is a post</a>';
    const processedText = processText(text);
    expect(processedText).toEqual('this is a post');
  });

  it('should strip remaining HTML tags', () => {
    const text = '<strangehtml>this is a post</strangehtml>';
    const processedText = processText(text);
    expect(processedText).toEqual('this is a post');
  });

  it("doesn't strip <> characters when they aren't tags", () => {
    const text = 'i <3 you';
    const processedText = processText(text);
    expect(processedText).toEqual('i <3 you');
  });
});
