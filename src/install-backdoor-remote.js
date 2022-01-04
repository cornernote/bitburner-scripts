import {Application} from "./includes/Application";
import {TaskManager} from "./components/TaskManager";

/**
 * Installs a backdoor on a remote host.
 *
 * @RAM 4.7GB/thread = 3.1GB (+1.6GB for base script)
 *
 * @param {NS} ns
 */
export async function main(ns) {
    if (ns.args.length < 2) {
        throw `not enough args...`;
    }

    let app = new Application(ns, {
        components: {
            taskManager: {
                className: TaskManager, //@RAM 1.1GB
            },
        },
    });

    let target = ns.args[0];
    let route = ns.args[1].split(',');

    //app.logger.log(`Hopping to ${server}`, true);
    for (let hop of route)
        ns.connect(hop);

    await app.taskManager.runBackgroundScript('install-backdoor-remote.js', 1, target);

    // if (server === "w0r1d_d43m0n") {
    //     ns.alert("Ready to hack w0r1d_d43m0n!");
    //     while (true) await ns.sleep(10000); // Sleep forever so the script isn't run multiple times to create multiple overlapping alerts
    // }
    //app.logger.log(`Installing backdoor on "${server}"...`, true);
    //await ns.sleep(spawnDelay); // Wait some time for the external backdoor script to initiate its backdoor of the current connected server


}