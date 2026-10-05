export interface AddCollectionPropertyInput {
  label?: string;
  type?: 'text';
  expectedUpdatedAt: number;
}

export interface RenameCollectionPropertyInput {
  propertyId: string;
  label: string;
  expectedUpdatedAt: number;
}

export interface SetCollectionItemPropertyValueInput {
  propertyId: string;
  /** Null or an empty string clears the value; other text is preserved verbatim. */
  value: string | null;
  expectedUpdatedAt: number;
}
