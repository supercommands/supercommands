export interface Tag {
    tag_id: string;
    name: string;
}
export interface Tabs {
    urls: string[];
    names: string[];
}
export interface Snippet {
    id: string;
    key: string;
    value: string | Tabs;
    category: string;
    user_id: string;
    first_name: string;
    last_name: string | null;
    created_at: string;
    updated_at: string;
    tags: Tag[] | null;
    snippet_id?: string;
}
export interface NewSnippetBreadCrum {
    organisation_id: string | null;
    organisation_name: string | null;
}
export interface OrganisationDetails {
    organisation_id: string;
    organisation_name: string;
    org_id: string;
    type: 'public' | 'private' | 'shareonly';
    admin_user_id?: string;
}
