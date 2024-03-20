/* eslint-disable @typescript-eslint/no-explicit-any */
import { err, ok } from 'neverthrow';

import {
    IErrorInternal,
    IKeypair,
    IRequestValenceDelBody,
    IRequestValenceGetBody,
    IRequestValenceSetBody,
    IResponseValence,
    IResult,
} from '../interfaces';
import { createSignature } from '../mgmt/key.mgmt';
import { isOfTypeIPendingIbTxDetails } from './interface.utils';

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
    valenceData: IResponseValence<T>,
    predicates: Partial<{ [key in keyof T]: T[keyof T] }>,
    canBeEmpty = false,
): IResult<IResponseValence<T>> {
    const filteredData: IResponseValence<T> = {};
    Object.entries(filterValidValenceData(valenceData))
        .filter(([, value]) =>
            Object.entries(predicates).every(
                ([predicateKey, predicateValue]) =>
                    (value.value as any)[predicateKey] === predicateValue,
            ),
        )
        .forEach(([key, value]) => (filteredData[key] = value));
    if (Object.entries(filteredData).length === 0 && !canBeEmpty)
        return err(IErrorInternal.UnableToFilterValenceData);
    return ok(filteredData);
}

/**
 * Generate the needed request body to retrieve data from the valence server
 *
 * @export
 * @param {string} addressKey
 * @param {IKeypair} keyPairForKey
 * @return {*}  {IRequestValenceGetBody}
 */
export function generateValenceGetBody(
    addressKey: string,
    keyPairForKey: IKeypair,
): IRequestValenceGetBody {
    return {
        key: addressKey,
        publicKey: Buffer.from(keyPairForKey.publicKey).toString('hex'),
        signature: Buffer.from(
            createSignature(
                keyPairForKey.secretKey,
                Uint8Array.from(Buffer.from(addressKey, 'hex')),
            ),
        ).toString('hex'),
    } as IRequestValenceGetBody;
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
    addressKey: string,
    addressField: string,
    keyPairForField: IKeypair,
    value: T,
): IRequestValenceSetBody<T> {
    return {
        key: addressKey,
        field: addressField,
        signature: Buffer.from(
            createSignature(
                keyPairForField.secretKey,
                Uint8Array.from(Buffer.from(addressField, 'hex')),
            ),
        ).toString('hex'),
        publicKey: Buffer.from(keyPairForField.publicKey).toString('hex'),
        value,
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
 * @param {IResponseValence<T>} pending - Data as received from the valence server
 * @return {*}  {IResponseValence<T>}
 */
export function filterValidValenceData<T>(pending: IResponseValence<T>): IResponseValence<T> {
    // We test against this body structure to ensure that the data is valid
    const returnValue: IResponseValence<T> = {};
    Object.entries(pending)
        .filter(([, entry]) => isOfTypeIPendingIbTxDetails(entry.value))
        .forEach(([key, value]) => (returnValue[key] = value));
    return returnValue;
}
