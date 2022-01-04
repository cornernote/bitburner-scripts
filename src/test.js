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

    let taskManager = new TaskManager(app, {debug: true}); //@RAM 1.1GB
    //let player = await taskManager.backgroundNS('getPlayer');

    let test = await taskManager.backgroundNS('getScriptRam', 'test.js');  //@RAM 0.1GB

    app.logger.log(test, true);

}
