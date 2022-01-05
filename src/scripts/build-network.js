import {Runner} from "/lib/Runner";

/**
 * Build the network.
 *
 * @RAM 4.40GB/thread = 2.8GB (+1.6GB for base script)
 * - 2.0GB ns.getServer()
 * - 0.2GB ns.scan()
 * - 0.1GB ns.getServerNumPortsRequired()
 * - 0.1GB ns.getServerRequiredHackingLevel()
 * - 0.1GB ns.getServerMaxMoney()
 * - 0.1GB ns.getServerGrowth()
 * - 0.1GB ns.getServerMinSecurityLevel()
 * - 0.05GB ns.getServerMaxRam()
 * - 0.05GB ns.getServerUsedRam()
 * @param {NS} ns
 */
export async function main(ns) {
    const runner = new Runner(ns);

    let hosts = {};

    let spider = ['home'];
    while (spider.length > 0) {
        let host = spider.pop();
        for (const scannedHostName of await runner.nsProxy['scan'](host)) {
            if (!Object.keys(hosts).includes(scannedHostName)) {
                spider.push(scannedHostName);
            }
        }
        hosts[host] = {
            hostName: host,
            serverInfo: await runner.nsProxy['getServer'](host),
            numPortsRequired: await runner.nsProxy['getServerNumPortsRequired'](host),
            requiredHackingLevel: await runner.nsProxy['getServerRequiredHackingLevel'](host),
            maxMoney: await runner.nsProxy['getServerMaxMoney'](host),
            growth: await runner.nsProxy['getServerGrowth'](host),
            minSecurityLevel: await runner.nsProxy['getServerMinSecurityLevel'](host),
            maxRam: await runner.nsProxy['getServerMaxRam'](host),
            usedRam: await runner.nsProxy['getServerUsedRam'](host),
        };
    }

    ns.tprint(hosts);

}

