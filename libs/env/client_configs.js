let envConfigEth = require('./client_default_eth.json');
let envConfigTrx = require('./client_default_trx.json');
let envConfigLn = require('./client_default_ln.json');
let envConfigWc = require('./client_default_wc.json');

if (process.env['NODE_ENV'] == 'production') {
    envConfigEth = require('./client_production_eth.json');
    envConfigTrx = require('./client_production_trx.json');
    envConfigLn = require('./client_production_ln.json');
    envConfigWc = require('./client_production_wc.json');
}

module.exports = {envConfigEth, envConfigTrx, envConfigLn, envConfigWc};
