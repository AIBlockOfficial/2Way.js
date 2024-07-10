import { sha3_256 } from 'js-sha3';
import { Buffer } from 'buffer';
import { err, ok } from 'neverthrow';
import { v4 as uuidv4 } from 'uuid';

import { BAL_LIMIT } from '../mgmt/constants';

import {
    IClientResponse,
    IErrorInternal,
    IPending2WTxDetails,
    IResult,
} from '../interfaces';

type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

/**
 * Cast `status` received from 2 Way network to lowercase string variant
 *
 * TODO: There's probably already a built-in function for this?
 *
 * @export
 * @param {('Success' | 'Error' | 'InProgress' | 'Unknown')} status
 * @return {*}  {('success' | 'error' | 'pending' | 'unknown')}
 */
export function castAPIStatus(
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown',
): 'success' | 'error' | 'pending' | 'unknown' {
    switch (status) {
        case 'Success':
            return 'success';
        case 'Error':
            return 'error';
        case 'InProgress':
            return 'pending';
        default:
            return 'unknown';
    }
}

/**
 * Converts a string into a byte array for handling by nacl
 *
 * @param msg {string}
 * @returns
 */
export function getStringBytes(msg: string): Uint8Array {
    const enc = new TextEncoder();
    return enc.encode(msg);
}

/**
 * Converts a HEX string into a byte array
 *
 * @returns
 * @param hexString - HEX string to obtain byte array from
 */
export function getHexStringBytes(hexString: string): Uint8Array {
    const IResult = [];
    while (hexString.length >= 2) {
        IResult.push(parseInt(hexString.substring(0, 2), 16));
        hexString = hexString.substring(2, hexString.length);
    }
    return new Uint8Array(IResult);
}

/**
 * Converts a sequence of bytes into a HEX string
 *
 * @param bytes {Uint8Array}
 * @returns
 */
export function getBytesHexString(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => {
        return ('0' + (byte & 0xff).toString(16)).slice(-2);
    }).join('');
}

/**
 * Formats a token balance for display
 *
 * @param balance {number}
 * @param fraction - Optional fraction to divide the balance by
 * @returns
 */
export function formatBalance(balance: number, fraction?: number): string {
    fraction = fraction || 1;

    if (balance < 0 || balance > BAL_LIMIT * fraction) {
        return 'N/A';
    } else if (balance === 0) {
        return balance.toFixed(6);
    } else {
        const formattedBalance = fraction !== undefined ? balance / fraction : balance;
        return formattedBalance.toFixed(6).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
}

/**
 * Converts a byte array into a utf-8 string
 *
 * @param bytes {Uint8Array}
 * @returns
 */
export function getBytesString(bytes: Uint8Array): string {
    const dec = new TextDecoder('utf-8');
    return dec.decode(bytes);
}

/**
 * Truncates string to a specified number of bytes
 *
 * @param chars {string}
 * @param n {number}
 * @returns
 */
export function truncateByBytesUTF8(chars: string, n: number): string {
    let bytes = toBytesUTF8(chars).substring(0, n);
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return fromBytesUTF8(bytes);
            // eslint-disable-next-line no-empty
        } catch (e) { }
        bytes = bytes.substring(0, bytes.length - 1);
    }
}

export function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
    return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);
}

/**
 * Concatenates two typed arrays, as long as they are of the same type
 *
 * @param a {Uint8Array}
 * @param b {Uint8Array}
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function concatTypedArrays<T extends TypedArray>(a: T, b: T): T {
    const c = new (a.constructor as { new (length: number): T })(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

/**
 * Converts string to bytes
 *
 * @param chars {string}
 * @returns
 */
function toBytesUTF8(chars: string) {
    return decodeURI(encodeURIComponent(chars));
}

/**
 * Converts bytes to string
 *
 * @param bytes {string}
 * @returns
 */
function fromBytesUTF8(bytes: string) {
    return decodeURIComponent(encodeURI(bytes));
}

/**
 * Filter out `value` from `IResult` containing possible errors,
 * if an error occurs, throw an exception
 *
 * @export
 * @template T
 * @return {*}
 * @param result - Result wrapper
 */
export function throwIfErr<T>(result: IResult<T>) {
    if (result.isErr()) throw new Error(result.error);
    return result.value;
}

/**
 * Throws an error if there's a client API-level error.
 *
 *
 * @export
 * @param {IClientResponse} result
 * @return {*}  {IClientResponse}
 */
export function throwIfIClientError(result: IClientResponse): IClientResponse {
    if (result.status === 'error')
        throw new Error(result.reason ? result.reason : IErrorInternal.UnknownError);
    return result;
}

/**
 * Calculate the nonce value required to provide valid PoW
 * for a specified ID (challenge) and target (difficulty)
 *
 * @export
 * @param {number} target
 * @param {string} id
 * @return {*}  {number}
 */
export function calculateNonceForId(target: number, id: string): number {
    let nonce = 0;
    let hashBuffer = Buffer.from(sha3_256(`${nonce}-${id}`), 'hex');
    while (
        !Array.from(hashBuffer)
            .slice(0, target)
            .every((e) => e === 0)
    ) {
        nonce++;
        hashBuffer = Buffer.from(sha3_256(`${nonce}-${id}`), 'hex');
    }
    return nonce;
}

/**
 * Create a unique ID as well as the required nonce for PoW
 *
 * @export
 * @param {number} [difficulty]
 * @return {*}  {{
 *     headers: { 'x-cache-id': string; 'x-nonce': number };
 * }}
 */
export function createIdAndNonceHeaders(difficulty?: number): {
    headers: { 'x-cache-id': string; 'x-nonce': number };
} {
    const id = getUniqueID();
    const nonce = difficulty ? calculateNonceForId(difficulty, id) : 0;
    return {
        headers: {
            'x-cache-id': id,
            'x-nonce': nonce,
        },
    };
}

/**
 * Generate a unique ID
 *
 * @export
 * @return {*}  {string}
 */
export const getUniqueID = (): string => uuidv4().replace(/-/gi, '').toString().substring(0, 32);

/**
 * Adds sensible defaults to asset structures for receiving and sending in 2 way transactions. Ensures
 * error handling for missing fields.
 *
 * @param {IPending2WTxDetails} txStructure
 * @return {*}  {IResult<IPending2WTxDetails>}
 */
export const formatAssetStructures = (
    txStructure: IPending2WTxDetails,
): IResult<IPending2WTxDetails> => {
    const defaults = {
        amount: 0,
        genesis_hash: null,
        metadata: null,
    };

    if ('Item' in txStructure.senderExpectation.asset) {
        const senderExpectation = txStructure.senderExpectation.asset.Item;
        Object.assign(
            senderExpectation,
            ...Object.entries(defaults)
                .filter(([key]) => !(key in senderExpectation))
                .map(([key, value]) => ({ [key]: value })),
        );

        senderExpectation.metadata = null;
        txStructure.senderExpectation.asset.Item = senderExpectation;
    }

    if ('Item' in txStructure.receiverExpectation.asset) {
        const receiverExpectation = txStructure.receiverExpectation.asset.Item;
        Object.assign(
            receiverExpectation,
            ...Object.entries(defaults)
                .filter(([key]) => !(key in receiverExpectation))
                .map(([key, value]) => ({ [key]: value })),
        );

        receiverExpectation.metadata = null;
        txStructure.receiverExpectation.asset.Item = receiverExpectation;
    }

    return ok(txStructure);
};
