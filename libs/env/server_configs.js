let envConfigEth = require('./server_default_eth.json');
let envConfigTrx = require('./server_default_trx.json');
let envConfigLn = require('./server_default_ln.json');
let envConfigWc = require('./server_default_wc.json');

if (process.env['NODE_ENV'] == 'production') {
    envConfigEth = require('./server_production_eth.json');
    envConfigTrx = require('./server_production_trx.json');
    envConfigLn = require('./server_production_ln.json');
    envConfigWc = require('./server_production_wc.json');
}

module.exports = {
    envConfigEth, envConfigTrx, envConfigLn, envConfigWc,
    teamsIndices: {
        'vikings': 0,
        'pirates': 1,
        'samurais': 2,
        'rebels': 3
    },
};
