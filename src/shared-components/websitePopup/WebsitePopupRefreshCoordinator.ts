/** Coalesces invalidations and rejects responses from older requests/openings. */
export class WebsitePopupRefreshCoordinator<Key extends string> {
    private generation = 0;
    private active = false;
    private revisions = new Map<Key, number>();
    private flights = new Map<Key, Promise<void>>();
    constructor(private readonly resources: Record<Key, {
        read: () => Promise<unknown>;
        pending?: () => void;
        commit: (value: unknown) => void;
        fail: (error: unknown) => void;
    }>) { }
    open() {
        this.close();
        this.active = true;
    }
    close() {
        this.active = false;
        this.generation += 1;
        this.revisions.clear();
        this.flights.clear();
    }
    refresh(key: Key): Promise<void> {
        if (!this.active)
            return Promise.resolve();
        this.revisions.set(key, (this.revisions.get(key) || 0) + 1);
        this.resources[key].pending?.();
        const current = this.flights.get(key);
        if (current)
            return current;
        const generation = this.generation;
        const flight = Promise.resolve().then(async () => {
            while (this.active && generation === this.generation) {
                const revision = this.revisions.get(key);
                const fresh = () => this.active && generation === this.generation && revision === this.revisions.get(key);
                try {
                    const value = await this.resources[key].read();
                    if (fresh())
                        this.resources[key].commit(value);
                }
                catch (error) {
                    if (fresh())
                        this.resources[key].fail(error);
                }
                if (generation !== this.generation || revision === this.revisions.get(key))
                    break;
            }
        }).finally(() => {
            if (this.flights.get(key) === flight)
                this.flights.delete(key);
        });
        this.flights.set(key, flight);
        return flight;
    }
}
