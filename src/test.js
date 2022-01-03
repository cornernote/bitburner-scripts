import {Application} from "./includes/Application";

/** @param {NS} ns **/
export async function main(ns) {
    let app = new Application(ns);


    let player = app.cache.getItem('player');
    if (player === undefined) {
        app.logger.log('NOT CACHED!', true);

        player = await runTask(app, [
            'await ns.sleep(5000);', // do something random...
            'output = ns.getPlayer();', // output = so something gets written to cache
        ].join("\n"));

    }

    app.logger.log(JSON.stringify(player), true);


}


