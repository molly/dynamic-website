import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const distPath = new URL('dist', import.meta.url).pathname;
const modulesPath = new URL('node_modules', import.meta.url).pathname;

export default [
  {
    mode: 'production',
    resolve: {
      modules: [modulesPath],
    },
    entry: {
      editor: './frontend/js/editor.js',
      reading: './frontend/js/reading.js',
      feed: './frontend/js/feed.js',
      tagger: './frontend/js/tagger.js',
      webmentions: './frontend/js/webmentions.js',
    },
    output: {
      path: distPath,
    },
    plugins: [new MiniCssExtractPlugin()],
    module: {
      rules: [
        {
          test: /frontend\/js\/.*\.(?:js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['@babel/preset-env', { targets: 'defaults' }]],
            },
          },
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        { test: /\.svg$/, loader: 'svg-inline-loader' },
      ],
    },
  },
];
