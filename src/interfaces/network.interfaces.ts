/* -------------------------------------------------------------------------- */
/*                                 API Routes                                 */
/* -------------------------------------------------------------------------- */

import {
    IAssetItem,
    IAssetToken,
    ICreateTransaction,
    ICreateTransactionEncrypted,
    IDruidDroplet,
    IDruidExpectation,
    IGenericKeyPair,
    IKeypair,
    IKeypairEncrypted,
    IMasterKeyEncrypted,
    INewWalletResponse,
    IOutPoint,
    ITransaction,
} from './general.interfaces';

// Response structure returned from `Wallet` methods
export type IClientResponse = {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    content?: IContentType;
};

// `content` field of `IClientResponse`
export type IContentType = {
    newDRUIDResponse?: string;
    newSeedPhraseResponse?: string;
    getSeedPhraseResponse?: string;
    make2WayPaymentResponse?: IMakeIbPaymentResponse;
    newKeypairResponse?: IKeypairEncrypted;
    getMasterKeyResponse?: IMasterKeyEncrypted;
    initNewResponse?: INewWalletResponse;
    fromSeedResponse?: IMasterKeyEncrypted;
    regenWalletResponse?: IKeypairEncrypted[];
    signMessageResponse?: IGenericKeyPair<string>;
    decryptKeypairResponse?: IKeypair;
    saveKeypairResponse?: string[];
    getKeypairsResponse?: IKeypairEncrypted[];
} & IApiContentType;

// Content received from mempool node / valence server API endpoints
export type IApiContentType = {
    fetchBalanceResponse?: IFetchBalanceResponse;
    createItemResponse?: ICreateItemResponse;
    fetchPending2WResponse?: IPending2WTxDetails;
    debugDataResponse?: IDebugDataResponse;
    fetchTransactionsResponse?: IFetchTransactionsResponse;
    makePaymentResponse?: IMakePaymentResponse;
};

export enum IAPIRoute {
    /* ------------------------------- MEMPOOL Network Routes ------------------------------- */
    DebugData = '/debug_data',
    FetchBalance = '/fetch_balance',
    CreateTransactions = '/create_transactions',
    CreateItemAsset = '/create_item_asset',
    FetchPending = '/fetch_pending',
    /* --------------------------- Storage Network Routes --------------------------- */
    BlockchainEntry = '/blockchain_entry',
    /* ----------------------------- Valence Routes ---------------------------- */
    ValenceSet = '/set_data',
    ValenceGet = '/get_data',
    ValenceDel = '/del_data',
}

/* -------------------------------------------------------------------------- */
/*                               Network Interfaces                               */
/* -------------------------------------------------------------------------- */

/* --------------------------- Response Structures -------------------------- */

// Response structure received from mempool API endpoints
export type INetworkResponse = {
    id?: string;
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown';
    reason?: string;
    route?: string;
    content?: IApiContentType | any;
};

export type IApiCreateTxResponse = IGenericKeyPair<[string, IApiAsset]>; // Transaction hash - (public key address, asset paid);

export type IApiAsset = {
    asset: IAssetToken | IAssetItem;
    metadata: number[] | null;
};

export type IMakePaymentResponse = {
    transactionHash: string;
    paymentAddress: string;
    asset: IAssetToken | IAssetItem;
    metadata: number[] | null;
    usedAddresses: string[];
};

export type IFetchTransactionsResponse = (ITransaction | string)[][];

// `/debug_data` endpoint response
export type IDebugDataResponse = {
    node_type: string;
    node_api: string[];
    node_peers: string[];
    routes_pow: IGenericKeyPair<number>;
};

// `/fetch_balance` endpoint response
export type IFetchBalanceResponse = {
    total: {
        tokens: number;
        items: IGenericKeyPair<number>;
    };
    address_list: IGenericKeyPair<{ out_point: IOutPoint; value: IAssetItem | IAssetToken }[]>;
};

// `/create_item_asset` endpoint response
export type ICreateItemResponse = {
    asset: {
        asset: IAssetItem;
        metadata: number[] | null;
    };
    to_address: string;
    tx_hash: string;
};

// `/fetch_pending` endpoint response
export type IFetchPending2WayResponse = {
    pending_transactions: { [key: string]: IDruidDroplet[] };
};

/* --------------------------- Payload Structures --------------------------- */

export enum IGenesisHashSpecification {
    Create = 'Create',
    Default = 'Default',
}

// `/create_item_asset` payload structure
export type IItemCreationAPIPayload = {
    item_amount: number;
    script_public_key: string;
    public_key: string;
    signature: string;
    version: number | null;
    genesis_hash_spec: IGenesisHashSpecification;
};
// `/create_transactions` payload structure
export type ICreateTxPayload = {
    createTx: ICreateTransaction;
    excessAddressUsed: boolean;
    usedAddresses: string[];
};

/* -------------------------------------------------------------------------- */
/*                          Valence Interfaces                                */
/* -------------------------------------------------------------------------- */

export type IRequestValenceResponse = {
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown';
    reason?: string;
    route?: string;
    content?: IApiContentType;
};

export type IRequestValenceSetBody<T> = {
    address: string;
    data: T;
};

export type IRequestValenceDelBody = {
    key: string;
    field: string;
    publicKey: string;
    signature: string;
};

export type IRequestValenceGetBody = {
    key: string;
    publicKey: string;
    signature: string;
};

// NOTE: This data structure can be changed to anything and it will still be supported by the valence server
export type IPending2WTxDetails = {
    druid: string; // Value to bind transactions together
    senderExpectation: IDruidExpectation;
    receiverExpectation: IDruidExpectation;
    status: 'pending' | 'rejected' | 'accepted'; // Status of the 2 way transaction
    mempoolHost: string; // Correlation between clients; send txs to the same mempool node; chosen by the sender
};

/* -------------------------------------------------------------------------- */
/*                     Wallet Response Interfaces                    */
/* -------------------------------------------------------------------------- */
// Make item-based payment response
export type IMakeIbPaymentResponse = {
    druid: string;
    encryptedTx: ICreateTransactionEncrypted;
};
