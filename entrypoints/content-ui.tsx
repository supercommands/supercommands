import { defineUnlistedScript } from 'wxt/sandbox';
import { startContentUI } from '../src/pages/content-ui/src/index';

export default defineUnlistedScript(() => {
  startContentUI();
});
