import {Application} from "./includes/Application";

/** @param {NS} ns **/
export async function main(ns) {
    let app = new Application(ns);
    app.logger.log('Starting test.js', true);


    let player = app.cache.getItem('player');
    if (player === undefined) {
        app.logger.log('NOT CACHED!', true);
        let pid = ns.run('get-player.js'); // @RAM 1GB
        app.logger.log(`process with ${pid} was started...`);
        await app.processManager.waitForProcessToComplete(pid);
        player = app.cache.getItem('player');
    }
    app.logger.log(JSON.stringify(player), true);


}
