import {Application} from "./includes/Application";
import {BackgroundNS} from "./includes/BackgroundNS";


/**
 * Test
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    let app = new Application(ns);

    let backgroundNS = new BackgroundNS(app); //@RAM 1.1GB
    let player = await backgroundNS.getPlayer();

    // we have the player data!
    app.logger.log(JSON.stringify(player), true);

}
