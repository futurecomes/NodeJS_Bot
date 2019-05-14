const ethereumjsABI = require('ethereumjs-abi');
const ethUtil = require('ethereumjs-util');
const { testmode, network, contract: contractCfg } = require('../libs/env/server_configs')["envConfigEth"];
let Web3 = require('web3');
const web3 = new Web3('ws://localhost:8546');


class WalletService {
    constructor() {
        this.networks = [
            { id: 1, name: 'live', url: 'https://etherscan.io', api: 'https://api.etherscan.io/api' },
            { id: 3, name: 'ropsten', url: 'https://ropsten.etherscan.io', api: 'https://api-ropsten.etherscan.io/api' },
        ];
        this.currentNetwork = this.networks[network || 0];
    }
    init(bot, callb) {
        console.log("init ETH wallet service");

     this.walletAddress = bot.address;
    return callb(true);
    }

    checkAccount(accounts, callb) {
        console.log("found web3");
        if (accounts == null) {
            accounts = web3.eth.accounts;
        }

        //hack for trust wallet
       if(accounts.result!=null && typeof accounts.result=="string") {
           accounts=[accounts.result.replace(/[\[\]&]+/g, '')];
       }

        if (accounts == null || accounts.length == 0) {
            return callb({ "error": "Metamask locked. Please unlock it. Restart" });
        }
        console.log("found account " + accounts[0]);
        let parent = this;
        this.setNetwork(function (res) {
            if (res.error) return callb(res);

            parent.walletAddress = accounts[0];
            parent.sendAuth(callb);

            setInterval(function () {
                if (web3.eth.accounts[0] !== parent.walletAddress) {
                    location.reload();
                }
            }, 3000);

            parent._watchReconnect()
        });
    }

    static encodeFunctionTxData(transactionName, type = [], arg = []) {
        const fullName = `${transactionName}(${type.toString()})`;
        const signature = ethUtil.keccak256(fullName).toString('hex').slice(0, 8);
        const encodedParams = ethereumjsABI.rawEncode(type, arg).toString('hex');

        return '0x' + signature + encodedParams;
    };

    setNetwork(callb) {
        let parent = this;
        web3.version.getNetwork((err, netId) => {
            if(netId!=parent.currentNetwork.id)
                callb({"error":"Wrong network. Please set network to main."});
            else callb(true);
        });
    }

    isWeb3Logged() {
        return this.walletAddress != null;
    }

    sendAuth(callb) {
        var parent = this;
        console.log("authenticate on server");
        socket.emit("authenticate", { address: this.walletAddress }, function (res) {
            console.log(res);
            if (res && res.token) {
                socket.token = res.token;

                socket.emitWithAuth("wallet found", { adr: parent.walletAddress }, function (usr) {
                    user = usr;
                    callb(true);
                    $(document).trigger("user_loaded", user);
                });
            }
            else if (res.error) {
                alert(res.error);
            }
        });


    }

    _watchReconnect() {
        const parent = this;
        socket.on('connect', function () {
            console.log("send reconnect");
            parent.sendAuth(function () { });
        });
    }

    _sendRawTransaction({ from, to, value, gas, gasPrice, gasLimit, data }, callback) {
        window.web3.eth.sendTransaction({ from, to, value, gas, gasPrice, gasLimit, data }, (err, address) => {
            if (err) {
                console.log(['error'], err);
                return callback(err);
            }

            console.log("tx", address);
            callback(null, address);
        });
    }

    sendTxWithData({ transactionName, types, params, address, value, gasPrice, gas = 400000}, callback) {
        return new Promise((resolve, reject) => {

            if(testmode) return resolve("0x111");

            if (!this.isWeb3Logged) {
                return reject("Metamask is not logged");
            }

            const { encodeFunctionTxData} = WalletService;
            const data = encodeFunctionTxData(transactionName, types, params);
            console.log("value: "); console.log(value);
            console.log(value.toString());

            const rawTx = {
                from: this.walletAddress,
                to: address,
                value: web3.utils.toHex(web3.utils.toWei(value.toString(), 'ether')),
                gasPrice: web3.utils.toHex(web3.utils.toWei(gasPrice, 'gwei')),
                gasLimit: web3.utils.toHex(gas),
                gas: web3.utilstoHex(gas),
                data: data
            };

            this._sendRawTransaction(rawTx, (err, tx) => {
                if (err) {
                    reject(err);
                }else {
                    resolve(tx);
                }
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

            if(testmode) {
                return resolve({success:true, logs:[{data:[1]}], tx:"0x12345"});
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
                web3.eth.getTransactionReceipt(txHash, (err, resultData) => {
                    try {
                        if (resultData == null) {
                            return retry(tried);
                        }

                        const status = parseInt(resultData.status);

                        if (status == 1 && resultData.blockNumber != null) {
                            result.success = true;
                            resultData.logs.forEach(log => {
                                if (log.data != null && log.data.startsWith('0x')) {
                                    const data = log.data.replace('0x', '').match(/[\w\d]{64}/g);

                                    result.logs.push({
                                        topics: log.topics,
                                        data: data.map(d => '0x' + d)
                                    });
                                }
                            });

                            console.log(result);
                            return resolve(result);

                        } else {
                            retry(tried);
                        }

                    } catch (e) {
                        result.error = "Error while parsing body";
                        resolve(result);
                        console.error(e);
                    }
                });
            }

            process(0);
        });
    }

    getTxUrl(txHash) {
        return `${this.currentNetwork.url}/tx/${txHash}`;
    }

    getAddressUrl(address) {
        return `${this.currentNetwork.url}/address/${address}`;
    }

    apiCall(address, methodName, types, params) {
        return new Promise((resolve, reject) => {
            if (testmode) return 0;

            const { encodeFunctionTxData } = WalletService;
            const dataHex = encodeFunctionTxData(methodName, types, params);

            web3.eth.call({
                to: address,
                data: dataHex
            }, (err, result) => {
                if (result != null) {
                    if (result.startsWith('0x')) {
                        result = result.replace('0x', '').match(/[\w\d]{64}/g).map(d => '0x' + d);
                    }
                    return resolve(result);
                }
                reject({ "error": "etherscan result is null" });
            });
        });
    }

    checkJoinGame(gameId) {
        return Promise.resolve(true);
    }

    isValidAddress(address) {
        return address && address.startsWith('0x') && address.length == 42;
    }
}

module.exports = new WalletService();

module.exports.testmode = testmode;
