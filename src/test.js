import {Application} from "./includes/Application";
import {ProcessManager} from "./includes/ProcessManager";

/**
 * Test script...
 *
 * @RAM 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    let app = new Application(ns);
    app.processManager = app.createComponent('ProcessManager');

    let player = app.cache.getItem('player');
    if (player === undefined) {
        app.logger.log('NOT CACHED!', true);
        player = await app.processManager.runBackgroundPayload([
            'await ns.sleep(5000);', // do something random...
            'output = ns.getPlayer();', // output = so something gets written to cache
        ].join("\n"));
        app.cache.setItem('player', player, 30 * 1000);
    } else {
        app.logger.log('CACHED DATA (YAY)!', true);
    }
    app.logger.log(JSON.stringify(player), true);
}


