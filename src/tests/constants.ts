/* eslint-disable jest/no-export */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable jest/expect-expect */
/* eslint-disable jest/no-disabled-tests */

import { IFetchBalanceResponse } from '../interfaces';
import { DEFAULT_GENESIS_HASH_SPEC } from '../mgmt';

export type IAddressListTest = {
    [key: string]: {
        public_key: string;
        secret_key: string;
        address_version: null;
    };
};

export const CONFIG = {
    mempoolHost: 'https://mempool.aiblock.dev',
    storageHost: 'https://storage.aiblock.dev',
    intercomHost: 'http://0.0.0.0:3030',
    passphrase: 'test',
};

export const SEED = 'army van defense carry jealous true garbage claim echo media make crunch';
export const SEED2 =
    'exchange shoe gesture useful chapter tired used veteran echo require offer grow';

export const MK = {
    nonce: '9868f40d-7b97-47c9-ad32-',
    save: 'X/0ry5n0jff2pzj8Ew3j+Doy+vmTMA8KBFbc5AYIJWfaN26KeEIXgMSR7zGg31whkiNT5ROeyBkcWfEvecXdea2iCmc6+diW5Upp8rzhVaLlaMUiO6PsatgmbQfg5L1g9Z/gq5XaCdMeIyJRG16O6SL/x6SHpri2FfY3J4ZhDg==',
};

export const ADDRESS_LIST_TEST: IAddressListTest = {
    cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c: {
        public_key: '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
        secret_key:
            '787072763976443650373355356b444a7164326d344b64525335466f6654456e5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
        address_version: null,
    },
    f226b92e6868e178f722e9cf71ad2a0c16d864c5d8fcadc70153bbd021f11ea0: {
        public_key: '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
        secret_key:
            '787072763976443650373355356b444a7346385875626f4e5667526a4472366358272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
        address_version: null,
    },
    '9b28bf45e5e5285a8eb10003046f5ed48571903ea767915acf0fe77e257b43fa': {
        public_key: 'efa9dcba0f3282b3ed4a6aa1ccdb169d6685a30d7b2af7a2171a5682f3112359',
        secret_key:
            '787072763976443650373355356b444a7545555a35434479585a535038417558efa9dcba0f3282b3ed4a6aa1ccdb169d6685a30d7b2af7a2171a5682f3112359',
        address_version: null,
    },
};

export const FETCH_BALANCE_RESPONSE_TEST: IFetchBalanceResponse = {
    total: {
        tokens: 1060,
        items: { default_genesis_hash_spec: 3 },
    },
    address_list: {
        cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c: [
            {
                out_point: {
                    t_hash: '000000',
                    n: 0,
                },
                value: {
                    Token: 10,
                },
            },
            {
                out_point: {
                    t_hash: '000000',
                    n: 1,
                },
                value: {
                    Item: {
                        amount: 3,
                        genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                        metadata: "{'test': 'test'}",
                    },
                },
            },
        ],
        f226b92e6868e178f722e9cf71ad2a0c16d864c5d8fcadc70153bbd021f11ea0: [
            {
                out_point: {
                    t_hash: '000001',
                    n: 0,
                },
                value: {
                    Token: 50,
                },
            },
        ],
        '9b28bf45e5e5285a8eb10003046f5ed48571903ea767915acf0fe77e257b43fa': [
            {
                out_point: {
                    t_hash: '000002',
                    n: 0,
                },
                value: {
                    Token: 1000,
                },
            },
        ],
    },
};
