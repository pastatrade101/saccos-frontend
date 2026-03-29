import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import {
    endpoints,
    type LocationDistrictsResponse,
    type LocationRegionsResponse,
    type LocationVillagesResponse,
    type LocationWardsResponse
} from "../lib/endpoints";
import type { LocationDistrict, LocationRegion, LocationVillage, LocationWard } from "../types/api";

const regionsCache = {
    value: null as LocationRegion[] | null,
    promise: null as Promise<LocationRegion[]> | null
};
const districtsCache = new Map<string, LocationDistrict[]>();
const districtsPromises = new Map<string, Promise<LocationDistrict[]>>();
const wardsCache = new Map<string, LocationWard[]>();
const wardsPromises = new Map<string, Promise<LocationWard[]>>();
const villagesCache = new Map<string, LocationVillage[]>();
const villagesPromises = new Map<string, Promise<LocationVillage[]>>();

async function loadRegionsCached() {
    if (regionsCache.value) {
        return regionsCache.value;
    }

    if (!regionsCache.promise) {
        regionsCache.promise = api
            .get<LocationRegionsResponse>(endpoints.locations.regions())
            .then((response) => {
                const items = response.data.data || [];
                regionsCache.value = items;
                return items;
            })
            .finally(() => {
                regionsCache.promise = null;
            });
    }

    return regionsCache.promise;
}

async function loadDistrictsCached(regionId: string) {
    if (districtsCache.has(regionId)) {
        return districtsCache.get(regionId) || [];
    }

    if (!districtsPromises.has(regionId)) {
        districtsPromises.set(
            regionId,
            api
                .get<LocationDistrictsResponse>(endpoints.locations.districts(), {
                    params: { region_id: regionId }
                })
                .then((response) => {
                    const items = response.data.data || [];
                    districtsCache.set(regionId, items);
                    return items;
                })
                .finally(() => {
                    districtsPromises.delete(regionId);
                })
        );
    }

    return districtsPromises.get(regionId) || [];
}

async function loadWardsCached(districtId: string) {
    if (wardsCache.has(districtId)) {
        return wardsCache.get(districtId) || [];
    }

    if (!wardsPromises.has(districtId)) {
        wardsPromises.set(
            districtId,
            api
                .get<LocationWardsResponse>(endpoints.locations.wards(), {
                    params: { district_id: districtId }
                })
                .then((response) => {
                    const items = response.data.data || [];
                    wardsCache.set(districtId, items);
                    return items;
                })
                .finally(() => {
                    wardsPromises.delete(districtId);
                })
        );
    }

    return wardsPromises.get(districtId) || [];
}

async function loadVillagesCached(wardId: string) {
    if (villagesCache.has(wardId)) {
        return villagesCache.get(wardId) || [];
    }

    if (!villagesPromises.has(wardId)) {
        villagesPromises.set(
            wardId,
            api
                .get<LocationVillagesResponse>(endpoints.locations.villages(), {
                    params: { ward_id: wardId, page: 1, limit: 500 }
                })
                .then((response) => {
                    const items = response.data.data?.items || [];
                    villagesCache.set(wardId, items);
                    return items;
                })
                .finally(() => {
                    villagesPromises.delete(wardId);
                })
        );
    }

    return villagesPromises.get(wardId) || [];
}

export function findLocationByName<T extends { name: string }>(items: T[], name?: string | null) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    return items.find((item) => item.name.trim().toLowerCase() === normalized) || null;
}

export function useTanzaniaLocations(params: {
    regionId?: string;
    districtId?: string;
    wardId?: string;
}) {
    const { regionId = "", districtId = "", wardId = "" } = params;
    const [regions, setRegions] = useState<LocationRegion[]>(regionsCache.value || []);
    const [districts, setDistricts] = useState<LocationDistrict[]>(regionId ? (districtsCache.get(regionId) || []) : []);
    const [wards, setWards] = useState<LocationWard[]>(districtId ? (wardsCache.get(districtId) || []) : []);
    const [villages, setVillages] = useState<LocationVillage[]>(wardId ? (villagesCache.get(wardId) || []) : []);
    const [loadingRegions, setLoadingRegions] = useState(!regionsCache.value);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);
    const [loadingVillages, setLoadingVillages] = useState(false);

    useEffect(() => {
        let active = true;

        setLoadingRegions(!regionsCache.value);
        void loadRegionsCached()
            .then((items) => {
                if (active) {
                    setRegions(items);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingRegions(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        if (!regionId) {
            setDistricts([]);
            return () => {
                active = false;
            };
        }

        setDistricts(districtsCache.get(regionId) || []);
        setLoadingDistricts(!districtsCache.has(regionId));
        void loadDistrictsCached(regionId)
            .then((items) => {
                if (active) {
                    setDistricts(items);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingDistricts(false);
                }
            });

        return () => {
            active = false;
        };
    }, [regionId]);

    useEffect(() => {
        let active = true;

        if (!districtId) {
            setWards([]);
            return () => {
                active = false;
            };
        }

        setWards(wardsCache.get(districtId) || []);
        setLoadingWards(!wardsCache.has(districtId));
        void loadWardsCached(districtId)
            .then((items) => {
                if (active) {
                    setWards(items);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingWards(false);
                }
            });

        return () => {
            active = false;
        };
    }, [districtId]);

    useEffect(() => {
        let active = true;

        if (!wardId) {
            setVillages([]);
            return () => {
                active = false;
            };
        }

        setVillages(villagesCache.get(wardId) || []);
        setLoadingVillages(!villagesCache.has(wardId));
        void loadVillagesCached(wardId)
            .then((items) => {
                if (active) {
                    setVillages(items);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingVillages(false);
                }
            });

        return () => {
            active = false;
        };
    }, [wardId]);

    const regionOptions = useMemo(
        () => regions.map((item) => ({ value: item.id, label: item.name })),
        [regions]
    );
    const districtOptions = useMemo(
        () => districts.map((item) => ({ value: item.id, label: item.name })),
        [districts]
    );
    const wardOptions = useMemo(
        () => wards.map((item) => ({ value: item.id, label: item.name })),
        [wards]
    );
    const villageOptions = useMemo(
        () => villages.map((item) => ({ value: item.id, label: item.name })),
        [villages]
    );

    return {
        regions,
        districts,
        wards,
        villages,
        regionOptions,
        districtOptions,
        wardOptions,
        villageOptions,
        loadingRegions,
        loadingDistricts,
        loadingWards,
        loadingVillages
    };
}
