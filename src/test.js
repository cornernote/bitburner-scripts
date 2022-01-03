import {Application} from "./includes/Application";

/** @param {NS} ns **/
export async function main(ns) {
    let app = new Application(ns);
    app.logger.log('Starting test.js', true);


    let player = app.cache.getItem('player');
    if (player === undefined) {
        app.logger.log('NOT CACHED!', true);

        player = runTask(ns, [
            'ns.sleep(5000);',
            'return ns.getPlayer();', // return so something gets written to cache
        ].join("\n"));

    }

    app.logger.log(JSON.stringify(player), true);


}


async function runTask(app, payload, cleanup = true) {

    // write the payload to a temp Application js file
    let uuid = app.stringHelper.generateUUID();
    let filename = `/tasks/${uuid}.js`;
    let contents = [
        ['import {', 'Application', '} from', '"./includes/Application"', ';'].join(' '), // join() to prevent game rewriting to `blob:file:///bla`
        'export async function main(ns) {',
        'let app = new Application(ns);',
        '    // save the output of the payload the uuid cache when the temp js runs',
        `    app.cache.setItem('${uuid}', () => {`,
        payload,
        '    });',
        '}',
    ].join("\n");
    await app.ns.write(filename, contents, 'w');

    // run the task, and wait for it to complete
    let pid = app.ns.run(filename); // @RAM 1GB
    app.logger.log(`task RUN was started with pid ${pid}...`, true);
    await app.processManager.waitForProcessToComplete(pid);

    // get the output from cache
    let output = app.cache.getItem(uuid);

    // cleanup the cache and task file
    if (cleanup) {
        app.cache.removeItem(uuid);
        app.ns.rm(filename); //@RAM 1GB
        pid = app.ns.run('rm-task.js', 1, uuid); // @RAM +1GB ??? // todo check this !!!
        app.logger.log(`task CLEANUP was started with pid ${pid}...`, true);
        await app.processManager.waitForProcessToComplete(pid);
    }

    // task done!
    return output;
}