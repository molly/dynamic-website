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
      admin: './frontend/js/admin.js',
      editor: './frontend/js/editor.js',
      site: './frontend/js/site.js',
      tagger: './frontend/js/tagger.js',
      webmentions: './frontend/js/webmentions.js',
    },
    output: {
      path: distPath,
      publicPath: '/static/', // dist is served at /static
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
        {
          test: /\.woff2?$/,
          type: 'asset/resource',
          generator: { filename: 'fonts/[name][ext]' },
        },
      ],
    },
  },
];
