/**
* super smart tronman bot-system
*
*/
let request = require('request');
let Web3 = require('web3');
const web3 = new Web3('ws://localhost:8546');
const bots = require('./bots/eth/bots1.json');
console.log(bots);
let mCtrl = require('./controller/mainCtrl.js');

let s1 = require('socket.io-client')('https://etherman.app');
let mCtrl1 = new mCtrl(s1, "eth");

let minBalance = 0.05;
let maxStake = 0.1;

start();

function start() {
  getRndBot(function(bot) {
      
    if(bot==0) {
      console.log("all bots out of money");
      return;
    }
    console.log("new bot: "+bot.address+", "+bot.username);
    s1.connect();
    setTimeout(function() {
      console.log("id: "+s1.id);
      let nrGames = Math.floor(Math.random() * (bot.bal/5))+1;
      console.log("bot plays "+nrGames+" games");
      mCtrl1.init(bot, s1.id, nrGames, maxStake, function() {
        s1.close();
        start();
      });
    },2000);
  });
}



function getRndBot(callb) {
     var botIndex=-1;   
    check();    
    
    function check() {
      botIndex++;
      if(botIndex>=bots.length) return callb(0);
      
      console.log(botIndex);
      getBalance(bots[botIndex].address, function(bal) {
          console.log("balance of "+bots[botIndex].username+", "+bots[botIndex].address+": "+bal);
          if(bal>minBalance) {
            var bot=bots[botIndex]; 
            bot.bal = bal;
            return callb(bot);
          }
          else check();
        });
    }  
}


function getBalance(adr, callb) {
    let url = "https://api.etherscan.io/api?module=account&action=balance&address="+adr+"&tag=latest&apikey=HRVUI53FCX99H57FRS39CUY28BEJI1YAMD";

     request({ url: url, method: 'GET' }, (error, response, body) => {
         let bal=0;
         if(JSON.parse(body).result!=null) {
            bal = web3.utils.fromWei(JSON.parse(body).result, 'ether');
         }
         callb(bal);
     });
   
}