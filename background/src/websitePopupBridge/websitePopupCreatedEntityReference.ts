/** One legacy-compatible compound reference ID for popup-created entities. */
import { getItemCompoundId } from '../../../src/shared-components/utils/idGenerator';

export function getWebsitePopupCreatedEntityReferenceId(record: {
  id: string;
  organisationId?: string;
  
}): string {
  return getItemCompoundId({
    id: record.id,
    organisation_id: record.organisationId || null,
    
  });
}
