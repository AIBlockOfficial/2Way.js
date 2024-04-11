import Joi from 'joi';
import { IClientConfig, IMasterKeyEncrypted } from '../interfaces';

const uri_scheme = {
    scheme: ['http', 'https'],
};

export const validateConfig = (config: IClientConfig) => {
    const configSchema = Joi.object({
        mempoolHost: Joi.string().uri(uri_scheme),
        storageHost: Joi.string().uri(uri_scheme),
        intercomHost: Joi.string().uri(uri_scheme),
        passphrase: Joi.string().empty(''),
    });
    return configSchema.validate(config);
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
