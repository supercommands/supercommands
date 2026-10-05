/** Ordered definitions owned by one Collection; IDs remain stable when labels change. */
export interface CollectionPropertyDefinition {
  id: string;
  label: string;
  type: 'text';
}

/** Optional item values keyed by IDs from its Collection's definitions. */
export type CollectionPropertyValues = Record<string, string>;
