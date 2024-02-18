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
    },
    output: {
      path: distPath,
    },
    plugins: [new MiniCssExtractPlugin()],
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
  },
];
