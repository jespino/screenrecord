const { Gluon } = require('@gluon-framework/gluon');

(async () => {
  const Window = await Gluon.open('index.html', {
    windowSize: [800, 600],
    title: 'Screen Recorder',
    center: true,
  });
})();
