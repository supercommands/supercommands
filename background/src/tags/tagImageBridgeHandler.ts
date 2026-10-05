import { readTagImage } from '../../../src/allObjectFolder/src/createObject/tags/tagImageData';
import { TAG_IMAGE_READ_ACTION, type TagImageReadResponse } from '../../../src/allObjectFolder/src/createObject/tags/tagImageBridgeTypes';

export function handleTagImageMessage(message: unknown, sendResponse: (response: TagImageReadResponse) => void): boolean {
    if (!message || typeof message !== 'object' || !('action' in message) || message.action !== TAG_IMAGE_READ_ACTION) return false;
    void (async () => {
        let response: TagImageReadResponse;
        try {
            if (Object.keys(message).length !== 2 || !('payload' in message)) throw new Error('Invalid tag image message.');
            response = {success: true, image: await readTagImage(message.payload)};
        } catch (error) {
            response = {success: false, error: error instanceof Error ? error.message : 'Could not load the tag image.'};
        }
        sendResponse(response);
    })();
    return true;
}
