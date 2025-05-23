import axios from 'axios';

import {
    IAPIRoute,
    IAssetItem,
    IAssetToken,
    IClientConfig,
    IClientResponse,
    ICreateTransaction,
    ICreateTransactionEncrypted,
    IDruidExpectation,
    IErrorInternal,
    IGenericKeyPair,
    IKeypairEncrypted,
    IMasterKeyEncrypted,
    INetworkResponse,
    IPending2WResponse,
    IPending2WTxDetails,
    IRequestValenceResponse,
    ISuccessInternal,
} from '../interfaces';
import {
    constructTxInsAddress,
    createPaymentTx,
    create2WTxHalf,
    createItemPayload,
    DEFAULT_HEADERS,
    ITEM_DEFAULT,
    SEED_REGEN_THRES,
} from '../mgmt';
import {
    castAPIStatus,
    createIdAndNonceHeaders,
    initIAssetItem,
    initIAssetToken,
    throwIfErr,
    transformCreateTxResponseFromNetwork,
} from '../utils';
import { generateValenceSetBody, generateVerificationHeaders } from '../utils/valence.utils';
import {
    handleValidationFailures,
    validateAddress,
    validateConfig,
    validateMasterKey,
    validateSeedphrase,
    validateTransactionHash,
    validateMetadata,
    validateKeypairEncrypted,
    validateURL,
} from '../utils/validations.utils';
import { mgmtClient } from './mgmt.service';
import { ADDRESS_VERSION } from '../mgmt/constants';

export class Wallet {
    /* -------------------------------------------------------------------------- */
    /*                              Member Variables                              */
    /* -------------------------------------------------------------------------- */
    private mempoolHost: string | undefined;
    private storageHost: string | undefined;
    private valenceHost: string | undefined;
    private keyMgmt: mgmtClient | undefined;
    private mempoolRoutesPoW: Map<string, number> | undefined;
    private storageRoutesPoW: Map<string, number> | undefined;

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */
    constructor() {
        this.mempoolHost = undefined;
        this.storageHost = undefined;
        this.valenceHost = undefined;
        this.keyMgmt = undefined;
        this.mempoolRoutesPoW = undefined;
        this.storageRoutesPoW = undefined;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 Wallet Init                                */
    /* -------------------------------------------------------------------------- */

    /**
     *
     * Initialize a new instance of the client without providing a master key or seed phrase
     *
     * @param {IClientConfig} config - Additional configuration parameters
     * @param initOffline - Optionally initialize the client without initializing network settings
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    public async initNew(config: IClientConfig, initOffline = false): Promise<IClientResponse> {
        const valid = validateConfig(config);
        if (valid.error) {
            return handleValidationFailures([valid.error]);
        }

        this.keyMgmt = new mgmtClient();
        const initIResult = this.keyMgmt.initNew(config.passphrase);

        if (!initOffline) {
            const initNetworkIResult = await this.initNetwork(config);
            if (initNetworkIResult.status === 'error') {
                return initNetworkIResult; // Return network error
            }
        }
        if (initIResult.isErr()) {
            return {
                status: 'error',
                reason: initIResult.error, // Return initialization error
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: ISuccessInternal.ClientInitialized,
                content: {
                    initNewResponse: initIResult.value,
                },
            } as IClientResponse;
        }
    }

    /**
     * Initialize an instance of the client with a provided master key
     *
     * @param {IMasterKeyEncrypted} masterKey - Master key
     * @param {IClientConfig} config - Additional configuration parameters
     * @param initOffline - Optionally initialize the client without initializing network settings
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    public async fromMasterKey(
        masterKey: IMasterKeyEncrypted,
        config: IClientConfig,
        initOffline = false,
    ): Promise<IClientResponse> {
        const validConfig = validateConfig(config);
        const validMasterKey = validateMasterKey(masterKey);
        if (validConfig.error || validMasterKey.error) {
            return handleValidationFailures([validConfig.error, validMasterKey.error]);
        }

        this.keyMgmt = new mgmtClient();
        const initIResult = this.keyMgmt.fromMasterKey(masterKey, config.passphrase);
        if (!initOffline) {
            const initNetworkIResult = await this.initNetwork(config);
            if (initNetworkIResult.status === 'error') {
                return initNetworkIResult; // Return network error
            }
        }
        if (initIResult.isErr()) {
            return {
                status: 'error',
                reason: initIResult.error, // Return initialization error
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: ISuccessInternal.ClientInitialized,
            } as IClientResponse;
        }
    }

    /**
     * Initialize an instance of the wallet with a provided seed phrase
     *
     * @param {string} seedPhrase - Seed phrase
     * @param {IClientConfig} config - Additional configuration parameters
     * @param initOffline - Optionally initialize the client without initializing network settings
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    public async fromSeed(
        seedPhrase: string,
        config: IClientConfig,
        initOffline = false,
    ): Promise<IClientResponse> {
        console.log('[Wallet.fromSeed] Validating inputs...'); // Log 1
        const validConfig = validateConfig(config);
        const validSeedphrase = validateSeedphrase(seedPhrase);
        console.log('[Wallet.fromSeed] validConfig:', JSON.stringify(validConfig, null, 2)); // Log 2
        console.log('[Wallet.fromSeed] validSeedphrase:', JSON.stringify(validSeedphrase, null, 2)); // Log 3

        if (validConfig.error || validSeedphrase.error) {
            console.log('[Wallet.fromSeed] Validation FAILED. Calling handleValidationFailures.'); // Log 4
            return handleValidationFailures([validConfig.error, validSeedphrase.error]);
        }

        console.log('[Wallet.fromSeed] Validation PASSED. Initializing mgmtClient...'); // Log 5
        this.keyMgmt = new mgmtClient();
        const initIResult = this.keyMgmt.fromSeed(seedPhrase, config.passphrase);
        if (!initOffline) {
            const initNetworkIResult = await this.initNetwork(config);
            if (initNetworkIResult.status === 'error') {
                return initNetworkIResult; // Return network error
            }
        }
        if (initIResult.isErr()) {
            return {
                status: 'error',
                reason: initIResult.error, // Return initialization error
            } as IClientResponse;
        }

        return {
            status: 'success',
            reason: ISuccessInternal.ClientInitialized,
            content: {
                fromSeedResponse: initIResult.value,
            },
        } as IClientResponse;
    }

    /**
     * Common network initialization (retrieval of PoW list for compute and storage)
     *
     * @param {IClientConfig} config - Configuration parameters
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    public async initNetwork(config: IClientConfig): Promise<IClientResponse> {
        const validConfig = validateConfig(config);
        if (validConfig.error) {
            return handleValidationFailures([validConfig.error]);
        }

        this.mempoolHost = config.mempoolHost;
        this.storageHost = config.storageHost;
        this.valenceHost = config.valenceHost;

        if (this.mempoolHost === undefined)
            return {
                status: 'error',
                reason: IErrorInternal.NoComputeHostProvided,
            } as IClientResponse;

        // Initialize routes proof-of-work for compute host
        this.mempoolRoutesPoW = new Map();
        const initComputeResult = await this.initNetworkForHost(
            this.mempoolHost,
            this.mempoolRoutesPoW,
        );
        if (initComputeResult.status === 'error') return initComputeResult;

        // Optional - Initialize routes proof-of-work for storage host
        if (this.storageHost !== undefined) {
            this.storageRoutesPoW = new Map();
            const initStorageResult = await this.initNetworkForHost(
                this.storageHost,
                this.storageRoutesPoW,
            );
            if (initStorageResult.status === 'error') return initStorageResult;
        }

        if (
            this.mempoolHost === undefined &&
            this.storageHost === undefined &&
            this.valenceHost === undefined
        )
            return {
                status: 'error',
                reason: IErrorInternal.NoHostsProvided,
            } as IClientResponse;

        return {
            status: 'success',
        } as IClientResponse;
    }

    /**
     * Fetch balance for an address list from the UTXO set
     *
     * @param {string[]} addressList - A list of public addresses
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async fetchBalance(addressList: string[]): Promise<IClientResponse> {
        const validAddresses = addressList.map((address) => validateAddress(address));
        if (validAddresses.find((address) => address.error)) {
            return handleValidationFailures(validAddresses.map((address) => address.error));
        }

        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.FetchBalance,
            );
            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.FetchBalance}`,
                    addressList,
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            fetchBalanceResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    console.log(`Error calling /fetch_balance: ${error}`);
                    throw new Error('Unable to fetch balance from mempool successfully');
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Fetch transactions from the storage host
     *
     * @param {string[]} transactionHashes - An array of transaction hashes
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async fetchTransactions(transactionHashes: string[]): Promise<IClientResponse> {
        const validHashes = transactionHashes.map((hash) => validateTransactionHash(hash));
        if (validHashes.find((hash) => hash.error)) {
            return handleValidationFailures(validHashes.map((hash) => hash.error));
        }

        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.storageHost || !this.storageRoutesPoW)
                /* Storage is optional on wallet init, but must be initialized here */
                throw new Error(IErrorInternal.StorageNotInitialized);
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.FetchBalance,
            );
            return await axios
                .post<INetworkResponse>(
                    `${this.storageHost}${IAPIRoute.BlockchainEntry}`,
                    transactionHashes,
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            fetchTransactionsResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    console.log(`Error calling /blockchain_entry: ${error}`);
                    throw new Error('Unable to fetch blockchain entry from storage successfully');
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     *  Create item-assets for a provided address/key-pair
     *
     * @param {IKeypairEncrypted} address - Key-pair to use for the creation of the item-assets
     * @param {boolean} [defaultGenesisHash=true] - Whether to create `Item` assets that contain the default genesis tx hash identifier
     * @param {number} [amount=ITEM_DEFAULT] - The amount of `Item` assets to create
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async createItems(
        address: IKeypairEncrypted,
        defaultGenesisHash = true,
        amount: number = ITEM_DEFAULT,
        metadata: string | null = null,
    ): Promise<IClientResponse> {
        const validMetadata = metadata ? validateMetadata(metadata) : { error: undefined };
        if (validMetadata.error) {
            return handleValidationFailures([validMetadata.error]);
        }

        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPair = throwIfErr(this.keyMgmt.decryptKeypair(address));
            // Create item-creation transaction
            const createItemBody = throwIfErr(
                createItemPayload(
                    keyPair.secretKey,
                    keyPair.publicKey,
                    keyPair.version,
                    amount,
                    defaultGenesisHash,
                    metadata,
                ),
            );
            // Generate needed headers
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.CreateItemAsset,
            );
            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.CreateItemAsset}`,
                    createItemBody,
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            createItemResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    console.log(`Error calling /create_item_asset: ${error}`);
                    throw new Error('Unable to create Item asset on mempool successfully');
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Sign a given message with an array of key-pairs
     *
     * @param {IKeypairEncrypted[]} keyPairsToSignWith - Key-pairs to use in the signing process
     * @param {string} message - The message to sign
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    signMessage(keyPairsToSignWith: IKeypairEncrypted[], message: string): IClientResponse {
        // Perform validation checks
        const validKeypairs = keyPairsToSignWith.map((keypair) =>
            validateKeypairEncrypted(keypair),
        );
        if (validKeypairs.find((keypair) => keypair.error)) {
            return handleValidationFailures(validKeypairs.map((keypair) => keypair.error));
        }

        // Otherwise handle the response
        try {
            if (this.keyMgmt === undefined) throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPairs = throwIfErr(this.keyMgmt.decryptKeypairs(keyPairsToSignWith));
            const signatures = throwIfErr(this.keyMgmt.signMessage(keyPairs, message));
            return {
                status: 'success',
                reason: ISuccessInternal.MessageSigned,
                content: {
                    signMessageResponse: signatures,
                },
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    verifyMessage(
        message: string,
        signatures: IGenericKeyPair<string>,
        keyPairs: IKeypairEncrypted[],
    ): IClientResponse {
        // Perform validation checks
        const validKeypairs = keyPairs.map((keypair) => validateKeypairEncrypted(keypair));

        if (validKeypairs.find((keypair) => keypair.error)) {
            return handleValidationFailures(validKeypairs.map((keypair) => keypair.error));
        }

        // Otherwise handle the response
        try {
            if (this.keyMgmt === undefined) throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPairsUnencrypted = throwIfErr(this.keyMgmt.decryptKeypairs(keyPairs));
            throwIfErr(this.keyMgmt.verifyMessage(message, signatures, keyPairsUnencrypted));
            return {
                status: 'success',
                reason: ISuccessInternal.MessageVirified,
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Make a payment of a specified token amount to a payment address
     *
     * @param {string} paymentAddress - Address to make the payment to
     * @param {number} paymentAmount - The amount of `Token` assets to pay
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} excessKeypair - A key-pair provided to assign excess `Token` assets to (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    async makeTokenPayment(
        paymentAddress: string,
        paymentAmount: number,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
        locktime = 0,
    ): Promise<IClientResponse> {
        // Perform validation checks
        const validAddress = validateAddress(paymentAddress);
        const validExcessKeypair = validateKeypairEncrypted(excessKeypair);
        const validKeypairs = allKeypairs.map((keypair) => validateKeypairEncrypted(keypair));

        if (
            validAddress.error ||
            validExcessKeypair.error ||
            validKeypairs.find((keypair) => keypair.error)
        ) {
            return handleValidationFailures([
                validAddress.error,
                validExcessKeypair.error,
                ...validKeypairs.map((keypair) => keypair.error),
            ]);
        }

        // Otherwise handle the response
        const paymentAsset = initIAssetToken({ Token: paymentAmount });
        return this.makePayment(paymentAddress, paymentAsset, allKeypairs, excessKeypair, locktime);
    }

    /**
     * Make a `Item` payment of a specified amount and `genesis_hash`
     *
     * @param {string} paymentAddress - Address to make the payment to
     * @param {number} paymentAmount - Payment amount
     * @param {string} genesisHash - Genesis transaction hash
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} excessKeypair - Key-pair (encrypted) to assign excess funds to
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    async makeItemPayment(
        paymentAddress: string,
        paymentAmount: number,
        genesisHash: string,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
        metadata: string | null = null,
        locktime = 0,
    ): Promise<IClientResponse> {
        // Perform validation checks
        const validAddress = validateAddress(paymentAddress);
        const validGenesisHash = validateTransactionHash(genesisHash);
        const validExcessKeypair = validateKeypairEncrypted(excessKeypair);
        const validMetadata = metadata ? validateMetadata(metadata) : { error: undefined };
        const validKeypairs = allKeypairs.map((keypair) => validateKeypairEncrypted(keypair));

        if (
            validAddress.error ||
            validGenesisHash.error ||
            validExcessKeypair.error ||
            validMetadata.error ||
            validKeypairs.find((keypair) => keypair.error)
        ) {
            return handleValidationFailures([
                validAddress.error,
                validGenesisHash.error,
                validExcessKeypair.error,
                validMetadata.error,
                ...validKeypairs.map((keypair) => keypair.error),
            ]);
        }

        // Otherwise handle the response
        const paymentAsset = initIAssetItem({
            Item: { amount: paymentAmount, genesis_hash: genesisHash, metadata },
        });
        return this.makePayment(paymentAddress, paymentAsset, allKeypairs, excessKeypair, locktime);
    }

    /**
     * Regenerates the addresses for a newly imported wallet (from seed phrase)
     *
     * @param seedPhrase
     * @param {string[]} addressList - A list of addresses to regenerate
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES] - Regeneration threshold
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    async regenAddresses(
        seedPhrase: string,
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Promise<IClientResponse> {
        // Perform validation checks
        const validSeedphrase = validateSeedphrase(seedPhrase);
        const validAddresses = addressList.map((address) => validateAddress(address));
        if (validSeedphrase.error || validAddresses.find((address) => address.error)) {
            return handleValidationFailures([
                validSeedphrase.error,
                ...validAddresses.map((address) => address.error),
            ]);
        }

        // Regenerate addresses
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            const foundAddr = throwIfErr(
                this.keyMgmt.regenAddresses(seedPhrase, addressList, seedRegenThreshold),
            );
            if (foundAddr.length !== 0) {
                const encryptedKeypairs: IKeypairEncrypted[] = [];
                for (const addr of foundAddr) {
                    const encryptedKeypair = throwIfErr(this.keyMgmt.encryptKeypair(addr));
                    encryptedKeypairs.push(encryptedKeypair);
                }
                return {
                    status: 'success',
                    reason: ISuccessInternal.AddressesReconstructed,
                    content: {
                        regenWalletResponse: encryptedKeypairs,
                    },
                } as IClientResponse;
            } else throw new Error(IErrorInternal.UnableToFindNonEmptyAddresses);
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Generates a new key-pair
     *
     * @param {string[]} allAddresses - A list of all public addresses (used to avoid re-generating the same key-pair)
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    getNewKeypair(
        allAddresses: string[],
        addressVersion: null | number = ADDRESS_VERSION,
    ): IClientResponse {
        const validAddresses = allAddresses.map((address) => validateAddress(address));
        if (validAddresses.find((address) => address.error)) {
            return handleValidationFailures(validAddresses.map((address) => address.error));
        }

        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.NewAddressGenerated,
                content: {
                    newKeypairResponse: throwIfErr(
                        this.keyMgmt.getNewKeypair(allAddresses, addressVersion),
                    ),
                },
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Get the existing seed phrase, or generate a new one
     *
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    getSeedPhrase(): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.SeedPhraseObtained,
                content: {
                    getSeedPhraseResponse: throwIfErr(this.keyMgmt.getSeedPhrase()),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Get the existing master key in an encrypted format
     *
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    getMasterKey(): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.MasterKeyObtained,
                content: {
                    getMasterKeyResponse: throwIfErr(this.keyMgmt.getMasterKey()),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Decrypt an encrypted key-pair
     *
     * @param {IKeypairEncrypted} encryptedKeypair - Encrypted key-pair to decrypt
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    decryptKeypair(encryptedKeypair: IKeypairEncrypted): IClientResponse {
        const validKeypair = validateKeypairEncrypted(encryptedKeypair);
        if (validKeypair.error) {
            return handleValidationFailures([validKeypair.error]);
        }

        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.KeypairDecrypted,
                content: {
                    decryptKeypairResponse: throwIfErr(
                        this.keyMgmt.decryptKeypair(encryptedKeypair),
                    ),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Save keypairs to localStorage. (Browser)
     * It is recommended to use user defined methods for I/O operations (see https://github.com/AIBlockOfficial/2Way.js#getting-started)
     *
     * @param {IKeypairEncrypted} encryptedKeypair - Encrypted key-pair to save
     * @return {*} {void}
     */
    saveKeypairs(encryptedKeypair: IKeypairEncrypted[]): IClientResponse {
        const validKeypairs = encryptedKeypair.map((kp) => validateKeypairEncrypted(kp));
        if (validKeypairs.find((kp) => kp.error)) {
            return handleValidationFailures(validKeypairs.map((kp) => kp.error));
        }

        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            throwIfErr(this.keyMgmt.saveKeypairs(encryptedKeypair));
            return {
                status: 'success',
                reason: ISuccessInternal.KeypairSaved,
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Get keypairs from localStorage. (Browser)
     * It is recommended to use user defined methods for I/O operations (see https://github.com/AIBlockOfficial/2Way.js#getting-started)
     *
     * @export
     * @param {string} keypairs IKeypairEncrypted[] flattened to a string
     * @return {*} {void}
     */
    getKeypairs(): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.KeypairObtained,
                content: {
                    getKeypairsResponse: throwIfErr(this.keyMgmt.getKeypairs()),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                               2 Way payment                                */
    /* -------------------------------------------------------------------------- */

    /**
     * Make a 2 way payment to a specified address
     *
     * @param {string} paymentAddress - Address to make the payment to
     * @param {(IAssetItem | IAssetToken)} sendingAsset - The asset to pay
     * @param {(IAssetItem | IAssetToken)} receivingAsset - The asset to receive
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} receiveAddress - A key-pair to assign the "receiving" asset to
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async make2WayPayment(
        paymentAddress: string,
        sendingAsset: IAssetItem | IAssetToken,
        receivingAsset: IAssetItem | IAssetToken,
        allKeypairs: IKeypairEncrypted[],
        receiveAddress: IKeypairEncrypted,
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.valenceHost) throw new Error(IErrorInternal.ValenceNotInitialized);
            const senderKeypair = throwIfErr(this.keyMgmt.decryptKeypair(receiveAddress));
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);

            if (allAddresses.length === 0) throw new Error(IErrorInternal.NoKeypairsProvided);

            // Generate a DRUID value for this transaction
            const druid = throwIfErr(this.keyMgmt.getNewDRUID());

            const senderExpectation: IDruidExpectation = {
                from: '', // This field needs to be calculated by the other party and populated by us upon acceptance
                to: senderKeypair.address,
                asset: receivingAsset,
            };

            const receiverExpectation: IDruidExpectation = {
                from: '', // This is calculated by us after the transaction is created and then sent to the valence server
                to: paymentAddress,
                asset: sendingAsset,
            };

            // Create "sender" half transaction with some missing data in DruidExpectations objects (`from`)
            const send2WTxHalf = throwIfErr(
                create2WTxHalf(
                    balance.content.fetchBalanceResponse,
                    druid,
                    senderExpectation,
                    receiverExpectation,
                    senderKeypair.address,
                    keyPairMap,
                    0,
                ),
            );

            // Create transaction struct has successfully been created
            // now we encrypt the created transaction for storage
            const encryptedTx = throwIfErr(this.keyMgmt.encryptTransaction(send2WTxHalf.createTx));

            // Create "sender" details and expectations for valence server
            receiverExpectation.from = throwIfErr(
                constructTxInsAddress(send2WTxHalf.createTx.inputs),
            );
            if (send2WTxHalf.createTx.druid_info === null)
                throw new Error(IErrorInternal.NoDRUIDValues);

            // Generate the values to be placed on the valence server for the receiving party
            const valuePayload: IPending2WTxDetails = {
                druid,
                senderExpectation,
                receiverExpectation,
                status: 'pending', // Status of the 2 way transaction
                mempoolHost: this.mempoolHost,
            };

            const sendBody = generateValenceSetBody(paymentAddress, valuePayload, druid);
            const sendHeaders = generateVerificationHeaders(paymentAddress, senderKeypair);

            console.log(sendHeaders, sendBody);

            // Send the transaction details to the valence server for the receiving party to inspect
            return await axios
                .post<IRequestValenceResponse>(
                    `${this.valenceHost}${IAPIRoute.ValenceSet}`,
                    sendBody,
                    sendHeaders,
                )
                .then(() => {
                    // Payment now getting processed
                    return {
                        status: 'success',
                        reason: ISuccessInternal.TwoWayPaymentProcessing,
                        content: {
                            make2WayPaymentResponse: {
                                druid,
                                encryptedTx: encryptedTx,
                            },
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Fetch pending 2 way payments from the valence server
     *
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {ICreateTransactionEncrypted[]} allEncryptedTxs - A list of all existing saved transactions (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async fetchPending2WayPayment(
        keypair: IKeypairEncrypted,
        allEncryptedTxs: ICreateTransactionEncrypted[] = [],
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.valenceHost) throw new Error(IErrorInternal.ValenceNotInitialized);

            // Generate a key-pair map
            const [, keyPairMap] = throwIfErr(this.keyMgmt.getAllAddressesAndKeypairMap([keypair]));

            // DRUID - Encrypted Transaction Mapping
            const encryptedTxMap = new Map<string, ICreateTransactionEncrypted>();
            allEncryptedTxs.forEach((tx) => encryptedTxMap.set(tx.druid, tx));

            const kp = throwIfErr(this.keyMgmt.decryptKeypair(keypair));
            const sendHeaders = generateVerificationHeaders(keypair.address, kp);

            // Get pending 2WT transactions
            const fetched2WTx = await axios
                .get<IRequestValenceResponse>(
                    `${this.valenceHost}${IAPIRoute.ValenceGet}`,
                    sendHeaders,
                )
                .then((response) => {
                    if (!response.data.content) throw new Error(IErrorInternal.NoContentReturned);
                    return response.data.content;
                })
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });

            // Get accepted and rejected 2 way transactions
            const accepted2WTxs: { key: string; value: IPending2WTxDetails }[] = [];
            const rejected2WTxs: { key: string; value: IPending2WTxDetails }[] = [];
            const twoWayDataToDelete: any[] = [];

            Object.entries(fetched2WTx).forEach(([key, value]) => {
                if ((value as IPending2WResponse).data.status === 'accepted') {
                    // temps fix bad content type on valence
                    accepted2WTxs.push({ key: key, value: (value as IPending2WResponse).data });
                } else if ((value as IPending2WResponse).data.status === 'rejected') {
                    rejected2WTxs.push({ key: key, value: (value as IPending2WResponse).data });
                }
            });

            // We have accepted 2 way payments to send to mempool
            if (Object.entries(accepted2WTxs).length > 0) {
                const transactionsToSend: ICreateTransaction[] = [];
                for (const acceptedTx of Object.values(accepted2WTxs)) {
                    // Decrypt transaction stored along with DRUID value
                    const encryptedTx = encryptedTxMap.get(acceptedTx.value.druid);
                    if (!encryptedTx) throw new Error(IErrorInternal.InvalidDRUIDProvided);
                    const decryptedTransaction = throwIfErr(
                        this.keyMgmt.decryptTransaction(encryptedTx),
                    );

                    // Ensure this transaction is actually a 2 way transaction
                    if (!decryptedTransaction.druid_info)
                        throw new Error(IErrorInternal.NoDRUIDValues);

                    // Set `from` address value from recipient by setting the entire expectation to the one received from the intercom server
                    decryptedTransaction.druid_info.expectations[0] =
                        acceptedTx.value.senderExpectation; /* There should be only one expectation in a 2 way payment */

                    // Add to list of transactions to send to mempool node
                    transactionsToSend.push(decryptedTransaction);
                    const keyPair = keyPairMap.get(acceptedTx.value.senderExpectation.to);
                    if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

                    twoWayDataToDelete.push(
                        generateVerificationHeaders(acceptedTx.value.senderExpectation.to, keyPair),
                    );
                }

                // Generate the required headers
                const headers = this.getRequestIdAndNonceHeadersForRoute(
                    this.mempoolRoutesPoW,
                    IAPIRoute.CreateTransactions,
                );

                // Send transactions to mempool for processing
                await axios
                    .post<INetworkResponse>(
                        // NB: Make sure we use the same mempool host when initializing all 2 way payments
                        `${this.mempoolHost}${IAPIRoute.CreateTransactions}`,
                        transactionsToSend,
                        { ...headers, validateStatus: () => true },
                    )
                    .then(async (response) => {
                        if (castAPIStatus(response.data.status) === 'error')
                            throw new Error(response.data.reason);
                    })
                    .catch(async (error) => {
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
                    });

                // Add rejected item-based transactions to delete list as well
                if (Object.entries(rejected2WTxs).length > 0) {
                    for (const rejectedTx of Object.values(rejected2WTxs)) {
                        const keyPair = keyPairMap.get(rejectedTx.value.senderExpectation.to);
                        if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);
                        twoWayDataToDelete.push(
                            generateVerificationHeaders(
                                rejectedTx.value.senderExpectation.to,
                                keyPair,
                            ),
                        );
                    }
                }

                // Delete item-based data from intercom since the information is no longer relevant (accepted and rejected txs)
                if (twoWayDataToDelete.length > 0)
                    for (const dataToDelete of twoWayDataToDelete) {
                        await axios
                            .delete(`${this.valenceHost}${IAPIRoute.ValenceDel}`, dataToDelete)
                            .catch(async (error) => {
                                if (error instanceof Error) throw new Error(error.message);
                                else throw new Error(`${error}`);
                            });
                    }
            }
            return {
                status: 'success',
                reason: ISuccessInternal.Pending2WPaymentsFetched,
                content: {
                    fetchPending2WResponse: fetched2WTx,
                },
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Handle a 2 way payment by either accepting or rejecting the payment
     *
     * @private
     * @param {string} druid - Unique DRUID value associated with this payment
     * @param {IResponseValence<IPending2WTxDetails>} pendingResponse - Pending 2 way payments response as received from the valence server
     * @param {('accepted' | 'rejected')} status - Status to se the payment to
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    private async handle2WTxResponse(
        druid: string,
        pendingResponse: IPending2WTxDetails,
        status: 'accepted' | 'rejected',
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.valenceHost) throw new Error(IErrorInternal.ValenceNotInitialized);
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);

            const txInfo = pendingResponse as any;

            // Get the key-pair assigned to this receiver address
            const receiverKeypair = keyPairMap.get(txInfo.receiverExpectation.to);
            if (!receiverKeypair) throw new Error(IErrorInternal.UnableToGetKeypair);

            // Set the status of the pending request
            txInfo.status = status;

            // Handle case for 'accepted'; create and send transaction to mempool node
            if (status === 'accepted') {
                const send2WTxHalf = throwIfErr(
                    // Sender expectation and receiver expectation context is switched
                    // in comparison to `make2WayPayment` since we are the receiving party
                    create2WTxHalf(
                        balance.content.fetchBalanceResponse,
                        druid,
                        txInfo.receiverExpectation, // What we expect from the other party
                        txInfo.senderExpectation, // What the other party can expect from us
                        receiverKeypair.address,
                        keyPairMap,
                        0,
                    ),
                );

                // Construct our 'from` address using our transaction inputs
                txInfo.senderExpectation.from = throwIfErr(
                    constructTxInsAddress(send2WTxHalf.createTx.inputs),
                );

                // Generate the required headers
                const headers = this.getRequestIdAndNonceHeadersForRoute(
                    this.mempoolRoutesPoW,
                    IAPIRoute.CreateTransactions,
                );

                // Send transaction to mempool to be added to the current DRUID pool
                await axios
                    .post<INetworkResponse>(
                        // We send this transaction to the mempool node specified by the sending party
                        `${txInfo.mempoolHost}${IAPIRoute.CreateTransactions}`,
                        [send2WTxHalf.createTx],
                        { ...headers, validateStatus: () => true },
                    )
                    .then((response) => {
                        if (castAPIStatus(response.data.status) !== 'success')
                            throw new Error(response.data.reason);
                    })
                    .catch(async (error) => {
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
                    });
            }

            // Send the updated status of the transaction on the valence server
            const sendBody = generateValenceSetBody(txInfo.senderExpectation.to, txInfo, druid);
            const sendHeaders = generateVerificationHeaders(
                txInfo.senderExpectation.to,
                receiverKeypair,
            );

            // Update the transaction details on the valence server
            await axios
                .post(`${this.valenceHost}${IAPIRoute.ValenceSet}`, sendBody, sendHeaders)
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });

            return {
                status: 'success',
                reason: ISuccessInternal.RespondedTo2WPayment,
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Accept a 2 way payment
     *
     * @param {string} druid - Unique DRUID value associated with a 2 way payment
     * @param {IResponseValence<IPending2WTxDetails>} pendingResponse - 2-Way transaction(s) information as received from the valence server
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async accept2WayPayment(
        druid: string,
        pendingResponse: IPending2WTxDetails,
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        return this.handle2WTxResponse(druid, pendingResponse, 'accepted', allKeypairs);
    }

    /**
     * Reject a 2 way payment
     *
     * @param {string} druid - Unique DRUID value associated with a 2 way payment
     * @param {IResponseValence<IPending2WTxDetails>} pendingResponse - 2-Way transaction(s) information as received from the valence server
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */

    public async reject2WayPayment(
        druid: string,
        pendingResponse: IPending2WTxDetails,
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        return this.handle2WTxResponse(druid, pendingResponse, 'rejected', allKeypairs);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Utils                                   */
    /* -------------------------------------------------------------------------- */

    /**
     * Common network initialization (retrieval of PoW list)
     *
     * @private
     * @param {IClientConfig} config - Additional configuration parameters
     * @return {*}  {IClientResponse}
     * @memberof Wallet
     */
    private async initNetworkForHost(
        host: string,
        routesPow: Map<string, number>,
    ): Promise<IClientResponse> {
        // Set routes proof-of-work requirements
        const debugData = await this.getDebugData(host);
        if (debugData.status === 'error')
            return {
                status: 'error',
                reason: debugData.reason,
            } as IClientResponse;
        else if (debugData.status === 'success' && debugData.content?.debugDataResponse)
            for (const route in debugData.content.debugDataResponse.routes_pow) {
                routesPow.set(route, debugData.content.debugDataResponse.routes_pow[route]);
            }
        return {
            status: 'success',
        } as IClientResponse;
    }

    /**
     * Make a payment of a certain asset to a specified destination
     *
     * @private
     * @param {string} paymentAddress - Address to make the payment to
     * @param {(IAssetToken | IAssetItem)} paymentAsset - The asset to send
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} excessKeypair - A key-pair (encrypted) to assign excess funds to
     * @return {*}
     * @memberof Wallet
     */
    private async makePayment(
        paymentAddress: string,
        paymentAsset: IAssetToken | IAssetItem,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
        locktime = 0,
    ) {
        // Perform validation checks
        const validPaymentAddress = validateAddress(paymentAddress);
        const validKeypairs = allKeypairs.map((kp) => validateKeypairEncrypted(kp));
        const validExcessKeypair = validateKeypairEncrypted(excessKeypair);

        if (
            validPaymentAddress.error ||
            validKeypairs.find((kp) => kp.error) ||
            validExcessKeypair.error
        ) {
            return handleValidationFailures([
                validPaymentAddress.error,
                ...validKeypairs.map((kp) => kp.error),
                validExcessKeypair.error,
            ]);
        }

        // Proceed with payment
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // First update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);

            // Get all existing addresses
            if (allKeypairs.length === 0) throw new Error(IErrorInternal.NoKeypairsProvided);

            // Create transaction
            const paymentBody = throwIfErr(
                createPaymentTx(
                    paymentAddress,
                    paymentAsset,
                    excessKeypair.address,
                    balance.content.fetchBalanceResponse,
                    keyPairMap,
                    locktime,
                ),
            );

            const { usedAddresses } = paymentBody;

            // Generate the needed headers
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.CreateTransactions,
            );

            // Send transaction to mempool for processing
            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.CreateTransactions}`,
                    [paymentBody.createTx],
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            makePaymentResponse: throwIfErr(
                                transformCreateTxResponseFromNetwork(
                                    usedAddresses,
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    response.data.content as any,
                                ),
                            ),
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    console.log(`Error calling /create_transactions: ${error}`);
                    throw new Error('Unable to create transactions on mempool successfully');
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Get information regarding the PoW required for all routes
     *
     * @private
     * @param {(string)} host - Host address to retrieve proof-of-work data from
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    private async getDebugData(host: string): Promise<IClientResponse> {
        const validHost = validateURL(host);
        if (validHost.error) return handleValidationFailures([validHost.error]);

        try {
            return await axios
                .get<INetworkResponse>(`${host}${IAPIRoute.DebugData}`)
                .then(async (response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            debugDataResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    console.log(`Error calling /debug_data: ${error}`);
                    throw new Error('Unable to fetch debug data from mempool successfully');
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Generate a unique request ID as well as the corresponding
     * nonce required for a route
     *
     * @private
     * @param {string} route
     * @return {*}  {{
     *         headers: {
     *             'x-cache-id': string;
     *             'x-nonce': number;
     *         };
     *     }}
     * @memberof Wallet
     */
    private getRequestIdAndNonceHeadersForRoute(
        routesPow: Map<string, number> | undefined,
        route: string,
    ): {
        headers: {
            'x-cache-id': string;
            'x-nonce': number;
        };
    } {
        if (!routesPow) throw new Error(IErrorInternal.ClientNotInitialized);
        const routeDifficulty = routesPow.get(route.slice(1)); // Slice removes the '/' prefix: ;
        return {
            headers: {
                ...DEFAULT_HEADERS.headers,
                ...createIdAndNonceHeaders(routeDifficulty).headers,
            },
        };
    }
}
