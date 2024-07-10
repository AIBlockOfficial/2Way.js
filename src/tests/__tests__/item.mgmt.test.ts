/* eslint-disable jest/no-conditional-expect */
import {
    IKeypair,
    IOutPoint,
    ICreateTxInScript,
    IGenesisHashSpecification,
} from '../../interfaces';
import {
    ADDRESS_VERSION,
    constructTxInsAddress,
    constructTxInSignableAssetHash,
    DEFAULT_GENESIS_HASH_SPEC,
    generateDRUID,
    getInputsForTx,
} from '../../mgmt';
import * as itemMgmt from '../../mgmt/item.mgmt';
import { ADDRESS_LIST_TEST, FETCH_BALANCE_RESPONSE_TEST } from '../constants';
import { initIAssetItem, initIAssetToken, initIDruidExpectation } from '../../utils';

test('creates a valid payload to create items', () => {
    const keypair = {
        publicKey: new Uint8Array([
            105, 254, 232, 28, 144, 69, 179, 94, 175, 4, 183, 75, 250, 121, 131, 97, 138, 8, 172,
            183, 25, 239, 141, 55, 73, 164, 240, 4, 162, 147, 202, 223,
        ]),
        secretKey: new Uint8Array([
            252, 186, 153, 105, 137, 147, 53, 80, 3, 89, 170, 69, 174, 112, 8, 199, 221, 139, 22,
            136, 61, 254, 142, 163, 154, 121, 146, 89, 231, 15, 152, 90, 105, 254, 232, 28, 144, 69,
            179, 94, 175, 4, 183, 75, 250, 121, 131, 97, 138, 8, 172, 183, 25, 239, 141, 55, 73,
            164, 240, 4, 162, 147, 202, 223,
        ]),
    };

    const payload = itemMgmt.createItemPayload(
        keypair.secretKey,
        keypair.publicKey,
        ADDRESS_VERSION,
    );

    const metadataPayload = itemMgmt.createItemPayload(
        keypair.secretKey,
        keypair.publicKey,
        ADDRESS_VERSION,
        1000,
        true,
        "{'test': 'test'}",
    );

    if (payload.isOk()) {
        expect(payload.value).toEqual({
            item_amount: 1000,
            public_key: '69fee81c9045b35eaf04b74bfa7983618a08acb719ef8d3749a4f004a293cadf',
            script_public_key: 'a0b08e623c6800bb27dddb5d6f6956939be674cfc63399dcc7b9f2e6733c02e5',
            signature:
                '277d56770697ba1f6cec5e859aa4dcdff0ec4a261c75408092d44a38e768461a45fc0a7964ecb4714eb2849b0cd4c43e107db76f8a62c6b783342a895889b80c',
            version: null,
            genesis_hash_spec:
                IGenesisHashSpecification.Default /* Create generic Item assets instead of a tracked Item assets */,
            metadata: null,
        });
    }

    if (metadataPayload.isOk()) {
        expect(metadataPayload.value).toEqual({
            item_amount: 1000,
            public_key: '69fee81c9045b35eaf04b74bfa7983618a08acb719ef8d3749a4f004a293cadf',
            script_public_key: 'a0b08e623c6800bb27dddb5d6f6956939be674cfc63399dcc7b9f2e6733c02e5',
            signature:
                '277d56770697ba1f6cec5e859aa4dcdff0ec4a261c75408092d44a38e768461a45fc0a7964ecb4714eb2849b0cd4c43e107db76f8a62c6b783342a895889b80c',
            version: null,
            genesis_hash_spec:
                IGenesisHashSpecification.Default /* Create generic Item assets instead of a tracked Item assets */,
            metadata: "{'test': 'test'}",
        });
    }
});

test('create transaction for the SEND portion of a 2 way payment', () => {
    const keyPairMap = new Map<string, IKeypair>();
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }

    const createTransaction = itemMgmt.create2WTxHalf(
        FETCH_BALANCE_RESPONSE_TEST,
        'full_druid',
        initIDruidExpectation({
            asset: {
                Item: {
                    amount: 1,
                    genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                    metadata: "{'test': 'test'}",
                },
            },
            from: 'their_from_value',
            to: 'our_receive_address',
        }),
        initIDruidExpectation({
            asset: {
                Token: 1050,
            },
            from: 'our_from_value',
            to: 'their_receive_address',
        }),
        'excess_address',
        keyPairMap,
        0,
    );

    if (createTransaction.isOk()) {
        const [createTx, usedAddresses] = [
            createTransaction.value.createTx,
            createTransaction.value.usedAddresses,
        ];
        // From here we assume the create transaction struct is created correctly
        expect(createTx).toBeDefined();
        if (createTx) {
            // Assert used addresses
            expect(usedAddresses).toStrictEqual([
                'cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c',
                'f226b92e6868e178f722e9cf71ad2a0c16d864c5d8fcadc70153bbd021f11ea0',
                '9b28bf45e5e5285a8eb10003046f5ed48571903ea767915acf0fe77e257b43fa',
            ]);

            // Assert TxOut values
            const txOuts = createTx?.outputs;
            expect(txOuts).toStrictEqual([
                {
                    value: { Token: 1050 } /* Amount payed */,
                    locktime: 0,
                    script_public_key: 'their_receive_address',
                },
                {
                    value: { Token: 10 } /* Change/excess */,
                    locktime: 0,
                    script_public_key: 'excess_address',
                },
            ]);

            // Assert previous outpoints in CreateTransaction struct
            const previousOuts: IOutPoint[] = Object.entries(createTx?.inputs)
                .map((i) => i[1].previous_out)
                .filter((input): input is IOutPoint => !!input);

            expect(previousOuts).toStrictEqual([
                {
                    n: 0,
                    t_hash: '000000',
                },
                {
                    n: 0,
                    t_hash: '000001',
                },
                {
                    n: 0,
                    t_hash: '000002',
                },
            ]);

            // Assert script signatures
            const script_signatures: ICreateTxInScript[] = Object.entries(createTx?.inputs)
                .map((i) => i[1].script_signature)
                .filter((input): input is ICreateTxInScript => !!input);

            expect(script_signatures).toStrictEqual([
                {
                    Pay2PkH: {
                        signable_data:
                            '39c7bcf3e5bb477898207c73efd558a0d87baa41b540977b452fe6f1cdc8419e',
                        signature:
                            '860b77cf4cda825ec7b395d7282d580049ee69f351076afd008af552ca78b35c1540d9e152d32726179077f9906264b962090aca8d2b3d425226b8832934730d',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            '554169479da2e0948f19152b1ea7feda04319f60273fcffe2d2f23efde9cca79',
                        signature:
                            '6a51d2554375f8c73c6888a151c131ff9ad5fbda938f2e02870b9394ce777f64be95e15eec351eaf256b795c28235f63c7d34e873df22d91f7e016b320448807',
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            'd36fdf205e6b3a5c3dc19a14b8398a656dabeb6db18d6046dbb7a734b4cb369f',
                        signature:
                            '57961d06470c0e029365d4962fc4ca8e8f54b47edea98c05d8c309f589a546381ddd98c90a00bf7cb377877d05aeecd60334b9e780ebddb78df27ddae7bea20e',
                        public_key:
                            'efa9dcba0f3282b3ed4a6aa1ccdb169d6685a30d7b2af7a2171a5682f3112359',
                        address_version: null,
                    },
                },
            ]);

            // Assert druid values
            const druid_values = createTx?.druid_info;
            if (druid_values !== null) {
                expect(druid_values).toStrictEqual({
                    druid: 'full_druid',
                    expectations: [
                        {
                            asset: {
                                Item: {
                                    amount: 1,
                                    genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                                    metadata: "{'test': 'test'}",
                                },
                            },
                            from: 'their_from_value',
                            to: 'our_receive_address',
                        },
                    ],
                    participants: 2,
                });
            }
        }
    }
});

test('create transaction for the RECEIVE portion of a 2 way payment', () => {
    const keyPairMap = new Map<string, IKeypair>();
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }

    const createTransaction = itemMgmt.create2WTxHalf(
        FETCH_BALANCE_RESPONSE_TEST,
        'full_druid',
        initIDruidExpectation({
            asset: {
                Token: 1060,
            },
            from: 'their_from_value',
            to: 'our_receive_address',
        }),
        initIDruidExpectation({
            asset: {
                Item: {
                    amount: 1,
                    genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                    metadata: null,
                },
            },
            from: 'our_from_value',
            to: 'their_receive_address',
        }),
        'excess_address',
        keyPairMap,
        0,
    );

    if (createTransaction.isOk()) {
        const [createTx, usedAddresses] = [
            createTransaction.value.createTx,
            createTransaction.value.usedAddresses,
        ];

        // From here we assume the create transaction struct is created correctly
        expect(createTx).toBeDefined();
        if (createTx) {
            // Assert used addresses
            expect(usedAddresses).toStrictEqual([
                'cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c' /* Only one address was used */,
            ]);

            // Assert TxOut values
            const txOuts = createTx?.outputs;
            expect(txOuts).toStrictEqual([
                {
                    value: {
                        Item: {
                            amount: 1,
                            genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                            metadata: null,
                        },
                    } /* Amount payed */,
                    locktime: 0,
                    script_public_key: 'their_receive_address',
                },
                {
                    value: {
                        Item: {
                            amount: 2,
                            genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                            metadata: null,
                        },
                    } /* Change/excess */,
                    locktime: 0,
                    script_public_key: 'excess_address',
                },
            ]);

            // Assert previous outpoints in CreateTransaction struct
            const previousOuts: IOutPoint[] = Object.entries(createTx?.inputs)
                .map((i) => i[1].previous_out)
                .filter((input): input is IOutPoint => !!input);

            expect(previousOuts).toStrictEqual([
                {
                    n: 1,
                    t_hash: '000000',
                },
            ]);

            // Assert script signatures
            const script_signatures: ICreateTxInScript[] = Object.entries(createTx?.inputs)
                .map((i) => i[1].script_signature)
                .filter((input): input is ICreateTxInScript => !!input);

            expect(script_signatures).toStrictEqual([
                {
                    Pay2PkH: {
                        signable_data:
                            '7221a1476f584201d2dc8514a899eb7e38bb32f5ae176abb61c709f1ee690b9e',
                        signature:
                            '3698b94d5d99b255d04e97c9c9e8d6acce12742aade05d3673b310e18484ea6b6f1a74eaedc42f35d5bcb4f65758ab3bad93c2c33702792814dbe67ea5225106',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
            ]);

            // Assert druid values
            const druid_values = createTx?.druid_info;
            if (druid_values !== null) {
                expect(druid_values).toStrictEqual({
                    druid: 'full_druid',
                    expectations: [
                        {
                            asset: { Token: 1060 },
                            from: 'their_from_value',
                            to: 'our_receive_address',
                        },
                    ],
                    participants: 2,
                });
            }
        }
    }
});

// NOTE: This test corresponds with `test_construct_valid_tx_ins_address` in Chain
test('create TxIns address used as `from` value in DdeValues', () => {
    const keyPairMap = new Map<string, IKeypair>();
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }
    const txInputs = getInputsForTx(
        initIAssetToken({ Token: 1050 }),
        FETCH_BALANCE_RESPONSE_TEST,
        keyPairMap,
    );

    if (txInputs.isOk()) {
        const ourFromAddress = constructTxInsAddress(txInputs.value.inputs).unwrapOr('');
        expect(ourFromAddress).toStrictEqual(
            'a709f0602a8a7297953243583f1080ec4e491fe8db640c4f88411ccb6e75c1d5',
        );
    }
});

//NOTE: This test corresponds with `test_construct_valid_tx_in_signable_asset_hash` in Chain
//TODO: Add test for `DataAsset` variant
test('creates a valid signable asset hash value', () => {
    const signableTxInAssetHashes: string[] = [
        constructTxInSignableAssetHash(initIAssetToken({ Token: 1 })),
        constructTxInSignableAssetHash(
            initIAssetItem({
                Item: {
                    amount: 1,
                    genesis_hash:
                        DEFAULT_GENESIS_HASH_SPEC /* Value is currently not used to generate signable hash */,
                    metadata: "{'test': 'test'}",
                },
            }),
        ),
    ];

    expect(signableTxInAssetHashes).toStrictEqual([
        'a5b2f5e8dcf824aee45b81294ff8049b680285b976cc6c8fa45eb070acfc5974',
        'cb8f6cba3a62cfb7cd14245f19509b800da3dd446b6d902290efbcc91b3cee0d',
    ]);
});

test('generates a valid DRUID', () => {
    const druid = generateDRUID();
    if (druid.isOk()) {
        expect(druid.value.slice(0, 5)).toBe('DRUID');
        expect(druid.value.length).toBe(39);
    }
});
