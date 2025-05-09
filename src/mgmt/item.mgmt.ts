import { err, ok } from 'neverthrow';

import {
    IAssetItem,
    ICreateTxPayload,
    IDruidValues,
    IGenesisHashSpecification,
    IDruidExpectation,
    IFetchBalanceResponse,
    IKeypair,
    IItemCreationAPIPayload,
    IResult,
} from '../interfaces';
import { getStringBytes } from '../utils';
import { ITEM_DEFAULT } from './constants';
import { constructAddress, createSignature } from './key.mgmt';
import { constructTxInSignableAssetHash, updateSignatures } from './script.mgmt';
import { createTx, getInputsForTx } from './tx.mgmt';

/* -------------------------------------------------------------------------- */
/*                            Transaction Creation                            */
/* -------------------------------------------------------------------------- */

/**
 * Create a payload needed to create item assets which is suitable for processing by a mempool node
 *
 * @export
 * @param {Uint8Array} secretKey - Secret key as Uint8Array
 * @param {Uint8Array} pubKey - Public key as Uint8Array
 * @param {(number | null)} version - Address version
 * @param {number} [amount=ITEM_DEFAULT] - Amount of the asset to create
 * @param {boolean} [default_genesis_hash_spec=true] - Whether to use the default DRS transaction hash
 * @param {string | null} [metadata=null] - Metadata to be included in the asset
 * @return {*}  {IResult<IItemCreationAPIPayload>}
 */
export function createItemPayload(
    secretKey: Uint8Array,
    pubKey: Uint8Array,
    version: number | null,
    amount: number = ITEM_DEFAULT,
    default_genesis_hash_spec = true, //genesis_hash_spec
    metadata: string | null = null,
): IResult<IItemCreationAPIPayload> {
    const address = constructAddress(pubKey, version);
    if (address.isErr()) return err(address.error);
    const asset: IAssetItem = {
        Item: {
            amount,
            genesis_hash: '', // TODO: Change this if signable data for creating item assets changes; currently not used to create signable data
            metadata,
        },
    };
    const signableAssetHash = constructTxInSignableAssetHash(asset);
    const signature = createSignature(secretKey, getStringBytes(signableAssetHash));
    return ok({
        item_amount: amount,
        script_public_key: address.value,
        public_key: Buffer.from(pubKey).toString('hex'),
        signature: Buffer.from(signature).toString('hex'),
        version: version,
        genesis_hash_spec: default_genesis_hash_spec
            ? IGenesisHashSpecification.Default
            : IGenesisHashSpecification.Create,
        metadata,
    });
}

/**
 * Create one "half" of a 2 way payment
 *
 * @export
 * @param {IFetchBalanceResponse} fetchBalanceResponse - Balance as received from the mempool node
 * @param {string} druid - Unique DRUID value associated with this transaction; needs to match the other "half" of this 2 way payment
 * @param {IDruidExpectation} senderExpectation - Expectation for the sender of this transaction
 * @param {IDruidExpectation} receiverExpectation - Expectation for the receiver of this transaction
 * @param {string} excessAddress - Address to send excess funds to (owned by sender of this "half" of the transaction)
 * @param {Map<string, IKeypair>} allKeypairs - Map of all keypairs
 * @return {*}  {IResult<ICreateTxPayload>}
 */
export function create2WTxHalf(
    fetchBalanceResponse: IFetchBalanceResponse,
    druid: string,
    senderExpectation: IDruidExpectation,
    receiverExpectation: IDruidExpectation,
    excessAddress: string,
    allKeypairs: Map<string, IKeypair>,
    locktime: number,
): IResult<ICreateTxPayload> {
    // Gather `TxIn` values
    const txIns = getInputsForTx(receiverExpectation.asset, fetchBalanceResponse, allKeypairs);

    // Return error if gathering of `TxIn` values failed
    if (txIns.isErr()) return err(txIns.error); /* Inputs for this payment could not be found */

    // Construct DRUID info
    const druidInfo: IDruidValues = {
        druid,
        participants: 2 /* This is a 2 way payment, hence two participants */,
        expectations: [senderExpectation],
    };

    const transaction = createTx(
        receiverExpectation.to,
        receiverExpectation.asset,
        excessAddress,
        druidInfo,
        txIns.value,
        locktime,
    );
    if (transaction.isErr()) return err(transaction.error);

    // Create the transaction
    return updateSignatures(transaction.value, fetchBalanceResponse, allKeypairs);
}
