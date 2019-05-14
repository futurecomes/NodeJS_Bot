/**
* super smart tronman bot-system
*
*/
const TronWeb = require('tronweb');
const eventServer = 'https://api.trongrid.io/';
const HttpProvider = TronWeb.providers.HttpProvider; // This provider is optional, you can just use a url for the nodes instead
const fullNode = new HttpProvider('https://api.trongrid.io'); // Full node http endpoint
const solidityNode = new HttpProvider('https://api.trongrid.io'); // Solidity node http endpoint

let tronWeb = new TronWeb(
    fullNode,
    solidityNode,
    eventServer
);

const bots = require('./bots/trx/bots1.json');
let mCtrl = require('./controller/mainCtrl.js');

const Socket = require('socket.io-client');
let mCtrl1 = new mCtrl("trx");
let serverUrl = 'https://tronman.app';

// serverUrl = 'http://localhost:8082';

start(5, 10);

async function start(maxStake, minBotBalance) {
  let bot = await getRndBot(minBotBalance);
  if(bot==0) {
      console.log("all bots out of money");
      return;
    }
    let s1 = Socket(serverUrl);
    console.log("new bot: " + bot.address.base58 + ", " + bot.username);
    setTimeout(function () {
        console.log("id: " + s1.id);
        let nrGames = Math.floor(Math.random() * (bot.bal / 5));
        console.log("bot plays " + nrGames + " games");
        mCtrl1.init(bot, s1, nrGames, maxStake, function () {
            s1.removeAllListeners();
            s1.close();
            start(maxStake, minBotBalance);
        });
    }, 2000);
}

async function getRndBot(minBal) {
    let bot=0;
    for(var i=0;i<bots.length;i++) {
      let bal = await tronWeb.trx.getBalance(bots[i].address.base58);
      console.log("balance of "+bots[i].username+", "+bots[i].address.base58+": "+tronWeb.fromSun(bal));
      if(tronWeb.fromSun(bal)>minBal) {
        bot=bots[i];
        bot.bal = tronWeb.fromSun(bal);
        break;
      }
    }
    return bot;

}
