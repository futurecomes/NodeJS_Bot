/*
 * chose a bot from bot-list randomly, 
 * checks if balance high enough to play
 */

async function getRndBot(cService) {
    let maxAttempts = 0;
    return checkBot();

    async function checkBot() {
        maxAttempts++;
        let rnd = Math.floor(Math.random() * bots.length);
        let bal = await tronWeb.trx.getBalance(bots[rnd].address.base58);
        console.log("balance of " + bots[rnd].address.base58 + ": " + tronWeb.fromSun(bal));
        if (tronWeb.fromSun(bal) > 7) {
            return rnd;
        }
        else {
            if (maxAttempts < 30)
                return getRndBot();
            else return 0;
        }
    }

}
