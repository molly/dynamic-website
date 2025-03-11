import { processText } from '../../../backend/helpers/social';

describe('processText', () => {
  it('should replace linebreaks with newlines', () => {
    const text = 'this is a<br/>post';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual('this is a\n\npost');
  });

  it('should replace bold with uppercase', () => {
    const text = '<b>this is a post</b> with less emphasis at the end';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual(
      'THIS IS A POST with less emphasis at the end',
    );
  });

  it('should handle nested emphasis tags without falling apart', () => {
    const text = '<b><i>this is a post</i></b> with less emphasis at the end';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual(
      'THIS IS A POST with less emphasis at the end',
    );
  });

  it('should remove anchor tags and display them after their contents', () => {
    const text = '<a href="https://example.com">this is a post</a>';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual('this is a post (https://example.com)');
  });

  it('if the href and the tag text are the same, just display the href', () => {
    const text = '<a href="https://example.com">https://example.com</a>';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual('https://example.com');
  });

  it('should strip remaining HTML tags', () => {
    const text = '<strangehtml>this is a post</strangehtml>';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual('this is a post');
  });

  it("doesn't strip <> characters when they aren't tags", () => {
    const text = 'i <3 you';
    const processedText = processText(text, 'twitter');
    expect(processedText).toEqual('i <3 you');
  });
});
