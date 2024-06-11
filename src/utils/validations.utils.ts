import Joi from 'joi';
import {
    IClientConfig,
    IClientResponse,
    IMasterKeyEncrypted,
    IKeypairEncrypted,
} from '../interfaces';

const uri_scheme = {
    scheme: ['http', 'https'],
};

const METADATA_MAX_LENGTH = 800;

type PossibleValidationError = Joi.ValidationError | undefined;

//================ UTIL FUNCTIONS ===================//

export const handleValidationFailures = (errors: PossibleValidationError[]) => {
    return {
        status: 'error',
        reason: errors.reduce((acc, error) => {
            return error ? acc + error.message + ', ' : '';
        }, ''),
    } as IClientResponse;
};

const byteLength = (length: number) => {
    return Joi.string().custom((value, helpers) => {
        if (Buffer.byteLength(value, 'utf-8') > length) {
            return helpers.error('string.byteLength', { length });
        }
        return value;
    }, 'Byte Length Validation');
};

//================ VALIDATIONS ===================//

export const validateMetadata = (value: string | null) => {
    return byteLength(METADATA_MAX_LENGTH).validate(value);
};

export const validateTransactionHash = (hash: string) => {
    const hashSchema = Joi.string().pattern(new RegExp('^g[a-f0-9]{31}$'));
    return hashSchema.validate(hash);
};

export const validateAddress = (address: string) => {
    const addressSchema = Joi.string().pattern(new RegExp('^g[a-f0-9]{64}$'));
    return addressSchema.validate(address);
};

export const validateDruid = (druid: string) => {
    const druidSchema = Joi.string().pattern(new RegExp('^[a-zA-Z0-9-_]{0,30}$'));
    return druidSchema.validate(druid);
};

export const validateURL = (url: string) => {
    const urlSchema = Joi.string().uri(uri_scheme);
    return urlSchema.validate(url);
};

export const validateConfig = (config: IClientConfig) => {
    const configSchema = Joi.object({
        mempoolHost: Joi.string().uri(uri_scheme),
        storageHost: Joi.string().uri(uri_scheme),
        intercomHost: Joi.string().uri(uri_scheme),
        passphrase: Joi.string().pattern(new RegExp('^[a-zA-Z0-9]{0,30}$')).required(),
    });
    return configSchema.validate(config);
};

export const validateKeypairEncrypted = (keypair: IKeypairEncrypted) => {
    const keypairSchema = Joi.object({
        address: Joi.string().pattern(new RegExp('^g[a-f0-9]{64}$')).required(),
        nonce: Joi.string().required(),
        save: Joi.string().required(),
        version: Joi.number().allow(null).required(),
    });
    return keypairSchema.validate(keypair);
};

export const validateMasterKey = (masterKey: IMasterKeyEncrypted) => {
    const masterKeySchema = Joi.object({
        nonce: Joi.string().required(),
        save: Joi.string().required(),
    });
    return masterKeySchema.validate(masterKey);
};

export const validateSeedphrase = (seedphrase: string) => {
    const seedphraseSchema = Joi.string()
        .regex(/^(\w+\s){11}\w+$/)
        .required();
    return seedphraseSchema.validate(seedphrase);
};
