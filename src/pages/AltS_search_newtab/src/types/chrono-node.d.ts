declare module 'chrono-node' {
    export interface ParsedResult {
        text: string;
        start: {
            date(): Date;
        };
        end?: {
            date(): Date;
        };
    }
    export function parse(text: string, refDate?: Date, options?: unknown): ParsedResult[];
    export function parseDate(text: string, refDate?: Date, options?: unknown): Date;
}
