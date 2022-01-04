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

    let hosts = {};

    let spider = ["home"];
    while (spider.length > 0) {
        let hostName = spider.pop();
        for (const scannedHostName of ns.scan(hostName)) {
            if (!Object.keys(hosts).includes(scannedHostName)) {
                spider.push(scannedHostName);
            }
        }
        hosts[hostName] = {
            hostName: hostName,
            serverInfo: ns.getServer(hostName),
            numPortsRequired: ns.getServerNumPortsRequired(hostName),
            requiredHackingLevel: ns.getServerRequiredHackingLevel(hostName),
            maxMoney: ns.getServerMaxMoney(hostName),
            growth: ns.getServerGrowth(hostName),
            minSecurityLevel: ns.getServerMinSecurityLevel(hostName),
            maxRam: ns.getServerMaxRam(hostName),
            usedRam: ns.getServerUsedRam(hostName),
        };
    }

    ns.tprint(hosts);

}

