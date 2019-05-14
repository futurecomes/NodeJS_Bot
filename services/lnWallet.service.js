const { testmode, network, contract: contractCfg } = require('../libs/env/server_configs')["envConfigLn"];
const ethUtil = require('ethereumjs-util');


class WalletService {
    constructor() {
        this.networks = {
            live: { id: 1, name: 'live', url: 'https://tronscan.org/#', api: 'https://api.trongrid.io' },
            shasta: { id: 3, name: 'shasta', url: 'https://explorer.shasta.trongrid.io', api: 'https://api.shasta.trongrid.io' },
        };
        this.currentNetwork = this.networks[network] || this.networks.live;
        this.contractAddress = contractCfg.address;
    }

    init(bot, callb) {
        console.log("init ln wallet service");
        if (testmode) {
            this.walletAddress = "0x" + Math.random().toString(36).substring(3);
            return callb(true);
        }

        this.walletAddress = bot.address.hex.toLowerCase();
        return callb(true);

    }


    isLogged() {
        return this.walletAddress != null;
    }

    sendTxWithData({ transactionName, params, address, value}, callback) {
       const parent = this;
          return new Promise((resolve, reject) => {
            let txHash = "0x" + Math.random().toString(36).substring(2);
            resolve(txHash);
          });
    };


   

    getTxUrl(txHash) {
        return `${this.currentNetwork.url}/transaction/${txHash}`;
    }

    getAddressUrl(address, isContract) {
        if (address.startsWith('41') && tronWeb != null) {
            address = tronWeb.address.fromHex(address);
        }
        if (isContract) {
            return `${this.currentNetwork.url}/contract/${address}`;
        }
        return `${this.currentNetwork.url}/address/${address}`;
    }

    apiCall(address, methodName, types, params) {
        return new Promise((resolve, reject) => {
            if (testmode) return 0;

            if (this.contract[methodName] == null) {
                return reject(methodName + " not found");
            }
            if(params!=null) {
              this.contract[methodName](params).call()
              .then(data => {
                  resolve(data);
              })
              .catch(function(err) {
                  console.error(err);
                  reject({ "error": "result is null" });
              });
            }
            else {
              this.contract[methodName]().call()
              .then(data => {
                  resolve(data);
              })
              .catch(function(err) {
                  console.error(err);
                  reject({ "error": "result is null" });
              });
            }

        });
    }

    checkJoinGame(gameId) {
        return Promise.resolve(true);
    }

    isValidAddress(address) {
        try {
            if (address.startsWith('41')) return true;

            const hex = tronWeb.address.toHex(address);
            if (hex) return true;

            return false;
        } catch (err) {
            return false;
        }
    }
}

module.exports = new WalletService();