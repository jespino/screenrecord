import * as Gluon from '@gluon-framework/gluon';

const Window = await Gluon.open('./dist/index.html', {
  windowSize: [800, 600],
  title: 'Screen recorder',
  center: true,
});
