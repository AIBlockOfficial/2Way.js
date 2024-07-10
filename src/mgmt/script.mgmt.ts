import { sha3_256 } from 'js-sha3';
import { err, ok } from 'neverthrow';
import nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';

import {
    IAssetItem,
    IAssetToken,
    ICreateTxIn,
    ICreateTxPayload,
    IFetchBalanceResponse,
    IErrorInternal,
    IKeypair,
    IOutPoint,
    IResult,
    ITxOut,
    Script,
    StackEntry,
} from '../interfaces';
import { getHexStringBytes, getStringBytes, truncateByBytesUTF8 } from '../utils';
import { constructAddress } from './key.mgmt';
import { initIAssetToken, isOfType } from '../utils/interface.utils';

/* -------------------------------------------------------------------------- */
/*                            Transaction Utilities                           */
/* -------------------------------------------------------------------------- */

/**
 * Constructs a signature used in P2PKH script
 *
 * @export
 * @param {Uint8Array} signableData
 * @param {Uint8Array} secretKey
 * @return {*}  {string}
 */
export function constructSignature(
    signableData: Uint8Array,
    secretKey: Uint8Array,
): IResult<string> {
    try {
        const signature = nacl.sign.detached(signableData, secretKey);
        return ok(Buffer.from(signature).toString('hex'));
    } catch {
        return err(IErrorInternal.UnableToConstructSignature);
    }
}

/**
 * Constructs signable data from previous OutPoint for P2PKH script
 *
 * @export
 * @param {IOutPoint} outPoint - Previous `OutPoint`
 * @return {*}  {string}
 */
export function constructTxInSignableData(outPoint: IOutPoint | null): string | null {
    return sha3_256(
        getFormattedOutPointString(outPoint),
    ); /* Assume that outPoint cannot be null here */
}

/**
 * Gets OutPoint formatted as a string
 *
 * @export
 * @param {(IOutPoint | null)} outPoint
 * @return {*}  {(string | null)}
 */
export function getFormattedOutPointString(outPoint: IOutPoint | null): string | null {
    if (!outPoint) {
        return null;
    }
    return `${outPoint.n}-${outPoint.t_hash}`;
}

/**
 * Generates a new 32 byte DRUID
 *
 * @returns {string}
 */
export function generateDRUID(): IResult<string> {
    try {
        let newDRUID = uuidv4().replace(/-/gi, '');
        // TODO: Change DRUID character length to 64?
        newDRUID = truncateByBytesUTF8(sha3_256(newDRUID), 32);

        return ok(`DRUID0x${newDRUID}`);
    } catch {
        return err(IErrorInternal.UnableToGenerateDruid);
    }
}

/**
 * Formats script data for "from" address creation
 *
 * @export
 * @return {*}  {string}
 * @param script - `Script` value
 */
export function getFormattedScriptString(script: Script): string {
    return Object.values(script.stack)
        .map((stackEntry) => stackEntry.toString())
        .join('-');
}

/**
 * Gets "from" address used in 2 way transaction values
 *
 * @export
 * @param {ICreateTxIn[]} txIns - Transaction inputs
 * @return {*}  {string}
 */
export function constructTxInsAddress(txIns: ICreateTxIn[]): IResult<string> {
    const signableTxIns = txIns
        .map((txIn) => {
            const script_sig = txIn.script_signature;
            if (script_sig) {
                const previousOutPoint = txIn.previous_out;
                const script = p2pkh(
                    script_sig.Pay2PkH.signable_data,
                    script_sig.Pay2PkH.signature,
                    script_sig.Pay2PkH.public_key,
                    script_sig.Pay2PkH.address_version,
                );
                if (script.isErr()) return err(script.error);

                return previousOutPoint !== null
                    ? `${getFormattedOutPointString(previousOutPoint)}-${getFormattedScriptString(
                        script.value,
                    )}`
                    : `null-${getFormattedScriptString(script.value)}`;
            } else {
                return err(IErrorInternal.UnableToConstructTxIns);
            }
        })
        .join('-');

    const bytesToHash = getStringBytes(signableTxIns);
    return ok(sha3_256(bytesToHash));
}

//TODO: Add data asset type
//TODO: Use DRS transaction hash as part of the signable data?
export function constructTxInSignableAssetHash(asset: IAssetToken | IAssetItem): string {
    if (isOfType<IAssetToken>(asset, initIAssetToken())) {
        return sha3_256(
            getStringBytes(`Token:${asset.Token}`),
        ); /* Actual token amount, not formatted for display */
    } else {
        return sha3_256(getStringBytes(`Item:${asset.Item.amount}`));
    }
}

/** Construct a signable hash for a transaction using both the inputs and outputs of the transaction
 *
 * @param txIn - Transaction input
 * @param txOuts - Transaction outputs
 * @returns {string} - Signable hash
 */
export function constructTxInOutSignableHash(txIn: IOutPoint | null, txOuts: ITxOut[]): string {
    const signableTxIn = JSON.stringify(txIn) || '';
    const signableTxOuts = txOuts
        .map((txOut) => {
            return JSON.stringify(txOut) || '';
        })
        .join('');
    return sha3_256(`${signableTxOuts}${signableTxIn}`);
}

/**
 * Updates the signatures of the transaction given the available outputs
 *
 * @param transaction - Transaction to update
 * @param fetchBalanceResponse - Response from fetch balance
 * @param allKeypairs - All keypairs
 * @returns
 */
export function updateSignatures(
    transaction: ICreateTxPayload,
    fetchBalanceResponse: IFetchBalanceResponse,
    allKeypairs: Map<string, IKeypair>,
) {
    // Update the signatures
    transaction.createTx.inputs.map((input) => {
        if (input.script_signature && input.previous_out) {
            const address = getAddressFromFetchBalanceResponse(
                fetchBalanceResponse,
                input.previous_out.t_hash,
            );
            const keyPair = allKeypairs.get(address);
            if (!keyPair) return err(IErrorInternal.UnableToGetKeypair);

            const signableData = constructTxInOutSignableHash(
                input.previous_out,
                transaction.createTx.outputs,
            );

            if (signableData === null) return err(IErrorInternal.UnableToConstructSignature);
            const signature = constructSignature(getStringBytes(signableData), keyPair.secretKey);

            if (signature.isErr()) return err(signature.error);

            input.script_signature.Pay2PkH.signable_data = signableData;
            input.script_signature.Pay2PkH.signature = signature.value;
        }

        return input;
    });

    return ok(transaction);
}

/**
 * Gets the address of the outpoint that matches the transaction hash of the input
 *
 * @param fetchBalanceResponse - Response from fetch balance
 * @param t_hash - Transaction hash
 * @returns
 */
export function getAddressFromFetchBalanceResponse(
    fetchBalanceResponse: IFetchBalanceResponse,
    t_hash: string,
) {
    return Object.keys(fetchBalanceResponse.address_list).filter((address) => {
        const outPoints = fetchBalanceResponse.address_list[address];

        // Searches through the outpoints and returns true if the t_hash of the outpoint matches the t_hash provided
        return outPoints.some((outPoint) => outPoint.out_point.t_hash === t_hash);
    })[0];
}

/**
 * Construct a Pay-to-Public-Key-Hash script
 *
 * @export
 * @param {string} checkData - Data to check
 * @param {string} signatureData - Signature
 * @param {string} publicKeyData - Public key
 * @param {(number | null)} addressVersion - Address version
 * @return {*}  {IResult<Script>}
 */
export function p2pkh(
    checkData: string,
    signatureData: string,
    publicKeyData: string,
    addressVersion: number | null,
): IResult<Script> {
    const stackEntries: StackEntry[] = [];
    stackEntries.push(new StackEntry('Bytes', checkData));
    stackEntries.push(new StackEntry('Signature', signatureData));
    stackEntries.push(new StackEntry('PubKey', publicKeyData));
    stackEntries.push(new StackEntry('Op', 'OP_DUP'));
    stackEntries.push(
        new StackEntry(
            'Op',
            addressVersion === 1 || addressVersion === null ? 'OP_HASH256' : 'OP_HASH256_TEMP',
        ),
    );
    const addr = constructAddress(getHexStringBytes(publicKeyData), addressVersion);
    if (addr.isErr()) return err(addr.error);
    stackEntries.push(new StackEntry('Bytes', addr.value));
    stackEntries.push(new StackEntry('Op', 'OP_EQUALVERIFY'));
    stackEntries.push(new StackEntry('Op', 'OP_CHECKSIG'));
    return ok({
        stack: stackEntries,
    });
}
