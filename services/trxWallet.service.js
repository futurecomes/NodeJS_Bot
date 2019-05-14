const { testmode, network, contract: contractCfg } = require('../libs/env/server_configs')["envConfigTrx"];
const TronWeb = require('tronweb');
const HttpProvider = TronWeb.providers.HttpProvider;
const ethUtil = require('ethereumjs-util');

let tronWeb;

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
        console.log("init TRX wallet service");
        if (testmode) {
            this.walletAddress = "0x" + Math.random().toString(36).substring(3);
            return callb(true);
        }

        tronWeb = new TronWeb(
            new HttpProvider(this.currentNetwork.api),
            new HttpProvider(this.currentNetwork.api),
            this.currentNetwork.api,
            bot.privateKey
        );
        this.contract = tronWeb.contract(contractCfg.abi, contractCfg.address);
        this.walletAddress = bot.address.hex.toLowerCase();
        return callb(true);

    }

    static encodeFunctionTxData(transactionName, type = [], arg = []) {
        const fullName = `${transactionName}(${type.toString()})`;
        const signature = ethUtil.sha3(fullName).toString('hex').slice(0, 8);
        const encodedParams = ethereumjsABI.rawEncode(type, arg).toString('hex');

        return '0x' + signature + encodedParams;
    };

    isLogged() {
        return this.walletAddress != null;
    }

    sendTxWithData({ transactionName, params, address, value}, callback) {
        return new Promise((resolve, reject) => {
            console.log(transactionName, params);

            if (testmode) return resolve("0x111");

            if (!this.isLogged) {
                return reject("Tronlink is not logged");
            }

            if (this.contract[transactionName] == null) {
                return reject(transactionName + "is not implemented")
            }

            this.contract[transactionName].apply(this.contract, params).send({ callValue: tronWeb.toSun(value) })
            .then(function (tx) {
                resolve(tx);
            }, function (err) {
                reject(err);
            });
        });
    };


    /**
     * get confirmation of transaction
     * @param {string} txHash transaction hash
     * @returns confirmation status and logs data
     */
    getTxConfirmation(txHash) {
        return new Promise((resolve, reject) => {
          console.log("get tx confirmation");
            if (testmode) {
                return resolve({ success: true, logs: [{ data: [1] }], tx: "0x12345" });
            }

            const DELAY_TIME = 3000;
            const MAX_ATTEMPT = 500;

            let result = {
                success: false,
                logs: [],
                tx: txHash
            };

            const retry = (tried) => {
                if (tried < MAX_ATTEMPT) {
                    setTimeout(() => process(++tried), DELAY_TIME);
                } else {
                    resolve(result);
                }
            }

            const process = (tried) => {

                tronWeb.trx.getTransactionInfo(txHash)
                    .then((resultData) => {
                        if (resultData == null || resultData.blockNumber == null || resultData.receipt == null || resultData.receipt.result != "SUCCESS") {
                            return retry(tried);
                        }

                        result.success = true;
                        resultData.log.forEach(log => {
                            if (log.data != null) {
                                const data = log.data.match(/[\w\d]{64}/g);

                                result.logs.push({
                                    topics: log.topics,
                                    data: data.map(d => '0x' + d)
                                });
                            }
                        });

                        resolve(result);
                    })
                    .catch(function(err) {
                        result.error = "Failed to get transaction info";
                        console.error(err);
                        resolve(result);
                    });
            }

            process(0);
        });
    }

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
        if (testmode) {
            return new Promise((resolve, reject) => {
                return resolve(true);
            });
        }

        return this.contract.games(gameId).call().then(game => {
            console.log("joining game", game);

            if (game == null || game.player2 != "410000000000000000000000000000000000000000") {
                console.error("game %s is not started or player 2 %s already joined", gameId, game && game.player2);
                return false;
            }

            return true;
        });
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