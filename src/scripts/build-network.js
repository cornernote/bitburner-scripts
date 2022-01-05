import {Runner} from "/lib/Runner";
import {cache} from "/lib/cache";

/**
 * Build the network.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const runner = new Runner(ns);

    // build player .. TODO
    let myHackingLevel = await runner.nsProxy['getHackingLevel']();

    // build attack list
    let attacks = cache.getItem('attacks');
    if (attacks === undefined) {
        ns.tprint('Building attack list in background, this may take a while...');
        attacks = await getAttacks(runner);
        cache.setItem('attacks', attacks, 60 * 60 * 24 * 1000);
    }

    // build server list
    let servers = cache.getItem('servers');
    if (servers === undefined) {
        ns.tprint('Building server list in background, this may take a while...');
        servers = await getServers(runner);
        cache.setItem('servers', servers, 60 * 60 * 24 * 1000);
    }

    // get some filtered server lists
    let rootedServers = servers.filter(s => s.rootAccess);
    let rootableServers = servers
        .filter(s => !s.rootAccess) // exclude servers with root access
        .filter(s => s.requiredHackingLevel <= myHackingLevel);

    // run all attacks on all servers
    if (rootableServers.length) {
        for (const server of rootableServers) {
            for (const attack of attacks) {
                if (attack.exists) {
                    await runner.nsProxy[attack.method](server.host);
                }
            }
            ns.tprint(`New Server Cracked: ${server.host}!`);
        }
        // rebuild server list
        ns.tprint('Building server list in background, this may take a while...');
        servers = await getServers(runner);
        cache.setItem('servers', servers, 60 * 60 * 24 * 1000);
    }

    // print the report
    ns.tprint([
        '',
        '',
        '=============',
        `Server Report`,
        '=============',
        '',
        `${servers.length} servers in the network:`,
        ` -> ${servers.map(s => s.host).join(', ')}`,
        '',
        `${rootedServers.length} servers have root access:`,
        ` -> ${rootedServers.map(s => s.host).join(', ')}`,
        '',
        `${rootableServers.length} servers are within hacking level (${myHackingLevel})`,
        ` -> ${rootableServers.map(s => s.host).join(', ')}`,
        '',
        '',
    ].join("\n"));

}

/**
 *
 * @param {Runner} runner
 * @returns {Promise<*[]>}
 */
async function getServers(runner) {
    let servers = [];
    let spider = ['home'];
    while (spider.length > 0) {
        let host = spider.pop();
        for (const scannedHostName of await runner.nsProxy['scan'](host)) {
            if (servers.filter(s => s.host === scannedHostName).length === 0) {
                spider.push(scannedHostName);
            }
        }
        servers.push({
            host: host,
            serverInfo: await runner.nsProxy['getServer'](host),
            numPortsRequired: await runner.nsProxy['getServerNumPortsRequired'](host),
            requiredHackingLevel: await runner.nsProxy['getServerRequiredHackingLevel'](host),
            maxMoney: await runner.nsProxy['getServerMaxMoney'](host),
            growth: await runner.nsProxy['getServerGrowth'](host),
            minSecurityLevel: await runner.nsProxy['getServerMinSecurityLevel'](host),
            maxRam: await runner.nsProxy['getServerMaxRam'](host),
            usedRam: await runner.nsProxy['getServerUsedRam'](host),
            rootAccess: await runner.nsProxy['hasRootAccess'](host), // cannot use hasRootAccess without false RAM cost added
        });
    }
    return servers;
}


/**
 *
 * @param {Runner} runner
 * @returns {Promise<*[]>}
 */
async function getAttacks(runner) {
    let attacks = [];
    let cracks = {
        brutessh: 'BruteSSH.exe',
        ftpcrack: 'FTPCrack.exe',
        relaysmtp: 'relaySMTP.exe',
        httpworm: 'HTTPWorm.exe',
        sqlinject: 'SQLInject.exe',
        nuke: 'NUKE.exe',
    };
    for (const [method, exe] of Object.entries(cracks)) {
        attacks.push({
            method: method,
            exe: exe,
            exists: await runner.nsProxy['fileExists'](exe, 'home'),
        });
    }
    return attacks;
}

