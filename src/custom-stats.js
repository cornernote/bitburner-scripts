import {settings} from "./_settings";

/** @param {NS} ns **/export async function main(ns) {
    // const doc = document; // This is expensive! (25GB RAM) Perhaps there's a way around it? ;)
    const doc = eval('document');
    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');
    while (true) {
        try {
            const headers = []
            const values = [];

            // Add script income per second
            headers.push('Script Inc');
            values.push(ns.nFormat(ns.getScriptIncome()[0], '$0.0a') + '/sec');
            // Add script exp gain rate per second
            headers.push('Script Exp');
            values.push(ns.nFormat(ns.getScriptExpGain(), '0.0a') + '/sec');

            // add server hacking stuff
            const statsContents = ns.read('/data/stats.json.txt')
            const stats = statsContents
                ? JSON.parse(statsContents)
                : {}

            const attacksContents = ns.read('/data/attacks.json.txt')
            const attacks = attacksContents
                ? JSON.parse(attacksContents)
                : {}

            if (attacks.length) {
                const hostHackAttacks = {}
                for (const hostAttack of attacks) {
                    if (!hostAttack.target) {
                        continue;
                    }
                    if (!hostHackAttacks[hostAttack.target]) {
                        hostHackAttacks[hostAttack.target] = []
                    }
                    hostHackAttacks[hostAttack.target].push(hostAttack)
                }
                for (const [hostname, hostHackAttacksList] of Object.entries(hostHackAttacks)) {
                    const stat = stats[hostname]
                    headers.push(hostname);
                    values.push(`${ns.nFormat(stat.average, '$0.0a')}  +${hostHackAttacksList.length}`);
                }
            }

            // get servers used for hacking
            // get servers in network
            const servers = []
            const spider = ['home']
            // run until the spider array is empty
            for (let i = 0; i < spider.length; i++) {
                const hostname = spider[i]
                // for all the connected hosts
                for (const scannedHostName of ns.scan(hostname)) {
                    // if they are not in the list
                    if (servers.filter(s => s.hostname === scannedHostName).length === 0) {
                        // add them to the spider list
                        spider.push(scannedHostName)
                    }
                }
                // get the server info
                const server = await ns.getServer(hostname)
                // add this server to the list
                servers.push(server)
            }

            // add memory
            const hackingServers = servers
                // exclude hacknet-
                .filter(s => !s.hostname.includes('hacknet'))
                // include servers with root access
                .filter(s => s.hasAdminRights)

            const ram = {
                max: hackingServers.map(s => s.maxRam).reduce((prev, next) => prev + next),
                used: hackingServers.map(s => s.ramUsed).reduce((prev, next) => prev + next),
            }
            headers.push(`RAM ${ns.nFormat(ram.used / ram.max, '0%')}`)
            values.push(`${ns.nFormat(ram.used * 1000 * 1000 * 1000, '0.0b')}/${ns.nFormat(ram.max * 1000 * 1000 * 1000, '0.0b')}`)

            // Now drop it into the placeholder elements
            hook0.innerText = headers.join(" \n");
            hook1.innerText = values.join("\n");
        } catch (err) { // This might come in handy later
            ns.tprint("ERROR: Update Skipped: " + String(err));
        }
        await ns.sleep(1000);
    }
}