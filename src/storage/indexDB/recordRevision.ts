/** Call inside the same transaction that applies an entity update. */
export function assertRecordRevision(record: {
    updatedAt: number;
}, expectedUpdatedAt?: number) {
    if (expectedUpdatedAt !== undefined && record.updatedAt !== expectedUpdatedAt) {
        throw new Error('This item changed elsewhere. Close and reopen its editor to review the latest values.');
    }
}
