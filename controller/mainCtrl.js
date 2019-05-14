/**
* handles authentication/socket communication
*/
let lobbyCtrl = require('./lobbyCtrl.js');
let gameCtrl = require('./gameCtrl.js');
let contractService = require('../services/contract.service');
const {teamsIndices} = require('../libs/env/server_configs');
const teams = Object.keys(teamsIndices);

class mainCtrl {
    constructor(network) {
        this.network = network;
        this.lCtrl = new lobbyCtrl();
    }

    init(bot, socket, nrGames, maxStake, callb) {
        let parent = this;
        global.socket = this.socket = socket;
        socket.emitWithAuth = this.emitWithAuth.bind(this); 

        this.bot = bot;
        this.id = socket.id;
        this.lCtrl.init(this, this.socket);
        this.gCtrl = new gameCtrl(this);
        this.nrGames = nrGames;
        this.getBack = callb;
        this.waitingTime = 5000;
        this.gameStarted = false;
        this.gameFinished = false;
        this.maxStake=maxStake;
        
        contractService.init(this.network, bot, ({user, error}) => {
            if (user != null) {
                if (user.username == '' && user.team == '') {
                    const team = teams[Math.floor(Math.random() * 4)];
                    parent.emitWithAuth('team selected', { adr: contractService.getWalletAddress(), tId: team, username: bot.username}, (res) => {
                        console.log("bot team selected", res);
                        parent.startListening(res);
                    });
                } else {
                    parent.startListening(user);
                }
            } else {
                console.log(error);
            }
        });
    }

    emitWithAuth(eventName, ...args) {
        if (this.socket && this.socket.token) {
            var newArgs = [eventName, this.socket.token].concat(args);
            this.socket.emit.apply(this.socket, newArgs);
        }
    };

    //todo: create interval
    startListening(botUser) {
        let parent = this;
        this.user = botUser || this.user || {};
        this.gameStarted = false;
        this.gameFinished = false;

        this.socket.removeAllListeners();

        // console.log("BOT START LISTENING", this.user);

        this.socket.emitWithAuth("enter lobby");
        this.socket.emitWithAuth("bot connected");

        this.socket.on("start training game", this.hostTrainingGame.bind(this));

        this.socket.on("add slots", function (data) {
            console.log("received answer with slots-info");
            parent.socket.off("add slots");

            for (var i = 0; i < data.length; i++) {
                console.log(data[i].gameId+": "+data[i].state+", "+data[i].stake);
                if (data[i].state == "joinable" && data[i].stake <parent.maxStake) {
                    parent.lCtrl.joinGame(data[i], (ok) => {
                        if (ok) {
                            parent.gameId = data[i].gameId;
                        } else {
                            parent.getBack();
                        }
                    });
                    return;
                }
            }
            //no joinable game found, host myself first game with stake < maxStake
            if(data[0].stake==null) data[0].stake=0.02;
            parent.lCtrl.hostGame(data[0], (ok) => {
                if (ok) {
                    parent.gameId = data[0].gameId;
                } else {
                    parent.getBack();
                }
            });

        });

        this.socket.on("show current players", function (data) {
            console.log("got player infos");
            parent.socket.off("show current players");
            //console.log(data);
        });

        this.socket.on("player joined", function (data) {
            console.log("player joined");
            console.log(data);
            parent.socket.off("player joined");

            setTimeout(function () {
                if (!parent.gameStarted) parent.lCtrl.startGame();
            }, 10000);
        });

        /*
            this.socket.on("player left", function(data) {
              console.log("player left");
              console.log(data);
            });*/

        this.socket.on("end game", function (data) {
            console.log("game ended");
            parent.socket.off("end game");
            parent.gameFinished = true;
            parent.gameId = null;
            //we won!
            console.log("winner address: " + data.result.winner.adr);
            parent.gCtrl.stopPlaying();

            if (data.isTraining) {
                console.log("Bot finish a TRAINING game " + data.gameId);
                parent.waitingTime = 0;
            } else {
                parent.nrGames--;
                if (data.result.winner.adr == parent.bot.address.hex.toLowerCase()) {
                    parent.lCtrl.claimWin();
                    parent.waitingTime = 5000;
                }
            }


            if (parent.nrGames <= 0) parent.getBack();

            else {
                parent.waitingTime *= 2;

                console.log("next game starts in " + parent.waitingTime / 1000 / 60 + " minutes");
                setTimeout(function () {
                    parent.startListening();
                }, parent.waitingTime);
            }
        });

        this.socket.on("place bomb", function (data) {
            if (data.id < 10000)
                parent.gCtrl.placeBomb(data); // move to lboby
        });

        this.socket.on("start game on client", function (data) {
            console.log("game started, player-id " + parent.id + " game-id: " + data.gameId + " is training: " + data.isTraining);
            parent.gameStarted = true;
            parent.socket.off("start game on client");
            parent.emitWithAuth("update map", {
                gameId: data.gameId 
            });
            parent.emitWithAuth("bot leave training room");

            setTimeout(function () {
                if (!parent.gameFinished) {
                    parent.gCtrl.startPlaying(data, parent.id, parent.gameId, function (move, pos) {
                        parent.emitWithAuth(move, pos);
                    });
                }
            }, 5000);
        });

        this.socket.on("updated map", function (data) {
            parent.gCtrl.updateMap(data);
        });

        this.socket.on("m", function (data) {
            if (data.id != this.id)
                parent.gCtrl.updateOpponent(data);
        });

        this.socket.on("powerup acquired", function (data) {
            if (data.acquiringPlayerId === this.id)
                parent.gCtrl.powerupAcquired(data);
        });
    }

    async hostTrainingGame(callb) {
        console.log("BOT HOSTING A TRAINING GAME")
        if (this.gameId != null) {
            await this.lCtrl.leavePendingGame();
        }
        const params = {
            address: this.user.address
        };
        const parent = this;
        this.socket.emit('host training game', params, (data) => {
            parent.gameId = data.gameId;
            callb(data);
        });
    }
}


module.exports = mainCtrl;
