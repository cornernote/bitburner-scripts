import {Application} from "./includes/Application";
import {TaskManager} from "./components/TaskManager";

/**
 * Spider Nuke
 *
 * Spiders and nukes all available servers for Root Access.
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {

    let app = new Application(ns, {
        components: {
            taskManager: {
                className: TaskManager, //@RAM 1.1GB
                verbose: true,
            },
        },
    });

    let servers = ["home"],
        routes = {home: ["home"]};

    //let myHackingLevel = await ns.getHackingLevel(); //@RAM 0.05GB
    let myHackingLevel = await app.taskManager.backgroundNS('getHackingLevel');  //@BG RAM 0.05GB
    app.logger.log('my hacking level is: '+myHackingLevel,true);
    exit();


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

    let rootedServers = [];
    for (let i = 0, j; i < hackableServers.length; i++) {
        let server = await app.taskManager.backgroundNS('hasRootAccess', hackableServers[i]);
        if (server) {
            rootedServers.push(hackableServers[i])
        }
    }
    app.logger.log(`${rootedServers.length} servers are currently rooted.`, true);

    let rootedServersWithinHackingLevel = [];
    for (let i = 0, j; i < hackableServers.length; i++) {
        let serverRequiredHackingLevel = await app.taskManager.backgroundNS('getServerRequiredHackingLevel', hackableServers[i]);
        let hasRootAccess = await app.taskManager.backgroundNS('hasRootAccess', hackableServers[i]);
        if (myHackingLevel > serverRequiredHackingLevel && hasRootAccess) {
            rootedServersWithinHackingLevel.push(hackableServers[i])
        }
    }
    app.logger.log(`${rootedServersWithinHackingLevel.length} rooted servers are within our hack level (${myHackingLevel}).`, true);


    let toBackdoor = [];
    for (let i = 0, j; i < hackableServers.length; i++) {
        let server = await app.taskManager.backgroundNS('getServer', hackableServers[i]);
        if (server) {
            toBackdoor.push(hackableServers[i])
        }
    }
    let count = toBackdoor.length;
    app.logger.log(`${count} servers have yet to be backdoored.`, true);
    if (count === 0) return;


    let anyConnected = false;

    for (const server of toBackdoor) {
        app.logger.log(`Hopping to ${server}`, true);
        anyConnected = true;
        for (let hop of routes[server])
            ns.connect(hop);
        if (server === "w0r1d_d43m0n") {
            ns.alert("Ready to hack w0r1d_d43m0n!");
            while (true) await ns.sleep(10000); // Sleep forever so the script isn't run multiple times to create multiple overlapping alerts
        }
        ns.print(`Installing backdoor on "${server}"...`);
        // Kick off a separate script that will run backdoor before we connect to home.
        var pid = ns.run('/Tasks/backdoor-all-servers.js.backdoor-one.js', 1, server);
        if (pid === 0)
            return ns.print(`Couldn't initiate a new backdoor of "${server}"" (insufficient RAM?). Will try again later.`);
        await ns.sleep(spawnDelay); // Wait some time for the external backdoor script to initiate its backdoor of the current connected server
        ns.connect("home");
    }

}

