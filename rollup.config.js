import typescript from '@rollup/plugin-typescript';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from 'rollup-plugin-json';
import {terser} from 'rollup-plugin-terser';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import babel from 'rollup-plugin-babel';
import pkg from './package.json';

const footer = `
if(typeof window !== 'undefined') {
  window._CHANNEL_SERVICE_VERSION_ = '${pkg.version}'
}`;

export default {
    input: './packages/index.ts',
    extensions: ['.js', '.ts', '.json'],
    output: [
        {
            file: pkg.main,
            format: 'cjs',
            footer,
            sourcemap: true,
        },
        {
            file: pkg.module,
            format: 'esm',
            footer,
            sourcemap: true,
        },
        {
            file: pkg.browser,
            format: 'umd',
            name: 'channelService',
            sourcemap: true,
            footer,
        },
    ],
    plugins: [
        commonjs({
            include: 'node_modules/**/*',
        }),
        resolve(),
        json(),
        typescript(),
        terser(),
        babel({
            exclude: 'node_modules/**',
            namedExports: {
                axios: ['useState', 'Component', 'useRef', 'useEffect'],
            },
        }),
        livereload(),
        serve({
            open: true,
            openPage: 'example/index.html',
            contentBase: '.',
        }),
    ],
};
