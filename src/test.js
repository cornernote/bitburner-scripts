import {Application} from "./includes/Application";
import {TaskManager} from "./includes/TaskManager";


/**
 * Test
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    let app = new Application(ns);

    let taskManager = new TaskManager(app); //@RAM 1.1GB
    let player = await taskManager.backgroundNS('getPlayer');

    // we have the player data!
    app.logger.log(JSON.stringify(player), true);

}
