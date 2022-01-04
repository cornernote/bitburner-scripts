import {Application} from "./includes/Application";
import {TaskManager} from "./components/TaskManager";

/**
 * Test
 *
 * @param {NS} ns
 */
export async function main(ns) {

    let app = new Application(ns, {
        components: {
            taskManager: {
                className: TaskManager,
                verbose: true,
            },
        },
    });


    let servers = ["home"],
        routes = {home: ["home"]};

    //let myHackingLevel = await ns.getHackingLevel(); //@RAM 0.05GB
    let myHackingLevel = await app.taskManager.backgroundNS('getHackingLevel');  //@BG RAM 0.05GB
    app.logger.log('my hacking level is: ' + myHackingLevel, true);

    // Scan all servers and keep track of the path to get to them
    for (let i = 0, j; i < servers.length; i++) {
        for (j of await app.taskManager.backgroundNS('scan', servers[i])) {
            if (!servers.includes(j)) {
                servers.push(j);
                routes[j] = routes[servers[i]].slice();
                routes[j].push(j);
            }
        }
    }

    // Filter out servers that cannot or should not be hacked / backdoored
    let hackableServers = servers.filter(s => s !== 'home' && !s.includes('hacknet-') && !s.includes('daemon')); /*or whatever you name your purchased servers*/
    app.logger.log(`${hackableServers.length} not-owned servers on the network.`, true);

    let rootedServersWithinHackingLevel = [];
    for (let i = 0, j; i < hackableServers.length; i++) {
        let serverRequiredHackingLevel = await app.taskManager.backgroundNS('getServerRequiredHackingLevel', hackableServers[i]);
        let rootAccess = await app.taskManager.backgroundNS('hasRootAccess', hackableServers[i]);
        if (myHackingLevel >= serverRequiredHackingLevel && rootAccess) {
            rootedServersWithinHackingLevel.push(hackableServers[i])
        }
    }
    app.logger.log(`${rootedServersWithinHackingLevel.length} rooted servers are within our hack level (${myHackingLevel}).`, true);



}

