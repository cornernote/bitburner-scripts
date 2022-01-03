import {Application} from "./includes/Application";
import {TaskManager} from "./includes/TaskManager";

/**
 * Test script...
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    let app = new Application(ns);

    // additional components
    let taskManager = new TaskManager(app); //@RAM 1.1GB

    // we want to get the response from `ns.getPlayer()`, however we want to avoid the 0.5GB RAM cost

    // first we try a cache strategy, checking if the data is in cache already
    let player = app.cache.getItem('player');
    if (player === undefined) {
        // seems the data is not in cache
        app.logger.log('NOT CACHED!', true);
        // use taskManager to do the call in a background task
        player = await taskManager.runBackgroundPayload([
            'await ns.sleep(5000);', // do something random...
            'output = ns.getPlayer();', // output = so something gets written to cache
        ].join("\n"));
        app.cache.setItem('player', player, 30 * 1000);
    } else {
        app.logger.log('CACHED DATA (YAY)!', true);
    }
    app.logger.log(JSON.stringify(player), true);
}


