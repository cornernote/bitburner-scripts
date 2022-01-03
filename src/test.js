import {Application} from "./includes/Application";
import {TaskManager} from "./includes/TaskManager";

/**
 * Test script...
 *
 * Get the response from `ns.getPlayer()`, however we want to avoid the 0.5GB RAM cost
 *
 * In this case
 * - there is a 1.1GB RAM cost for the background process which is not worth the tradeoff for the 0.5GB saving to `ns.getPlayer()`
 * - there is also a background task that will consume the 0.5GB (+1.6GB base script), however it will quickly end
 * - the tradeoff is worthwhile when you run this multiple times, across multiple NS calls that cost RAM
 * - the total cost will always be FLAT 1.1GB for this script, plus whatever RAM the background script costs.
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    let app = new Application(ns);

    // first we try a cache strategy, checking if the data is in cache already
    let player = app.cache.getItem('player');
    if (player === undefined) {

        // the data is not in cache
        app.logger.log('Player data is not cached, loading it using a background task...', true);

        // next we use taskManager to do the call using a background payload
        let taskManager = new TaskManager(app, {verbose: true}); //@RAM 1.1GB
        player = await taskManager.runBackgroundPayload([
            // set 'output = ...', so something gets written to cache
            'output = ns.getPlayer();',  //@RAM 0.5GB (+1.6GB entry) (ram is allocated to background task)
        ].join("\n"));

        // save to cache
        app.logger.log('Player data was loaded, saving it to cache...', true);
        app.cache.setItem('player', player, 10 * 1000); // expires in 10s

    } else {

        // the data is cached
        app.logger.log('Player data is cached, nothing to do here...', true);

    }

    // we have the player data!
    app.logger.log(JSON.stringify(player), true);

}
