/**
 * handles hosting/joining games
 */


const contractService = require('../services/contract.service');



class lobbyCtrl {

    init(mCtrl, s) {
        this.socket = s;
        this.mCtrl = mCtrl;
    }


    hostGame(game, callb) {
        let parent = this;
        this.gameId = game.gameId;
        console.log("host game with id " + game.gameId +" and stake: "+game.stake);

        this.mCtrl.emitWithAuth("host game", {
            gameId: game.gameId
        }, function (res) {
            console.log("hosted");
            if (res == null) {
                //deposit stake
                parent.setStake(game.stake, game.gameId, callb);
                //start waiting for 2nd player
            } else {
                console.log(res.error);
                callb(false);
            }
        });
    }

    setStake(stake, gameId, callb) {
        let parent = this;

        this.mCtrl.emitWithAuth("set stake", {
            gameId: gameId,
            stake: stake
        }, function (res) {
            if (res && res.contractGameId) {
                console.log("new gameid " + res.contractGameId);
                parent.contractGameId = res.contractGameId;

                parent.initGame(stake, gameId, callb);
            } else {
                parent.getBack();
            }
        });
    }


    initGame(stake, gameId, callb) {
        let parent = this;
        console.log("init game with stake "+stake);
        contractService.initGame(parent.contractGameId, stake)
        .then(function (tx) {
            console.log("init game done");

            let params = {
                gameId: gameId,
                address: parent.mCtrl.bot.address.hex.toLowerCase(),
                contractGameId: parent.contractGameId,
                txHash: tx
            }
            //console.log(params);

            parent.mCtrl.emitWithAuth("player deposited", params, function (res) {
                console.log("deposited");
                console.log(res);

                setTimeout(function () {
                    if (!parent.gameStarted) parent.startGame();
                }, 10000);
            });

            callb(true);

        }, function (err) {
            console.log("error on init game");
            console.log(err);
            callb(false);
        });
    }

    claimWin() {
        let parent = this;
        console.log("claim win");
        contractService.claimWin(parent.gameId, parent.contractGameId).then(function (tx) {
            console.log("claimed win"); console.log(tx);
        }, function (err) {
            console.log("error on claim win"); console.log(err);
        });

    }


    joinGame(game, callb) {
        console.log("join game " + game.gameId);
        this.gameId = game.gameId;
        let parent = this;
        this.mCtrl.emitWithAuth('join game', { gameId: game.gameId }, function (game) {
            parent.contractGameId = game.contractGameId;
            console.log(parent.contractGameId);

            contractService.joinGame(game.contractGameId, game.stake).then(function (tx) {
                console.log("game joined"); console.log(tx);

                let params = {
                    gameId: game.gameId,
                    address: parent.mCtrl.bot.address.hex.toLowerCase(),
                    contractGameId: parent.contractGameId,
                    txHash: tx
                }
                //console.log(params);

                parent.mCtrl.emitWithAuth("player deposited", params, function (res) {
                    console.log("deposited");
                    console.log(res);

                    setTimeout(function () {
                        if (!parent.gameStarted) parent.startGame();
                    }, 10000);
                });

                callb(true);

            }, function (err) {
                console.log("error on join game"); console.log(err);
                callb(false);
            });
        });
    }

    //todo: if player does not press start after 10 seconds, lets do it ourself
    startGame() {
        console.log("start game");
        this.mCtrl.emitWithAuth("start game on server");
    }

    async leavePendingGame() {
        try {
            if (this.contractGameId != null) {
                await contractService.withdraw(this.contractGameId);
                this.mCtrl.emitWithAuth("leave pending game");
                this.contractGameId = null;
            }
        } catch (err) {
            console.log("leavePendingGame.error", err);
        }
    }

}

module.exports = lobbyCtrl;
