import { defineContentScript } from 'wxt/sandbox';
import { startContentScript } from '../src/pages/contentScript/src/startContentScript';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    startContentScript();
  }
});
