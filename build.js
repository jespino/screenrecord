import { compile } from 'nexe';
import { copyFileSync } from 'fs';
import { join } from 'path';

async function build() {
  try {
    // Copy gluon.js to dist directory
    copyFileSync('gluon.js', join('dist', 'gluon.js'));
    
    await compile({
      input: './dist/gluon.js',
      output: './dist/screenrecorder',
      resources: [
        "./dist/**/*",
        "./public/**/*"
      ],
      build: true,
      mangle: true,
      target: 'linux-x64-18.17.1',
      // Add Gluon as external module
      externals: ['@gluon-framework/gluon']
    })
    console.log('Build completed successfully!')
  } catch (err) {
    console.error('Build failed:', err)
    process.exit(1)
  }
}

build()
