/*====== MISC =======*/

export const NETWORK_VERSION = 2; /* Always keep up to date with 2 Way network version! */
export const SEED_REGEN_THRES = 1000;
export const BAL_LIMIT = 10_000_000_000;
export const ADDRESS_VERSION_OLD = 1; /* Old (depreciated) address structure */
export const ADDRESS_VERSION = null; /* Always use `null` for latest address version */
export const TEMP_ADDRESS_VERSION = 99999; /* Depreciate after temporary addresses have retired */
export const ITEM_DEFAULT = 1000;
export const TOKEN_FRACTION = 25200;
export const DEFAULT_DRS_TX_HASH = 'default_drs_tx_hash';
export const DEFAULT_HEADERS = {
    headers: {
        'Content-Type': 'application/json',
    },
};
export const KEYPAIR_LOCAL_STORAGE = '2WayJS_KeypairLocalStorage';
