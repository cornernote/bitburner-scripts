import {Application} from "./includes/Application";

/** @param {NS} ns **/
export async function main(ns) {
    let app = new Application(ns);
    app.logger.log('Starting test.js', true);


    let player = app.cache.getItem('player');
    if (player === undefined) {
        app.logger.log('NOT CACHED!', true);

        let filename = `/tasks/${app.stringHelper.generateUUID()}.js`;
        let payload = "app.cache.setItem('player', ns.getPlayer(), 10)";
        let contents = [
            'import {Application} from "./includes/Application";',
            'export async function main(ns) {',
            '    let app = new Application(ns);',
            '    app.logger.log("Starting", true);',
            '    ' + payload,
            '    app.logger.log("Complete", true);',
            '}',
        ].join("\n");
        await ns.write(filename, contents, 'w');
        let pid = ns.run(filename); // @RAM 1GB
        app.logger.log(`process with pid ${pid} was started...`, true);
        await app.processManager.waitForProcessToComplete(pid);
        player = app.cache.getItem('player');

        // ns.rm(filename); //@RAM 1GB .. todo, delete using another thread (do we need to delete?)

    }

    app.logger.log(JSON.stringify(player), true);


}
