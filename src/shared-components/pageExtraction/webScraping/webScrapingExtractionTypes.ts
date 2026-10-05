import type { WebScrapingBlock } from '../../../allObjectFolder/src/createObject/collections/webScrapingTypes';
import type { WebScrapingStyle } from '../../../allObjectFolder/src/createObject/collections/webScrapingStyle';
import type { ElementSnapshotDraft } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotTypes';

/** Capture-only inputs. Download URLs must not be written into Collection data. */
export interface WebScrapingImageCandidate { id: string; downloadUrl: string | null }
export interface ExtractedWebScraping {
  style?: WebScrapingStyle;
  title: string;
  url: string;
  blocks: WebScrapingBlock[];
  images: WebScrapingImageCandidate[];
}
export interface ExtractedElementClip extends ExtractedWebScraping {
  snapshot: ElementSnapshotDraft;
  snapshotImages: WebScrapingImageCandidate[];
}
