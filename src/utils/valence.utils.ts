/* eslint-disable @typescript-eslint/no-explicit-any */
import { err, ok } from 'neverthrow';

import {
    IErrorInternal,
    IKeypair,
    IPending2WTxDetails,
    IRequestValenceDelBody,
    IRequestValenceGetBody,
    IRequestValenceSetBody,
    IResult,
} from '../interfaces';
import { createSignature } from '../mgmt/key.mgmt';
import { isOfTypeIPendingIbTxDetails } from './interface.utils';
import { DEFAULT_HEADERS } from '../mgmt';

/**
 * Filter data received from the valence server for a list of pre-defined predicates
 *
 * @export
 * @template T - Template of object structure expected from the valence server
 * @param {IResponseValence<T>} valenceData - Data as received from the valence server
 * @param {Partial<{ [key in keyof T]: T[keyof T] }>} predicates - A list of predicates to filter for
 * @param {boolean} [canBeEmpty=false] - Indication of whether it should be possible to receive an empty list of filtered results
 * @return {*}  {IResult<IResponseValence<T>>}
 */
export function filterValenceDataForPredicates<T>(
    valenceData: IPending2WTxDetails,
    predicates: Partial<{ [key in keyof T]: T[keyof T] }>,
    canBeEmpty = false,
): IResult<IPending2WTxDetails> {
    const filteredData: IPending2WTxDetails = {
        druid: "",
        senderExpectation: {} as any,
        receiverExpectation: {} as any,
        status: 'pending',
        mempoolHost: "",
    }
    Object.entries(filterValidValenceData(valenceData))
        .filter(([, value]) =>
            Object.entries(predicates).every(
                ([predicateKey, predicateValue]) =>
                    (value as any)[predicateKey] === predicateValue,
            ),
        )
    // .forEach(([key, value]) => (filteredData[key] = value));
    if (Object.entries(filteredData).length === 0 && !canBeEmpty)
        return err(IErrorInternal.UnableToFilterValenceData);
    return ok(filteredData);
}

/**
 * Generate the needed request body to place data on the valence server
 *
 * @export
 * @template T
 * @param {string} addressKey
 * @param {string} addressField
 * @param {IKeypair} keyPairForField
 * @param {T} value
 * @return {*}  {IRequestValenceSetBody<T>}
 */
export function generateValenceSetBody<T>(
    address: string,
    data: T,
): IRequestValenceSetBody<T> {
    return {
        address: address,
        data,
    } as IRequestValenceSetBody<T>;
}

/**
 * Generate the needed request body to delete data from the valence server
 *
 * @export
 * @param {string} addressKey
 * @param {string} addressField
 * @param {IKeypair} keyPairForKey
 * @return {*}  {IRequestValenceDelBody}
 */
export function generateValenceDelBody(
    addressKey: string,
    addressField: string,
    keyPairForKey: IKeypair,
): IRequestValenceDelBody {
    return {
        key: addressKey,
        field: addressField,
        signature: Buffer.from(
            createSignature(
                keyPairForKey.secretKey,
                Uint8Array.from(Buffer.from(addressKey, 'hex')),
            ),
        ).toString('hex'),
        publicKey: Buffer.from(keyPairForKey.publicKey).toString('hex'),
    } as IRequestValenceDelBody;
}

/**
 * Remove garbage entries from data received from the valence server based on the provided template
 *
 * @export
 * @template T - Template of data structure expected from the valence server
 * @param {IPending2WTxDetails} pending - Data as received from the valence server
 * @return {*}  {IResponseValence<T>}
 */
export function filterValidValenceData(pending: IPending2WTxDetails): IPending2WTxDetails {
    console.log('PENDING: ', pending.druid)
    // We test against this body structure to ensure that the data is valid
    const returnValue: IPending2WTxDetails = {} as any
    console.log('HERE', Object.entries(pending))

    Object.entries(pending)
        .filter(([, entry]) => {
            console.log('ENTRY: ', entry)
            return isOfTypeIPendingIbTxDetails(entry)
        })
    // .forEach(([key, value]) => (returnValue[key] = value));

    console.log('RETURN_VALUES: ', returnValue)
    return returnValue;
}

/**
 * Generate the needed headers to verify the authenticity of the request on Valence nodes
 * 
 * @param {string} address 
 * @param {IKeypair} keyPair 
 * @returns 
 */
export function generateVerificationHeaders(
    address: string,
    keyPair: IKeypair,
) {
    return {
        headers: {
            ...DEFAULT_HEADERS.headers,
            address,
            signature: Buffer.from(
                createSignature(
                    keyPair.secretKey,
                    Uint8Array.from(Buffer.from(address)),
                ),
            ).toString('hex'),
            public_key: Buffer.from(keyPair.publicKey).toString('hex'),
        }
    };
}