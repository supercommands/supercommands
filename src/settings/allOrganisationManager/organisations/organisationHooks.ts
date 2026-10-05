import { useState, useEffect } from 'react';
import type { OrganisationData } from './organisationTypes';
import { getAllOrganisations } from './organisationData';
export function useOrganisations() {
    const [organisations, setOrganisations] = useState<OrganisationData[]>([]);
    useEffect(() => {
        let isMounted = true;
        getAllOrganisations().then(data => {
            if (isMounted)
                setOrganisations(data);
        });
        return () => {
            isMounted = false;
        };
    }, []);
    return {
        organisations,
    };
}
