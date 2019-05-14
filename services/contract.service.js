const ethUtil = require('ethereumjs-util');
let walletService, contractAddress;

class ContractService {
    init(network, bot, callb) {
        if (network == 'eth') {
            walletService = require('./ethWallet.service');
        } else if (network == 'trx') {
            walletService = require('./trxWallet.service');
        }
        else if (network == 'ln') {
            walletService = require('./lnWallet.service');
        }

        walletService.init(bot, (res) => {
            console.log("done wallet init", res);
            this._watchReconnect();
            this.sendAuth(callb);
            this.contractAddress = walletService.contractAddress;
        });
    }

    sendAuth(callb) {
        console.log("authenticate on server");
        socket.emit("authenticate", { address: walletService.walletAddress }, function (res) {
            console.log('auth response', res);
            if (res && res.token) {
                socket.token = res.token;

                socket.emitWithAuth("wallet found", { adr: walletService.walletAddress }, function (usr) {
                    global.user = usr;
                    // console.log('authenticated user', user);
                    callb({user: usr});
                });
            }
            else if (res.error) {
                callb({ error: res.error });
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

    getWalletAddress() {
        return walletService.walletAddress;
    }

    getTxUrl(txHash) {
        return walletService.getTxUrl(txHash);
    }

    getAddressUrl(address, isContract) {
        return walletService.getAddressUrl(address, isContract);
    }


    /**
     * initiates a new game
     * @param {number} amount stake value in ETH
     * @returns gameId
     */
    initGame(gameId, amount, referrer, team) {
        return new Promise((resolve, reject) => {
            const tx = {
                transactionName: 'initGame',
                types: ['bytes12'],
                params: [gameId],
                address: contractAddress,
                value: amount
            };

            if (referrer != null && walletService.isValidAddress(referrer) && team != null) {
                tx.transactionName = 'initGameReferred';
                tx.types = ['bytes12', 'address', 'uint8'];
                tx.params = [gameId, referrer, team];
            } else if (team != null) {
                tx.transactionName = 'initGameTeam';
                tx.types = ['bytes12', 'uint8'];
                tx.params = [gameId, team];
            }

            walletService.sendTxWithData(tx)
                .then(txHash => {
                    resolve(txHash);
                })
                .catch(error => {
                    console.error("ContractService.initGame: ", error);
                    reject({rejected: true});
                });

        });
    }

    /**
     * join a game
     * @param {string} gameId
     * @param {number} amount stake value in ETH
     * @returns tx hash of transaction
     */
    joinGame(gameId, amount, referrer, team) {
        return new Promise((resolve, reject) => {
            walletService.checkJoinGame(gameId).then(canJoin => {
                if (!canJoin) {
                    return reject("Can not join this game");
                }

                const tx = {
                    transactionName: 'joinGame',
                    types: ['bytes12'],
                    params: [gameId],
                    address: contractAddress,
                    value: amount
                };

                if (referrer != null && walletService.isValidAddress(referrer) && team != null) {
                    tx.transactionName = 'joinGameReferred';
                    tx.types = ['bytes12', 'address', 'uint8'];
                    tx.params = [gameId, referrer, team];
                } else if (team != null) {
                    tx.transactionName = 'joinGameTeam';
                    tx.types = ['bytes12', 'uint8'];
                    tx.params = [gameId, team];
                }

                walletService.sendTxWithData(tx)
                    .then(txHash => {
                        resolve(txHash);
                    })
                    .catch(error => {
                        console.error("ContractService.joinGame: ", error);
                        reject({ rejected: true });
                    });
            })
        })
    }

    /**
     * withdraw game-stake
     */
    withdraw(gameId) {
        return new Promise((resolve, reject) => {
            const tx = {
                transactionName: 'withdraw',
                types: ['bytes12'],
                params: [gameId],
                address: contractAddress,
                value: 0
            };

            walletService.sendTxWithData(tx)
                .then(txHash => {
                    resolve(txHash);
                })
                .catch(error => {
                    console.error("ContractService.withdraw: ", error);
                    reject(error);
                });
        });
    }

    /**
     * claim the reward for the winner
     */
    claimWin(gameId, contractGameId) {
        return new Promise((resolve, reject) => {
            socket.emitWithAuth('sign game', gameId, contractGameId, walletService.walletAddress, function (err, signature) {
                if (err) {
                    console.error("ContractService.claimWin: failed to sign the game", err);
                    reject(err);
                } else {
                    const signObj = ethUtil.fromRpcSig(signature);
                    const tx = {
                        transactionName: 'claimWin',
                        types: ['bytes12', 'uint8', 'bytes32', 'bytes32'],
                        params: [ethUtil.addHexPrefix(contractGameId), signObj.v, ethUtil.addHexPrefix(signObj.r), ethUtil.addHexPrefix(signObj.s)],
                        address: contractAddress,
                        value: 0
                    };
                    console.log(tx);

                    walletService.sendTxWithData(tx)
                    .then(txHash => {
                        resolve(txHash);
                    })
                    .catch(error => {
                        console.error("ContractService.claimWin: ", error);
                        reject(error);
                    });
                }
            });
        });
    }

     
    getPlayer() {
        return new Promise((resolve) => {
            walletService.apiCall(contractAddress, 'players', ['address'], [walletService.walletAddress])
                .then(result => {
                    if (result == null) return resolve(null);

                    resolve({
                        team: parseInt(result[0]),
                        score: parseInt(result[1]),
                        referrer: result[2]
                    });
                })
                .catch(err => {
                    resolve(null);
                })
        });
    }
}

module.exports = new ContractService();
