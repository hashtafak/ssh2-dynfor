const joi = require('joi');

// reconnection
// reconnection.type {Number}
// 0 - disabled
// 1 - automatically reconnect if sucessful connections break; (default)
// 2 - always reconnect atomatically
// reconnection.firstReconnectionTimeout {Number}
// 2 - (default)
// If the specified timeout is 60s or longer,
// the same timeout is used for all reconnection attempts.
// Otherwise, the timeout value is multiplied by 2 after each reconnection attempt,
// up to a maximum of 64s.

const reconnectionSchema = joi.object().keys({
    type: joi.number()
        .min(0)
        .max(2)
        .default(1),
    firstReconnectionTimeout: joi.number()
        .min(1000)
        .default(2000),
});

const configSchema = joi.object({
    host: joi.string()
        .required(),
    username: joi.string()
        .required(),
    password: joi.string()
        .required(),
    sshForwardPort: joi.number()
        .min(1)
        .max(65535)
        .required(),
    sshForwardPortWever: joi.boolean()
        .default(true),
    readyTimeout: joi.number()
        .min(1000)
        .default(20000),
    port: joi.number()
        .min(1)
        .max(65535)
        .default(22),
    reconnection: reconnectionSchema.default(reconnectionSchema.validate({}).value),
    keepaliveInterval: joi.number()
        .min(0)
        .default(60000),
    keepaliveCountMax: joi.number()
        .min(0)
        .default(10),
}).required();

module.exports = (config) => {
    const {
        error,
        value: validatedConfig,
    } = joi.validate(config, configSchema);
    if (error) {
        throw new Error(`Config validation error: ${error.message}`);
    }

    return validatedConfig;
};
