/* eslint-disable jest/expect-expect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    addLhsAssetToRhsAsset,
    assetsAreCompatible,
    calculateNonceForId,
    generateValenceSetBody,
    generateVerificationHeaders,
    getUniqueID,
    initIAssetItem,
    initIAssetToken,
    isOfTypeIAssetItem,
    isOfTypeIAssetToken,
    lhsAssetIsLessThanRhsAsset,
    subRhsAssetFromLhsAsset,
    throwIfErr,
    lhsAssetIsGreaterThanRhsAsset,
    lhsAssetIsEqOrGreaterThanRhsAsset,
} from '../../utils';
import { sha3_256 } from 'js-sha3';
import { IKeypair } from '../../interfaces';
import { DEFAULT_GENESIS_HASH_SPEC, DEFAULT_HEADERS } from '../../mgmt';
/* -------------------------------------------------------------------------- */
/*                           General Utilities Tests                          */
/* -------------------------------------------------------------------------- */

test('create valid proof-of-work', () => {
    const difficulty = 2;
    const id = getUniqueID();
    const nonce = calculateNonceForId(difficulty, id);
    expect(
        Array.from(Buffer.from(sha3_256(`${nonce}-${id}`), 'hex'))
            .slice(0, difficulty)
            .every((e) => e === 0),
    ).toBe(true);
});

/* -------------------------------------------------------------------------- */
/*                          Interface Utilities Tests                         */
/* -------------------------------------------------------------------------- */
test('validate asset type guards', () => {
    const assetToken_1 = initIAssetToken({ Token: 1 });
    const assetToken_2 = initIAssetToken({ Token: 2 });
    const assetItem_1 = initIAssetItem();
    const assetItem_2 = initIAssetItem({
        Item: { amount: 1, genesis_hash: 'unique_genesis_hash', metadata: "{'test': 'test'}" },
    });
    const assetItem_3 = initIAssetItem({
        Item: { amount: 2, genesis_hash: 'unique_genesis_hash', metadata: "{'test': 'test'}" },
    });
    const assetItem_4 = initIAssetItem({
        Item: { amount: 3, genesis_hash: DEFAULT_GENESIS_HASH_SPEC, metadata: "{'test': 'test'}" },
    });

    /* ------------------------- Individual type guards ------------------------- */
    expect(isOfTypeIAssetToken(assetToken_1)).toBe(true);
    expect(isOfTypeIAssetToken(assetToken_2)).toBe(true);
    expect(isOfTypeIAssetToken(assetItem_1)).toBe(false);
    expect(isOfTypeIAssetToken(assetItem_2)).toBe(false);
    expect(isOfTypeIAssetToken(assetItem_3)).toBe(false);
    expect(isOfTypeIAssetToken(assetItem_4)).toBe(false);
    expect(isOfTypeIAssetItem(assetToken_1)).toBe(false);
    expect(isOfTypeIAssetItem(assetToken_2)).toBe(false);
    expect(isOfTypeIAssetItem(assetItem_1)).toBe(true);
    expect(isOfTypeIAssetItem(assetItem_2)).toBe(true);
    expect(isOfTypeIAssetItem(assetItem_3)).toBe(true);
    expect(isOfTypeIAssetItem(assetItem_4)).toBe(true);

    /* -------------------------- Combined type guards -------------------------- */
    // Note: Infers correct operability of `assetsAreBothTokens`
    // and `assetsAreBothCompatibleItems` utility functions

    // All assets of type `Token` are compatible with each other
    expect(assetsAreCompatible(assetToken_1, assetToken_2)).toBe(true);
    expect(assetsAreCompatible(assetToken_1, assetToken_2)).toBe(true);
    expect(assetsAreCompatible(assetToken_2, assetToken_1)).toBe(true);
    expect(assetsAreCompatible(assetToken_2, assetToken_1)).toBe(true);

    // `Item` assets are only compatible if they exhibit the same `genesis_hash`
    expect(assetsAreCompatible(assetItem_1, assetItem_2)).toBe(false);
    expect(assetsAreCompatible(assetItem_1, assetItem_3)).toBe(false);
    expect(assetsAreCompatible(assetItem_1, assetItem_4)).toBe(true);
    expect(assetsAreCompatible(assetItem_2, assetItem_1)).toBe(false);
    expect(assetsAreCompatible(assetItem_2, assetItem_3)).toBe(true);
    expect(assetsAreCompatible(assetItem_2, assetItem_4)).toBe(false);
    expect(assetsAreCompatible(assetItem_3, assetItem_1)).toBe(false);
    expect(assetsAreCompatible(assetItem_3, assetItem_2)).toBe(true);
    expect(assetsAreCompatible(assetItem_3, assetItem_4)).toBe(false);
    expect(assetsAreCompatible(assetItem_4, assetItem_1)).toBe(true);
    expect(assetsAreCompatible(assetItem_4, assetItem_2)).toBe(false);
    expect(assetsAreCompatible(assetItem_4, assetItem_3)).toBe(false);

    // Assets of type `Token` and `Item` are never compatible
    expect(assetsAreCompatible(assetItem_1, assetToken_1)).toBe(false);
    expect(assetsAreCompatible(assetItem_2, assetToken_2)).toBe(false);
    expect(assetsAreCompatible(assetItem_3, assetToken_1)).toBe(false);
    expect(assetsAreCompatible(assetItem_4, assetToken_2)).toBe(false);
});

test('validate correct value amount and mathematical operation between assets', () => {
    /* ------------------------ `Token` assets operations ----------------------- */
    const assetToken_1 = initIAssetToken({ Token: 1 });
    const assetToken_2 = initIAssetToken({ Token: 10 });
    const assetToken_3 = initIAssetToken({ Token: 10 });

    /*
     * Success tests
     */
    // Subtract assetToken_1 from assetToken_2
    expect(throwIfErr(subRhsAssetFromLhsAsset(assetToken_2, assetToken_1))).toStrictEqual({
        Token: 9,
    });
    // Add assetToken_1 to assetToken_2
    expect(throwIfErr(addLhsAssetToRhsAsset(assetToken_2, assetToken_1))).toStrictEqual({
        Token: 11,
    });
    // Test assetToken_1 < assetToken_2
    expect(throwIfErr(lhsAssetIsLessThanRhsAsset(assetToken_1, assetToken_2))).toBe(true);
    // Test assetToken_2 > assetToken_1
    expect(throwIfErr(lhsAssetIsGreaterThanRhsAsset(assetToken_2, assetToken_1))).toBe(true);
    // Test assetToken_2 >= assetToken_3
    expect(throwIfErr(lhsAssetIsEqOrGreaterThanRhsAsset(assetToken_2, assetToken_3))).toBe(true);

    /*
     * Failure tests
     */
    // Subtract assetToken_3 from assetToken_1
    expect(subRhsAssetFromLhsAsset(assetToken_1, assetToken_3).isOk()).toBe(false);
    // Test assetToken_1 > assetToken_2
    expect(throwIfErr(lhsAssetIsLessThanRhsAsset(assetToken_2, assetToken_1))).toBe(false);
    // Test assetToken_2 < assetToken_1
    expect(throwIfErr(lhsAssetIsGreaterThanRhsAsset(assetToken_1, assetToken_2))).toBe(false);

    /* ----------------------- `Item` asset operations ----------------------- */
    const assetItem_1 = initIAssetItem({
        Item: { amount: 1, genesis_hash: DEFAULT_GENESIS_HASH_SPEC, metadata: "{'test': 'test'}" },
    });
    const assetItem_2 = initIAssetItem({
        Item: { amount: 10, genesis_hash: DEFAULT_GENESIS_HASH_SPEC, metadata: "{'test': 'test'}" },
    });
    const assetItem_3 = initIAssetItem({
        Item: { amount: 10, genesis_hash: DEFAULT_GENESIS_HASH_SPEC, metadata: "{'test': 'test'}" },
    });
    const assetItem_4 = initIAssetItem({
        Item: { amount: 1, genesis_hash: 'unique_genesis_hash', metadata: "{'test': 'test'}" },
    });
    const assetItem_5 = initIAssetItem({
        Item: { amount: 10, genesis_hash: 'unique_genesis_hash', metadata: "{'test': 'test'}" },
    });
    const assetItem_6 = initIAssetItem({
        Item: { amount: 10, genesis_hash: 'unique_genesis_hash', metadata: "{'test': 'test'}" },
    });

    /*
     * Success tests
     */
    // Subtract assetItem_1 from assetItem_2
    expect(throwIfErr(subRhsAssetFromLhsAsset(assetItem_2, assetItem_1))).toStrictEqual({
        Item: { amount: 9, genesis_hash: DEFAULT_GENESIS_HASH_SPEC, metadata: null },
    });
    // Add assetItem_1 to assetItem_2
    expect(throwIfErr(addLhsAssetToRhsAsset(assetItem_2, assetItem_1))).toStrictEqual({
        Item: { amount: 11, genesis_hash: DEFAULT_GENESIS_HASH_SPEC, metadata: "{'test': 'test'}" },
    });
    // Test assetItem_1 < assetItem_2
    expect(throwIfErr(lhsAssetIsLessThanRhsAsset(assetItem_1, assetItem_2))).toBe(true);
    // Test assetItem_2 > assetItem_1
    expect(throwIfErr(lhsAssetIsGreaterThanRhsAsset(assetItem_2, assetItem_1))).toBe(true);
    // Test assetItem_2 >= assetItem_3
    expect(throwIfErr(lhsAssetIsEqOrGreaterThanRhsAsset(assetItem_2, assetItem_3))).toBe(true);

    /*
     * Failure tests
     */
    // Subtract assetItem_3 from assetItem_1
    expect(subRhsAssetFromLhsAsset(assetItem_1, assetItem_3).isOk()).toBe(false); // Cannot have negative amount
    // Test assetItem_1 > assetItem_2
    expect(throwIfErr(lhsAssetIsLessThanRhsAsset(assetItem_2, assetItem_1))).toBe(false);
    // Test assetItem_2 < assetItem_1
    expect(throwIfErr(lhsAssetIsGreaterThanRhsAsset(assetItem_1, assetItem_2))).toBe(false);
    // Add assetItem_4 to assetItem_1
    expect(addLhsAssetToRhsAsset(assetItem_1, assetItem_4).isOk()).toBe(false); // Incompatibe `Item` types
    // Test assetItem_4 < assetItem_1
    expect(lhsAssetIsLessThanRhsAsset(assetItem_4, assetItem_1).isOk()).toBe(false); // Incompatibe `Item` types
    // Test assetItem_5 > assetItem_1
    expect(lhsAssetIsGreaterThanRhsAsset(assetItem_5, assetItem_2).isOk()).toBe(false); // Incompatibe `Item` types
    // Test assetItem_6 >= assetItem_1
    expect(lhsAssetIsEqOrGreaterThanRhsAsset(assetItem_6, assetItem_3).isOk()).toBe(false); // Incompatibe `Item` types

    /* ------------------------ Combined Asset Operations ----------------------- */
    // Note: ALl tests should fail here because `Token` and `Item` assets
    // are incompatible for mathematical operations and evaluations.

    /*
     * Failure tests
     */
    // Subtract assetItem_3 from assetToken_1
    expect(subRhsAssetFromLhsAsset(assetToken_1, assetItem_3).isOk()).toBe(false);
    // Add assetItem_2 to assetToken_1
    expect(addLhsAssetToRhsAsset(assetToken_1, assetItem_2).isOk()).toBe(false);
    // Test assetItem_1 > assetToken_2
    expect(lhsAssetIsLessThanRhsAsset(assetToken_2, assetItem_1).isOk()).toBe(false);
    // Test assetItem_2 < assetToken_1
    expect(lhsAssetIsGreaterThanRhsAsset(assetToken_2, assetItem_2).isOk()).toBe(false);
    // Test assetItem_3 >= assetToken_3
    expect(lhsAssetIsEqOrGreaterThanRhsAsset(assetToken_2, assetItem_3).isOk()).toBe(false);
});

/* -------------------------------------------------------------------------- */
/*                          Valence Utilities Tests                          */
/* -------------------------------------------------------------------------- */

test('generate an valence verification header', () => {
    // Key-pair we own
    const keypair: IKeypair = {
        // Latest address version structure
        address: '18f70e4a53a7cfd7f82d0e1fc287a449872ec7489dba0dff86144df8609caeda',
        secretKey: Uint8Array.from([
            233, 235, 184, 105, 168, 34, 66, 245, 129, 89, 179, 190, 179, 228, 191, 30, 5, 237, 239,
            61, 108, 71, 165, 31, 199, 98, 115, 229, 108, 205, 221, 247, 35, 4, 102, 112, 71, 249,
            172, 7, 75, 43, 6, 43, 70, 85, 126, 50, 131, 161, 102, 29, 131, 72, 179, 214, 50, 52,
            144, 185, 200, 204, 249, 120,
        ]),
        publicKey: Uint8Array.from([
            35, 4, 102, 112, 71, 249, 172, 7, 75, 43, 6, 43, 70, 85, 126, 50, 131, 161, 102, 29,
            131, 72, 179, 214, 50, 52, 144, 185, 200, 204, 249, 120,
        ]),
        version: null,
    };
    // Generate valence get body
    const headers = generateVerificationHeaders(keypair.address, keypair).headers;

    // Verify correct body structure
    expect(headers).toStrictEqual({
        ...DEFAULT_HEADERS.headers,
        address: '18f70e4a53a7cfd7f82d0e1fc287a449872ec7489dba0dff86144df8609caeda',
        public_key: '2304667047f9ac074b2b062b46557e3283a1661d8348b3d6323490b9c8ccf978',
        signature:
            '84e8e0f4a3871544a35fd338a30a617bda2b725bd74a43881263b090f4c47fb9b600e1f0862f7b05a47fcc7e05298e2f75592efd9c19cd01fc4c06d2685b2708',
    });
});

test('generate an valence set body', () => {
    // Key-pair we own
    const keypair: IKeypair = {
        // Latest address version structure
        address: '18f70e4a53a7cfd7f82d0e1fc287a449872ec7489dba0dff86144df8609caeda',
        secretKey: Uint8Array.from([
            233, 235, 184, 105, 168, 34, 66, 245, 129, 89, 179, 190, 179, 228, 191, 30, 5, 237, 239,
            61, 108, 71, 165, 31, 199, 98, 115, 229, 108, 205, 221, 247, 35, 4, 102, 112, 71, 249,
            172, 7, 75, 43, 6, 43, 70, 85, 126, 50, 131, 161, 102, 29, 131, 72, 179, 214, 50, 52,
            144, 185, 200, 204, 249, 120,
        ]),
        publicKey: Uint8Array.from([
            35, 4, 102, 112, 71, 249, 172, 7, 75, 43, 6, 43, 70, 85, 126, 50, 131, 161, 102, 29,
            131, 72, 179, 214, 50, 52, 144, 185, 200, 204, 249, 120,
        ]),
        version: null,
    };
    // Setting data on the valence server needs to be of type `object`
    const dataToSet: object = { testValue: 'Hello!' };
    // Generate valence set body
    const body = generateValenceSetBody<object>(
        keypair.address,
        dataToSet,
        "data_id_test"
    );
    // Verify correct body structure
    expect(body).toStrictEqual({
        address: '18f70e4a53a7cfd7f82d0e1fc287a449872ec7489dba0dff86144df8609caeda',
        data: { testValue: 'Hello!' },
        data_id: "data_id_test",
    });
});
