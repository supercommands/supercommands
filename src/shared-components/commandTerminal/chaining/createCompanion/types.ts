export type CreateCompanionValidationStatus = 'empty' | 'checking' | 'available' | 'conflict' | 'error';
export type CreateCompanionValidationState = {
    status: CreateCompanionValidationStatus;
    message?: string | null;
};
