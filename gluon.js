import { Gluon } from '@gluon-framework/gluon';

const Window = await Gluon.open('index.html', {
  windowSize: [800, 600],
  title: 'Screen Recorder',
  center: true,
});
