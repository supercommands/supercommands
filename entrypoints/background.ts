import { defineBackground } from 'wxt/sandbox';
import { startBackground } from '../background/src/startBackground';

export default defineBackground({
  type: 'module',
  main() {
    startBackground();
  }
});
