const { compile } = require('nexe')

async function build() {
  try {
    await compile({
      input: './gluon.js',
      output: './dist/screenrecorder',
      resources: [
        "./dist/**/*",
        "./public/**/*"
      ],
      build: true,
      mangle: true,
      target: 'linux-x64-18.17.1'
    })
    console.log('Build completed successfully!')
  } catch (err) {
    console.error('Build failed:', err)
    process.exit(1)
  }
}

build()
