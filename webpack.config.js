const contextPath = new URL('frontend/js', import.meta.url).pathname;
const distPath = new URL('js', import.meta.url).pathname;
const modulesPath = new URL('node_modules', import.meta.url).pathname;

export default [
  {
    mode: 'production',
    context: contextPath,
    resolve: {
      modules: [modulesPath],
    },
    entry: {
      editor: './editor.js',
      reading: './reading.js',
    },
    output: {
      path: distPath,
    },
  },
];
