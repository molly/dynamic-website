import Codecup from '@calumk/editorjs-codecup';
import Embed from '@editorjs/embed';
import Header from '@editorjs/header';
import ImageTool from '@editorjs/image';
import InlineCode from '@editorjs/inline-code';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import RawTool from '@editorjs/raw';
import MentionsTool from '../MentionsTool.js';
import ArticleTool from '../tools/ArticleTool.js';
import ComparisonTool from '../tools/ComparisonTool.js';
import CorrectionTool from '../tools/CorrectionTool.js';
import DataTable from '../tools/DataTable.js';
import DocumentTool from '../tools/DocumentTool.js';
import ImageGallery from '../tools/gallery/index.js';
import HighlightTool from '../tools/HighlightTool.js';
import ImageSourceTune from '../tools/ImageSourceTune.js';
import MediaTool from '../tools/MediaTool.js';
import RoundupTool from '../tools/RoundupTool.js';
import SocialPostTool from '../tools/SocialPostTool.js';

export const editorToolConfig = {
  header: Header,
  embed: {
    class: Embed,
    config: {
      services: {
        twitter: true,
        youtube: true,
        w3igg: {
          regex: /https:\/\/(?:www\.)?web3isgoinggreat\.com\/\?id=([^/?&]*)/,
          embedUrl: 'https://www.web3isgoinggreat.com/embed/<%= remote_id %>',
          html: "<iframe frameborder='0' sandbox=''>",
          width: 600,
          height: 600,
        },
      },
    },
  },
  gallery: {
    class: ImageGallery,
    tunes: ['imageSource'],
    config: {
      endpoints: {
        byFile: '/dynamic-api/micro/image/byFile',
      },
      types: 'image/*, video/*',
    },
  },
  image: {
    class: ImageTool,
    tunes: ['imageSource'],
    config: {
      endpoints: {
        byFile: '/dynamic-api/micro/image/byFile',
        byUrl: '/dynamic-api/micro/image/byUrl',
      },
      types: 'image/*, video/*',
      actions: [
        {
          name: 'white',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">  <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>',
          title: 'Has white background',
          toggle: true,
        },
      ],
    },
  },
  code: Codecup,
  inlineCode: InlineCode,
  list: {
    class: List,
    inlineToolbar: true,
    config: { defaultStyle: 'unordered' },
  },
  mentions: MentionsTool,
  highlight: HighlightTool,
  correction: CorrectionTool,
  quote: Quote,
  raw: RawTool,
  article: ArticleTool,
  roundup: RoundupTool,
  table: { class: DataTable, inlineToolbar: true },
  media: MediaTool,
  // Highlight in the excerpt is "highlight mine"
  document: {
    class: DocumentTool,
    inlineToolbar: ['highlight', 'link', 'bold', 'italic'],
  },
  socialPost: SocialPostTool,
  comparison: {
    class: ComparisonTool,
    inlineToolbar: ['highlight', 'link', 'bold', 'italic'],
  },
  imageSource: ImageSourceTune,
};

// What each side of a comparison can hold: the tools above, with their settings.
editorToolConfig.comparison.config = {
  tools: {
    image: { ...editorToolConfig.image, title: 'Image' },
    socialPost: { class: SocialPostTool, title: 'Social post' },
    document: { ...editorToolConfig.document, title: 'Document' },
    article: { class: ArticleTool, title: 'Linked article' },
  },
};
